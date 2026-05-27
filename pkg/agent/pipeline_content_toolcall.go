// PicoClaw - Ultra-lightweight personal AI agent

package agent

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync/atomic"

	"github.com/sipeed/picoclaw/pkg/providers"
)

var contentToolCallIDSeq atomic.Int64

// extractToolCallsFromContent checks if an LLM response has tool calls embedded
// as JSON in the Content field (common with some models that don't properly use
// the tool_calls API parameter). If found, it extracts them into the ToolCalls
// slice and strips them from Content.
func extractToolCallsFromContent(resp *providers.LLMResponse) *providers.LLMResponse {
	if resp == nil || len(resp.ToolCalls) > 0 {
		return resp
	}
	content := strings.TrimSpace(resp.Content)
	if content == "" {
		return resp
	}

	// Only attempt extraction if content starts with a JSON object
	if content[0] != '{' {
		return resp
	}

	toolCall, remaining, found := parseToolCallJSON(content)
	if !found {
		return resp
	}

	resp.ToolCalls = append(resp.ToolCalls, *toolCall)
	resp.Content = remaining
	return resp
}

// parseToolCallJSON attempts to parse a JSON tool call from the beginning of content.
// It handles these patterns:
//
//	{"tool": "name", "args": {...}}
//	{"name": "tool_name", "arguments": {...}}
//	{"function": "name", "params": {...}}
//
// After extracting, it returns the tool call, the remaining content (after stripping
// the JSON prefix, optional <|[SPLIT]|> marker, and any leading whitespace), and
// whether a match was found.
func parseToolCallJSON(content string) (*providers.ToolCall, string, bool) {
	endIdx := findMatchingBrace(content, 0)
	if endIdx < 0 {
		return nil, content, false
	}

	jsonPart := content[:endIdx+1]
	remaining := strings.TrimSpace(content[endIdx+1:])

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

	tc := &providers.ToolCall{
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

	return tc, remaining, true
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
