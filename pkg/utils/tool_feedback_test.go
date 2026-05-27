package utils

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestFormatToolFeedbackMessage(t *testing.T) {
	got := FormatToolFeedbackMessage(
		"read_file",
		"I will read README.md first to confirm the current project structure.",
		"{\n  \"path\": \"README.md\"\n}",
	)
	want := "\U0001f527 `read_file`\nI will read README.md first to confirm the current project structure.\n```json\n{\n  \"path\": \"README.md\"\n}\n```"
	if got != want {
		t.Fatalf("FormatToolFeedbackMessage() = %q, want %q", got, want)
	}
}

func TestFormatToolFeedbackMessage_EmptyExplanationShowsArgs(t *testing.T) {
	got := FormatToolFeedbackMessage("read_file", "", "{\n  \"path\": \"README.md\"\n}")
	want := "\U0001f527 `read_file`\n```json\n{\n  \"path\": \"README.md\"\n}\n```"
	if got != want {
		t.Fatalf("FormatToolFeedbackMessage() = %q, want %q", got, want)
	}
}

func TestFormatToolFeedbackMessage_EmptyToolNameOmitsToolLine(t *testing.T) {
	got := FormatToolFeedbackMessage("", "Continue drafting the final response.", "")
	want := "Continue drafting the final response."
	if got != want {
		t.Fatalf("FormatToolFeedbackMessage() = %q, want %q", got, want)
	}
}

func TestFormatToolFeedbackMessage_EmptyExplanationAndArgsKeepsOnlyToolLine(t *testing.T) {
	got := FormatToolFeedbackMessage("read_file", "", "")
	want := "\U0001f527 `read_file`"
	if got != want {
		t.Fatalf("FormatToolFeedbackMessage() = %q, want %q", got, want)
	}
}

func TestFitToolFeedbackMessage_TruncatesBodyWithinSingleMessage(t *testing.T) {
	got := FitToolFeedbackMessage(
		"\U0001f527 `read_file`\nRead README.md first to confirm the current project structure.",
		40,
	)
	want := "\U0001f527 `read_file`\nRead README.md first to..."
	if got != want {
		t.Fatalf("FitToolFeedbackMessage() = %q, want %q", got, want)
	}
}

func TestFitToolFeedbackMessage_TruncatesSingleLineMessage(t *testing.T) {
	got := FitToolFeedbackMessage("\U0001f527 `read_file`", 10)
	want := "\U0001f527 `read..."
	if got != want {
		t.Fatalf("FitToolFeedbackMessage() = %q, want %q", got, want)
	}
}

func TestFormatArgsJSON_Defaults(t *testing.T) {
	args := map[string]any{"path": "README.md", "line": 42}
	got := FormatArgsJSON(args, false, false)
	var gotVal, wantVal any
	if err := json.Unmarshal([]byte(got), &gotVal); err != nil {
		t.Fatalf("FormatArgsJSON() returned invalid JSON: %v", err)
	}
	want := `{"path":"README.md","line":42}`
	if err := json.Unmarshal([]byte(want), &wantVal); err != nil {
		t.Fatalf("invalid test want JSON: %v", err)
	}
	if !jsonValEq(gotVal, wantVal) {
		t.Fatalf("FormatArgsJSON() = %q, want %q", got, want)
	}
}

func TestFormatArgsJSON_PrettyPrint(t *testing.T) {
	args := map[string]any{"path": "README.md", "line": 42}
	got := FormatArgsJSON(args, true, false)
	var gotVal any
	if err := json.Unmarshal([]byte(got), &gotVal); err != nil {
		t.Fatalf("FormatArgsJSON() returned invalid JSON: %v", err)
	}
	want := `{"path":"README.md","line":42}`
	var wantVal any
	if err := json.Unmarshal([]byte(want), &wantVal); err != nil {
		t.Fatalf("invalid test want JSON: %v", err)
	}
	if !jsonValEq(gotVal, wantVal) {
		t.Fatalf("FormatArgsJSON() prettyPrint = %q, want structure %q", got, want)
	}
}

func TestFormatArgsJSON_DisableEscapeHTML(t *testing.T) {
	args := map[string]any{"msg": "a < b && c > d"}
	got := FormatArgsJSON(args, false, true)
	var gotVal, wantVal any
	want := `{"msg":"a < b && c > d"}`
	if err := json.Unmarshal([]byte(got), &gotVal); err != nil {
		t.Fatalf("FormatArgsJSON() returned invalid JSON: %v", err)
	}
	if err := json.Unmarshal([]byte(want), &wantVal); err != nil {
		t.Fatalf("invalid test want JSON: %v", err)
	}
	if !jsonValEq(gotVal, wantVal) {
		t.Fatalf("FormatArgsJSON() disableEscapeHTML = %q, want %q", got, want)
	}
}

func TestFormatArgsJSON_PrettyPrintAndDisableEscapeHTML(t *testing.T) {
	args := map[string]any{"msg": "a < b && c > d"}
	got := FormatArgsJSON(args, true, true)
	var gotVal, wantVal any
	want := `{"msg":"a < b && c > d"}`
	if err := json.Unmarshal([]byte(got), &gotVal); err != nil {
		t.Fatalf("FormatArgsJSON() returned invalid JSON: %v", err)
	}
	if err := json.Unmarshal([]byte(want), &wantVal); err != nil {
		t.Fatalf("invalid test want JSON: %v", err)
	}
	if !jsonValEq(gotVal, wantVal) {
		t.Fatalf("FormatArgsJSON() combined = %q, want %q", got, want)
	}
}

func TestFormatArgsJSON_EscapeHTMLByDefault(t *testing.T) {
	args := map[string]any{"msg": "a < b && c > d"}
	got := FormatArgsJSON(args, false, false)
	var gotVal, wantVal any
	want := `{"msg":"a \u003c b \u0026\u0026 c \u003e d"}`
	if err := json.Unmarshal([]byte(got), &gotVal); err != nil {
		t.Fatalf("FormatArgsJSON() returned invalid JSON: %v", err)
	}
	if err := json.Unmarshal([]byte(want), &wantVal); err != nil {
		t.Fatalf("invalid test want JSON: %v", err)
	}
	if !jsonValEq(gotVal, wantVal) {
		t.Fatalf("FormatArgsJSON() default escape = %q, want %q", got, want)
	}
}

func TestFormatArgsJSON_NilArgs(t *testing.T) {
	got := FormatArgsJSON(nil, false, false)
	want := `{}`
	if got != want {
		t.Fatalf("FormatArgsJSON() nil = %q, want %q", got, want)
	}
}

func jsonValEq(a, b any) bool {
	aJSON, _ := json.Marshal(a)
	bJSON, _ := json.Marshal(b)
	return string(aJSON) == string(bJSON)
}

func TestCompactArgsJSON_TruncatesLongStrings(t *testing.T) {
	longVal := strings.Repeat("x", 500)
	args := map[string]any{
		"path":    "/tmp/test.md",
		"content": longVal,
	}
	compact := CompactArgsJSON(args)
	contentStr, ok := compact["content"].(string)
	if !ok {
		t.Fatalf("Expected content to be string, got %T", compact["content"])
	}
	if len(contentStr) > toolFeedbackMaxValueLen+3 {
		t.Errorf("Expected content to be truncated to ~%d chars, got %d chars", toolFeedbackMaxValueLen, len(contentStr))
	}
	pathStr, ok := compact["path"].(string)
	if !ok {
		t.Fatalf("Expected path to be string, got %T", compact["path"])
	}
	if pathStr != "/tmp/test.md" {
		t.Errorf("Expected short path to be unchanged, got %q", pathStr)
	}
}

func TestCompactArgsJSON_NilArgs(t *testing.T) {
	result := CompactArgsJSON(nil)
	if result != nil {
		t.Errorf("Expected nil, got %v", result)
	}
}

func TestCompactArgsJSON_NestedMap(t *testing.T) {
	longVal := strings.Repeat("y", 500)
	args := map[string]any{
		"nested": map[string]any{
			"inner": longVal,
		},
	}
	compact := CompactArgsJSON(args)
	nested, ok := compact["nested"].(map[string]any)
	if !ok {
		t.Fatalf("Expected nested map, got %T", compact["nested"])
	}
	inner, ok := nested["inner"].(string)
	if !ok {
		t.Fatalf("Expected inner to be string, got %T", nested["inner"])
	}
	if len(inner) > toolFeedbackMaxValueLen+3 {
		t.Errorf("Expected nested inner to be truncated, got %d chars", len(inner))
	}
}

func TestCompactArgsJSON_NonStringValuesUnchanged(t *testing.T) {
	args := map[string]any{
		"count":  42,
		"flag":   true,
		"items":  []any{1, 2, 3},
	}
	compact := CompactArgsJSON(args)
	if compact["count"] != 42 {
		t.Errorf("Expected count unchanged, got %v", compact["count"])
	}
	if compact["flag"] != true {
		t.Errorf("Expected flag unchanged, got %v", compact["flag"])
	}
}

