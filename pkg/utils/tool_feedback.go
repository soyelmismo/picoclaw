package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
)

const ToolFeedbackContinuationHint = "Continuing the current task."

const toolFeedbackMaxValueLen = 120

func FormatArgsJSON(args map[string]any, prettyPrint, disableEscapeHTML bool) string {
	if args == nil {
		args = map[string]any{}
	}

	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	if prettyPrint {
		enc.SetIndent("", " ")
	}
	if disableEscapeHTML {
		enc.SetEscapeHTML(false)
	}
	if err := enc.Encode(args); err != nil {
		return fmt.Sprintf("%v", args)
	}
	return strings.TrimSpace(buf.String())
}

// CompactArgsJSON returns a copy of args where long string values are
// truncated to toolFeedbackMaxValueLen runes, preventing a single huge
// argument (e.g., file content) from dominating the tool feedback message.
func CompactArgsJSON(args map[string]any) map[string]any {
	if args == nil {
		return nil
	}
	compact := make(map[string]any, len(args))
	for k, v := range args {
		compact[k] = truncateArgValue(v)
	}
	return compact
}

func truncateArgValue(v any) any {
	switch tv := v.(type) {
	case string:
		return Truncate(tv, toolFeedbackMaxValueLen)
	case map[string]any:
		return CompactArgsJSON(tv)
	default:
		return v
	}
}

func FormatToolFeedbackMessage(toolName, explanation, argsPreview string) string {
	toolName = strings.TrimSpace(toolName)
	explanation = strings.TrimSpace(explanation)
	argsPreview = strings.TrimSpace(argsPreview)

	bodyLines := make([]string, 0, 2)
	if explanation != "" {
		bodyLines = append(bodyLines, explanation)
	}
	if argsPreview != "" {
		bodyLines = append(bodyLines, "```json\n"+argsPreview+"\n```")
	}
	body := strings.Join(bodyLines, "\n")

	if toolName == "" {
		return body
	}
	if body == "" {
		return fmt.Sprintf("\U0001f527 `%s`", toolName)
	}

	return fmt.Sprintf("\U0001f527 `%s`\n%s", toolName, body)
}

func FitToolFeedbackMessage(content string, maxLen int) string {
	content = strings.TrimSpace(content)
	if content == "" || maxLen <= 0 {
		return ""
	}
	if len([]rune(content)) <= maxLen {
		return content
	}

	firstLine, rest, hasRest := strings.Cut(content, "\n")
	firstLine = strings.TrimSpace(firstLine)
	rest = strings.TrimSpace(rest)

	if !hasRest || rest == "" {
		return Truncate(firstLine, maxLen)
	}

	if len([]rune(firstLine)) >= maxLen {
		return Truncate(firstLine, maxLen)
	}

	remaining := maxLen - len([]rune(firstLine)) - 1
	if remaining <= 0 {
		return Truncate(firstLine, maxLen)
	}

	return firstLine + "\n" + Truncate(rest, remaining)
}
