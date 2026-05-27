// PicoClaw - Ultra-lightweight personal AI agent
// Inspired by and based on nanobot: https://github.com/HKUDS/nanobot
// License: MIT
//
// Copyright (c) 2026 PicoClaw contributors

package channels

import (
	"strings"
)

// MessageSplitMarker is the delimiter used to split a message into multiple outbound messages.
// When SplitOnMarker is enabled in config, the Manager will split messages on this marker
// and send each part as a separate message.
const MessageSplitMarker = "<|[SPLIT]|>"

// SplitByMarker splits a message by the MessageSplitMarker and returns the parts.
// Empty parts (including from consecutive markers) are filtered out.
// If no marker is found, returns a single-element slice containing the original content.
func SplitByMarker(content string) []string {
	if content == "" {
		return nil
	}
	parts := strings.Split(content, MessageSplitMarker)
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	if len(result) == 0 {
		return []string{content}
	}
	return result
}

// StripMarker removes all occurrences of MessageSplitMarker from content.
// This is used to clean up leaked markers from LLM output in paths where
// marker-based splitting is not intended (e.g., after tool call extraction,
// or when SplitOnMarker is disabled but the model still produces markers).
func StripMarker(content string) string {
	return strings.ReplaceAll(content, MessageSplitMarker, "")
}
