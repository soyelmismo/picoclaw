package agent

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"sync/atomic"

	"github.com/sipeed/picoclaw/pkg/providers"
)

var contentToolCallIDSeq atomic.Int64

// extractToolCallsFromContent checks if an LLM response has tool calls embedded
// as text in the Content field. Many models emit tool calls in content instead of
// (or in addition to) the proper tool_calls API parameter. This function extracts
// them and deduplicates against any existing ToolCalls.
//
// Supported content formats:
//   - JSON: {"tool": "name", "args": {...}}
//   - Bracket: [tool_use: name, args: {...}]  (also tooluse, action, tool_call)
//   - Emoji prefix: 🔧 tool_name. [tool_use: ...]
func extractToolCallsFromContent(resp *providers.LLMResponse) *providers.LLMResponse {
	if resp == nil {
		return resp
	}
	content := strings.TrimSpace(resp.Content)
	if content == "" {
		return resp
	}

	var extracted []providers.ToolCall
	remaining := content

	// Phase 1: Extract all bracket-format tool calls from anywhere in content.
	// These can appear at any position, not just the beginning.
	extracted, remaining = extractBracketToolCalls(extracted, remaining)

	// Phase 2: Extract JSON-format tool calls from the beginning of remaining content.
	extracted, remaining = extractJSONToolCalls(extracted, remaining)

	remaining = strings.TrimSpace(remaining)
	remaining = strings.TrimPrefix(remaining, "<|[SPLIT]|>")
	remaining = strings.TrimSpace(remaining)

	if len(extracted) > 0 {
		beforeDedup := len(extracted)
		extracted = deduplicateToolCalls(resp.ToolCalls, extracted)
		resp.ToolCalls = append(resp.ToolCalls, extracted...)

		// When every content-extracted tool call was a duplicate of an
		// API-level tool_call, the remaining text is almost certainly just
		// the model's scaffolding (explanation, emoji prefix, etc.) that
		// accompanied the duplicate content tool call — not real
		// conversational content. Discard it to avoid flooding the chat
		// with a huge explanation that becomes tool feedback or final
		// response content.
		if len(extracted) == 0 && beforeDedup > 0 {
			resp.Content = ""
		} else {
			resp.Content = remaining
		}
	}

	return resp
}

// bracketToolCallRe matches bracket-format tool calls like:
//
//	[tool_use: web_search, args: {"count":5,"query":"tiktok"}]
//	[tooluse: websearch, args: {"count":5,"query":"apify"}]
//	[action: web_search, args: {count: 5, query: "scraptik"}]
//	[tool_call: read_file, args: {"path": "/etc/hosts"}]
//
// The args value is a JSON object (may have quoted or unquoted keys depending on model).
var bracketToolCallRe = regexp.MustCompile(
	`(?s)\[(?:tool_use|tooluse|tool_call|action)\s*:\s*(\w+)\s*,\s*args\s*:\s*(\{.+?\})\]`,
)

// extractBracketToolCalls finds and removes all bracket-format tool calls from content.
func extractBracketToolCalls(existing []providers.ToolCall, content string) ([]providers.ToolCall, string) {
	matches := bracketToolCallRe.FindAllStringSubmatchIndex(content, -1)
	if len(matches) == 0 {
		return existing, content
	}

	var cleanParts []string
	lastEnd := 0
	for _, m := range matches {
		fullStart, fullEnd := m[0], m[1]
		nameStart, nameEnd := m[2], m[3]
		argsStart, argsEnd := m[4], m[5]

		toolName := content[nameStart:nameEnd]
		argsStr := content[argsStart:argsEnd]

		args := parseRelaxedJSONMap(argsStr)
		args = stripMarkerFromArgs(args)

		tc := providers.ToolCall{
			ID:   fmt.Sprintf("call_content_%s_%d", toolName, contentToolCallIDSeq.Add(1)),
			Type: "function",
			Name: toolName,
			Function: &providers.FunctionCall{
				Name:      toolName,
				Arguments: mustMarshalJSON(args),
			},
		}
		if args != nil {
			tc.Arguments = args
		}
		existing = append(existing, tc)

		cleanParts = append(cleanParts, content[lastEnd:fullStart])
		lastEnd = fullEnd
	}
	cleanParts = append(cleanParts, content[lastEnd:])

	cleaned := strings.Join(cleanParts, "")
	cleaned = strings.ReplaceAll(cleaned, "<|[SPLIT]|>", "")
	cleaned = cleanLeadingJunk(cleaned)

	return existing, cleaned
}

// extractJSONToolCalls extracts consecutive JSON tool calls from the beginning of content.
func extractJSONToolCalls(existing []providers.ToolCall, content string) ([]providers.ToolCall, string) {
	for {
		content = strings.TrimSpace(content)
		content = strings.TrimPrefix(content, "<|[SPLIT]|>")
		content = strings.TrimSpace(content)
		if content == "" || content[0] != '{' {
			break
		}
		toolCall, remaining, found := parseToolCallJSON(content)
		if !found {
			break
		}
		existing = append(existing, *toolCall)
		content = remaining
	}
	return existing, content
}

// parseToolCallJSON attempts to parse a JSON tool call from the beginning of content.
// Handles: {"tool": "name", "args": {...}}, {"name": "...", "arguments": {...}}, etc.
func parseToolCallJSON(content string) (*providers.ToolCall, string, bool) {
	endIdx := findMatchingBrace(content, 0)
	if endIdx < 0 {
		return nil, content, false
	}

	jsonPart := content[:endIdx+1]
	remaining := strings.TrimSpace(content[endIdx+1:])
	remaining = strings.TrimPrefix(remaining, "<|[SPLIT]|>")
	remaining = strings.TrimSpace(remaining)

	var raw map[string]any
	if err := json.Unmarshal([]byte(jsonPart), &raw); err != nil {
		return nil, content, false
	}

	if len(raw) == 0 {
		return nil, content, false
	}

	toolName := extractToolName(raw)
	if toolName == "" {
		return nil, content, false
	}

	args := extractToolArgs(raw)
	cleanedArgs := stripMarkerFromArgs(args)

	tc := &providers.ToolCall{
		ID:   fmt.Sprintf("call_content_%s_%d", toolName, contentToolCallIDSeq.Add(1)),
		Type: "function",
		Name: toolName,
		Function: &providers.FunctionCall{
			Name:      toolName,
			Arguments: mustMarshalJSON(cleanedArgs),
		},
	}
	if cleanedArgs != nil {
		tc.Arguments = cleanedArgs
	}

	return tc, remaining, true
}

// deduplicateToolCalls removes content-extracted tool calls that duplicate any
// existing API-level tool call. Two tool calls are considered duplicates if they
// have the same name and the same serialized arguments.
func deduplicateToolCalls(apiCalls, contentCalls []providers.ToolCall) []providers.ToolCall {
	if len(apiCalls) == 0 {
		return contentCalls
	}

	seen := make(map[string]struct{}, len(apiCalls))
	for _, tc := range apiCalls {
		key := toolCallDedupeKey(tc)
		seen[key] = struct{}{}
	}

	var unique []providers.ToolCall
	for _, tc := range contentCalls {
		key := toolCallDedupeKey(tc)
		if _, dup := seen[key]; !dup {
			seen[key] = struct{}{}
			unique = append(unique, tc)
		}
	}
	return unique
}

// toolCallDedupeKey returns a string that uniquely identifies a tool call by name+args.
func toolCallDedupeKey(tc providers.ToolCall) string {
	args := ""
	if tc.Function != nil {
		args = tc.Function.Arguments
	}
	if args == "" {
		args = mustMarshalJSON(tc.Arguments)
	}
	return tc.Name + "|" + args
}

// emojiToolPrefixRe matches common emoji+tool-name prefixes that models emit
// alongside bracket tool calls, e.g. "🔧 web_search." or "🔧 `read_file`".
var emojiToolPrefixRe = regexp.MustCompile(`^[\p{So}\p{Sk}\x{FE0F}\x{200D}\x{E0020}-\x{E007F}]+[\s` + "`" + `]*\w+[\s` + "`" + `]*\.?[\s]*`)

// cleanLeadingJunk strips common model-emitted prefixes that precede the actual
// conversational content after tool call extraction.
func cleanLeadingJunk(s string) string {
	s = strings.TrimSpace(s)
	s = emojiToolPrefixRe.ReplaceAllString(s, "")
	return strings.TrimSpace(s)
}

// extractToolName tries to find a tool name in the JSON object using common key names.
func extractToolName(raw map[string]any) string {
	for _, key := range []string{"tool", "name", "function", "action"} {
		if v, ok := raw[key]; ok {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		}
	}
	return ""
}

// extractToolArgs tries to find tool arguments in the JSON object using common key names.
func extractToolArgs(raw map[string]any) map[string]any {
	for _, key := range []string{"args", "arguments", "params", "parameters", "arg"} {
		if v, ok := raw[key]; ok {
			if m, ok := v.(map[string]any); ok {
				return m
			}
		}
	}
	return nil
}

// findMatchingBrace finds the index of the closing brace matching the opening brace at pos.
func findMatchingBrace(s string, pos int) int {
	if pos < 0 || pos >= len(s) || s[pos] != '{' {
		return -1
	}
	depth := 0
	inString := false
	escape := false
	for i := pos; i < len(s); i++ {
		ch := s[i]
		if escape {
			escape = false
			continue
		}
		if ch == '\\' && inString {
			escape = true
			continue
		}
		if ch == '"' {
			inString = !inString
			continue
		}
		if inString {
			continue
		}
		switch ch {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return i
			}
		}
	}
	return -1
}

// parseRelaxedJSONMap parses a JSON object that may have unquoted keys
// (e.g. {count: 5, query: "tiktok"}). Returns nil if parsing fails.
func parseRelaxedJSONMap(s string) map[string]any {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}

	// Try strict JSON first
	var result map[string]any
	if err := json.Unmarshal([]byte(s), &result); err == nil {
		return result
	}

	// Quote unquoted keys: find bare word before colon and wrap in quotes.
	// This handles {count: 5, query: "tiktok"} -> {"count": 5, "query": "tiktok"}
	quoted := quoteUnquotedKeys(s)
	if quoted != s {
		if err := json.Unmarshal([]byte(quoted), &result); err == nil {
			return result
		}
	}

	return nil
}

// unquotedKeyRe matches a bare identifier followed by a colon, e.g. "count:" or "query :".
var unquotedKeyRe = regexp.MustCompile(`(?m)(^|[\s,{])([a-zA-Z_][a-zA-Z0-9_]*)\s*:`)

// quoteUnquotedKeys wraps bare JSON keys in double quotes.
func quoteUnquotedKeys(s string) string {
	return unquotedKeyRe.ReplaceAllStringFunc(s, func(match string) string {
		// The regex captures the prefix (whitespace/comma/brace) and the key name.
		sub := unquotedKeyRe.FindStringSubmatch(match)
		if len(sub) >= 3 {
			return sub[1] + `"` + sub[2] + `":`
		}
		return match
	})
}

func mustMarshalJSON(v any) string {
	if v == nil {
		return "{}"
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

const markerStr = "<|[SPLIT]|>"

// stripMarkerFromArgs recursively removes <|[SPLIT]|> markers from all string
// values in a map. Some models erroneously include the marker inside tool call
// argument values (e.g., file paths or content strings).
func stripMarkerFromArgs(args map[string]any) map[string]any {
	if args == nil {
		return nil
	}
	for k, v := range args {
		switch tv := v.(type) {
		case string:
			args[k] = strings.ReplaceAll(tv, markerStr, "")
		case map[string]any:
			args[k] = stripMarkerFromArgs(tv)
		}
	}
	return args
}
