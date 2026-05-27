package agent

import (
	"testing"

	"github.com/sipeed/picoclaw/pkg/providers"
)

func TestExtractToolCallsFromContent_WithSplitMarker(t *testing.T) {
	content := `{"tool": "append_file", "args": {"path": "/etc/memory.md", "content": "hello"}}<|[SPLIT]|>¡Hola! ¿Qué necesitas hoy?`
	resp := &providers.LLMResponse{Content: content}

	result := extractToolCallsFromContent(resp)

	if len(result.ToolCalls) != 1 {
		t.Fatalf("Expected 1 tool call, got %d", len(result.ToolCalls))
	}
	if result.ToolCalls[0].Name != "append_file" {
		t.Errorf("Expected tool name 'append_file', got %q", result.ToolCalls[0].Name)
	}
	if result.Content != "¡Hola! ¿Qué necesitas hoy?" {
		t.Errorf("Expected remaining content without marker, got %q", result.Content)
	}
}

func TestExtractToolCallsFromContent_MarkerInArgsValue(t *testing.T) {
	content := `{"tool": "append_file", "args": {"path": "/etc/picoclaw/workspace/memory/MEMORY.md", "content": "- 2026-05-27: User greeted multiple times with 'hola'.\n"}}<|[SPLIT]|>¡Hola! ¿Qué necesitas hoy?`
	resp := &providers.LLMResponse{Content: content}

	result := extractToolCallsFromContent(resp)

	if len(result.ToolCalls) != 1 {
		t.Fatalf("Expected 1 tool call, got %d", len(result.ToolCalls))
	}
	if result.Content != "¡Hola! ¿Qué necesitas hoy?" {
		t.Errorf("Expected remaining content without marker, got %q", result.Content)
	}
}

func TestExtractToolCallsFromContent_NoMarker(t *testing.T) {
	content := `{"tool": "get_weather", "args": {"city": "Madrid"}}`
	resp := &providers.LLMResponse{Content: content}

	result := extractToolCallsFromContent(resp)

	if len(result.ToolCalls) != 1 {
		t.Fatalf("Expected 1 tool call, got %d", len(result.ToolCalls))
	}
	if result.ToolCalls[0].Name != "get_weather" {
		t.Errorf("Expected tool name 'get_weather', got %q", result.ToolCalls[0].Name)
	}
	if result.Content != "" {
		t.Errorf("Expected empty remaining content, got %q", result.Content)
	}
}

func TestExtractToolCallsFromContent_MultipleToolCallsWithMarkers(t *testing.T) {
	content := `{"tool": "read_file", "args": {"path": "/a.txt"}}<|[SPLIT]|>{"tool": "write_file", "args": {"path": "/b.txt", "content": "hi"}}<|[SPLIT]|>Done!`
	resp := &providers.LLMResponse{Content: content}

	result := extractToolCallsFromContent(resp)

	if len(result.ToolCalls) != 2 {
		t.Fatalf("Expected 2 tool calls, got %d", len(result.ToolCalls))
	}
	if result.ToolCalls[0].Name != "read_file" {
		t.Errorf("Expected first tool 'read_file', got %q", result.ToolCalls[0].Name)
	}
	if result.ToolCalls[1].Name != "write_file" {
		t.Errorf("Expected second tool 'write_file', got %q", result.ToolCalls[1].Name)
	}
	if result.Content != "Done!" {
		t.Errorf("Expected remaining 'Done!', got %q", result.Content)
	}
}

func TestExtractToolCallsFromContent_NotJson(t *testing.T) {
	content := "Hello, this is just a regular message."
	resp := &providers.LLMResponse{Content: content}

	result := extractToolCallsFromContent(resp)

	if len(result.ToolCalls) != 0 {
		t.Fatalf("Expected 0 tool calls, got %d", len(result.ToolCalls))
	}
	if result.Content != content {
		t.Errorf("Expected content unchanged, got %q", result.Content)
	}
}

func TestExtractToolCallsFromContent_ExistingToolCallsNotSkipped(t *testing.T) {
	resp := &providers.LLMResponse{
		Content:   `[tool_use: web_search, args: {"count":5,"query":"tiktok"}]`,
		ToolCalls: []providers.ToolCall{{Name: "web_fetch", ID: "call_api_1"}},
	}

	result := extractToolCallsFromContent(resp)

	if len(result.ToolCalls) != 2 {
		t.Fatalf("Expected 2 tool calls (1 API + 1 content), got %d", len(result.ToolCalls))
	}
	if result.ToolCalls[0].Name != "web_fetch" {
		t.Errorf("Expected first tool 'web_fetch' (API), got %q", result.ToolCalls[0].Name)
	}
	if result.ToolCalls[1].Name != "web_search" {
		t.Errorf("Expected second tool 'web_search' (content), got %q", result.ToolCalls[1].Name)
	}
}

func TestExtractToolCallsFromContent_DeduplicateWhenContentDuplicatesApiCall(t *testing.T) {
	resp := &providers.LLMResponse{
		Content: `[tool_use: web_fetch, args: {"length":5000,"offset":5000,"url":"https://raw.githubusercontent.com/davidteather/TikTok-Api/main/TikTokApi/api/video.py"}]`,
		ToolCalls: []providers.ToolCall{
			{
				Name: "web_fetch",
				ID:   "call_00_zGlpmYOD0mhgRKIWRsV53432",
				Function: &providers.FunctionCall{
					Name:      "web_fetch",
					Arguments: `{"length":5000,"offset":5000,"url":"https://raw.githubusercontent.com/davidteather/TikTok-Api/main/TikTokApi/api/video.py"}`,
				},
			},
		},
	}

	result := extractToolCallsFromContent(resp)

	if len(result.ToolCalls) != 1 {
		t.Fatalf("Expected 1 tool call (duplicate removed), got %d", len(result.ToolCalls))
	}
	if result.ToolCalls[0].ID != "call_00_zGlpmYOD0mhgRKIWRsV53432" {
		t.Errorf("Expected API tool call preserved, got ID %q", result.ToolCalls[0].ID)
	}
}

func TestExtractToolCallsFromContent_BracketActionNoApiCalls(t *testing.T) {
	content := `[action: web_search, args: {count: 5, query: "scraptik tiktok comments scraper api price per request"}]`
	resp := &providers.LLMResponse{Content: content}

	result := extractToolCallsFromContent(resp)

	if len(result.ToolCalls) != 1 {
		t.Fatalf("Expected 1 tool call, got %d", len(result.ToolCalls))
	}
	if result.ToolCalls[0].Name != "web_search" {
		t.Errorf("Expected tool name 'web_search', got %q", result.ToolCalls[0].Name)
	}
	args := result.ToolCalls[0].Arguments
	if args["query"] != "scraptik tiktok comments scraper api price per request" {
		t.Errorf("Expected query arg, got %v", args["query"])
	}
	if result.Content != "" {
		t.Errorf("Expected empty content after extraction, got %q", result.Content)
	}
}

func TestExtractToolCallsFromContent_BracketToolUse(t *testing.T) {
	content := `[tool_use: web_fetch, args: {"length":5000,"offset":5000,"url":"https://example.com/api.py"}]`
	resp := &providers.LLMResponse{Content: content}

	result := extractToolCallsFromContent(resp)

	if len(result.ToolCalls) != 1 {
		t.Fatalf("Expected 1 tool call, got %d", len(result.ToolCalls))
	}
	if result.ToolCalls[0].Name != "web_fetch" {
		t.Errorf("Expected tool name 'web_fetch', got %q", result.ToolCalls[0].Name)
	}
	args := result.ToolCalls[0].Arguments
	if args["url"] != "https://example.com/api.py" {
		t.Errorf("Expected url arg, got %v", args["url"])
	}
	if result.Content != "" {
		t.Errorf("Expected empty remaining content, got %q", result.Content)
	}
}

func TestExtractToolCallsFromContent_BracketAction(t *testing.T) {
	content := `[action: web_search, args: {count: 5, query: "scraptik tiktok comments scraper api price per request"}]`
	resp := &providers.LLMResponse{Content: content}

	result := extractToolCallsFromContent(resp)

	if len(result.ToolCalls) != 1 {
		t.Fatalf("Expected 1 tool call, got %d", len(result.ToolCalls))
	}
	if result.ToolCalls[0].Name != "web_search" {
		t.Errorf("Expected tool name 'web_search', got %q", result.ToolCalls[0].Name)
	}
	args := result.ToolCalls[0].Arguments
	if args["query"] != "scraptik tiktok comments scraper api price per request" {
		t.Errorf("Expected query arg, got %v", args["query"])
	}
}

func TestExtractToolCallsFromContent_BracketTooluse(t *testing.T) {
	content := `[tooluse: websearch, args: {"count":5,"query":"apify tiktok video scraper price"}]`
	resp := &providers.LLMResponse{Content: content}

	result := extractToolCallsFromContent(resp)

	if len(result.ToolCalls) != 1 {
		t.Fatalf("Expected 1 tool call, got %d", len(result.ToolCalls))
	}
	if result.ToolCalls[0].Name != "websearch" {
		t.Errorf("Expected tool name 'websearch', got %q", result.ToolCalls[0].Name)
	}
}

func TestExtractToolCallsFromContent_BracketToolCall(t *testing.T) {
	content := `[tool_call: read_file, args: {"path": "/etc/hosts"}]`
	resp := &providers.LLMResponse{Content: content}

	result := extractToolCallsFromContent(resp)

	if len(result.ToolCalls) != 1 {
		t.Fatalf("Expected 1 tool call, got %d", len(result.ToolCalls))
	}
	if result.ToolCalls[0].Name != "read_file" {
		t.Errorf("Expected tool name 'read_file', got %q", result.ToolCalls[0].Name)
	}
}

func TestExtractToolCallsFromContent_MultipleBracketCalls(t *testing.T) {
	content := `[tooluse: websearch, args: {"count":5,"query":"apify tiktok video scraper price"}]\n{\n  "count": 5,\n  "query": "apify tiktok video scraper price per video request comments included"\n}\n[action: web_search, args: {count: 5, query: "scraptik tiktok comments scraper api price per request"}]`
	resp := &providers.LLMResponse{Content: content}

	result := extractToolCallsFromContent(resp)

	if len(result.ToolCalls) != 2 {
		t.Fatalf("Expected 2 tool calls, got %d: %+v", len(result.ToolCalls), result.ToolCalls)
	}
	if result.ToolCalls[0].Name != "websearch" {
		t.Errorf("Expected first tool 'websearch', got %q", result.ToolCalls[0].Name)
	}
	if result.ToolCalls[1].Name != "web_search" {
		t.Errorf("Expected second tool 'web_search', got %q", result.ToolCalls[1].Name)
	}
}

func TestExtractToolCallsFromContent_BracketWithEmojiPrefix(t *testing.T) {
	content := "🔧 web_search. [tool_use: web_search, args: {\"count\":5,\"query\":\"tiktok\"}]"
	resp := &providers.LLMResponse{Content: content}

	result := extractToolCallsFromContent(resp)

	if len(result.ToolCalls) != 1 {
		t.Fatalf("Expected 1 tool call, got %d", len(result.ToolCalls))
	}
	if result.ToolCalls[0].Name != "web_search" {
		t.Errorf("Expected tool name 'web_search', got %q", result.ToolCalls[0].Name)
	}
	if result.Content != "" {
		t.Errorf("Expected empty remaining content after extraction, got %q", result.Content)
	}
}

func TestDeduplicateToolCalls_NoDuplicates(t *testing.T) {
	apiCalls := []providers.ToolCall{
		{Name: "web_fetch", Function: &providers.FunctionCall{Name: "web_fetch", Arguments: `{"url":"https://a.com"}`}},
	}
	contentCalls := []providers.ToolCall{
		{Name: "web_search", Function: &providers.FunctionCall{Name: "web_search", Arguments: `{"query":"tiktok"}`}},
	}

	result := deduplicateToolCalls(apiCalls, contentCalls)
	if len(result) != 1 {
		t.Fatalf("Expected 1 unique tool call, got %d", len(result))
	}
	if result[0].Name != "web_search" {
		t.Errorf("Expected 'web_search', got %q", result[0].Name)
	}
}

func TestDeduplicateToolCalls_WithDuplicates(t *testing.T) {
	apiCalls := []providers.ToolCall{
		{Name: "web_fetch", Function: &providers.FunctionCall{Name: "web_fetch", Arguments: `{"url":"https://a.com"}`}},
	}
	contentCalls := []providers.ToolCall{
		{Name: "web_fetch", Function: &providers.FunctionCall{Name: "web_fetch", Arguments: `{"url":"https://a.com"}`}},
		{Name: "web_search", Function: &providers.FunctionCall{Name: "web_search", Arguments: `{"query":"tiktok"}`}},
	}

	result := deduplicateToolCalls(apiCalls, contentCalls)
	if len(result) != 1 {
		t.Fatalf("Expected 1 unique (duplicate removed), got %d", len(result))
	}
	if result[0].Name != "web_search" {
		t.Errorf("Expected 'web_search' (non-duplicate), got %q", result[0].Name)
	}
}

func TestDeduplicateToolCalls_EmptyApiCalls(t *testing.T) {
	contentCalls := []providers.ToolCall{
		{Name: "web_search", Function: &providers.FunctionCall{Name: "web_search", Arguments: `{"query":"tiktok"}`}},
	}

	result := deduplicateToolCalls(nil, contentCalls)
	if len(result) != 1 {
		t.Fatalf("Expected 1 tool call (passthrough), got %d", len(result))
	}
}

func TestParseRelaxedJSONMap_Strict(t *testing.T) {
	result := parseRelaxedJSONMap(`{"count":5,"query":"tiktok"}`)
	if result == nil {
		t.Fatal("Expected non-nil result")
	}
	if result["count"] != float64(5) {
		t.Errorf("Expected count=5, got %v", result["count"])
	}
	if result["query"] != "tiktok" {
		t.Errorf("Expected query=tiktok, got %v", result["query"])
	}
}

func TestParseRelaxedJSONMap_UnquotedKeys(t *testing.T) {
	result := parseRelaxedJSONMap(`{count: 5, query: "tiktok"}`)
	if result == nil {
		t.Fatal("Expected non-nil result for relaxed JSON")
	}
	if result["count"] != float64(5) {
		t.Errorf("Expected count=5, got %v", result["count"])
	}
	if result["query"] != "tiktok" {
		t.Errorf("Expected query=tiktok, got %v", result["query"])
	}
}

func TestParseRelaxedJSONMap_Invalid(t *testing.T) {
	result := parseRelaxedJSONMap("not json at all")
	if result != nil {
		t.Errorf("Expected nil for invalid JSON, got %v", result)
	}
}

func TestParseRelaxedJSONMap_Empty(t *testing.T) {
	result := parseRelaxedJSONMap("")
	if result != nil {
		t.Errorf("Expected nil for empty input, got %v", result)
	}
}

func TestStripMarkerFromArgs(t *testing.T) {
	args := map[string]any{
		"path":    "/etc/<|[SPLIT]|>memory.md",
		"content": "hello<|[SPLIT]|>world",
		"nested": map[string]any{
			"inner": "a<|[SPLIT]|>b",
		},
		"number": 42,
	}

	cleaned := stripMarkerFromArgs(args)

	if cleaned["path"] != "/etc/memory.md" {
		t.Errorf("Expected path marker stripped, got %q", cleaned["path"])
	}
	if cleaned["content"] != "helloworld" {
		t.Errorf("Expected content marker stripped, got %q", cleaned["content"])
	}
	nested, ok := cleaned["nested"].(map[string]any)
	if !ok {
		t.Fatal("Expected nested map")
	}
	if nested["inner"] != "ab" {
		t.Errorf("Expected nested inner marker stripped, got %q", nested["inner"])
	}
	if cleaned["number"] != 42 {
		t.Errorf("Expected number unchanged, got %v", cleaned["number"])
	}
}

func TestStripMarkerFromArgs_Nil(t *testing.T) {
	result := stripMarkerFromArgs(nil)
	if result != nil {
		t.Errorf("Expected nil, got %v", result)
	}
}
