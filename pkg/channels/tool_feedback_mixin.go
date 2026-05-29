package channels

import (
	"context"
	"strings"

	"github.com/sipeed/picoclaw/pkg/bus"
)

// EditFunc is the signature for message edit functions used by ToolFeedbackAnimator
// and FinalizeTrackedToolFeedbackMessage.
type EditFunc = func(ctx context.Context, chatID, messageID, content string) error

// ToolFeedbackMixin provides common tool feedback tracking methods.
// Embed this in channel structs and call Init after construction.
type ToolFeedbackMixin struct {
	Progress *ToolFeedbackAnimator
	EditFn   EditFunc
	DeleteFn func(ctx context.Context, chatID, messageID string) error
}

// Init initializes the mixin with the channel's edit and delete functions.
// Must be called after the channel struct is fully constructed.
func (m *ToolFeedbackMixin) Init(editFn EditFunc, deleteFn func(ctx context.Context, chatID, messageID string) error) {
	m.Progress = NewToolFeedbackAnimator(editFn)
	m.EditFn = editFn
	m.DeleteFn = deleteFn
}

// IsToolFeedbackMessage returns true if the outbound message is a tool feedback message.
func IsToolFeedbackMessage(msg bus.OutboundMessage) bool {
	if len(msg.Context.Raw) == 0 {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(msg.Context.Raw["message_kind"]), "tool_feedback")
}

func (m *ToolFeedbackMixin) CurrentToolFeedbackMessage(chatID string) (string, bool) {
	if m.Progress == nil {
		return "", false
	}
	return m.Progress.Current(chatID)
}

func (m *ToolFeedbackMixin) TakeToolFeedbackMessage(chatID string) (string, string, bool) {
	if m.Progress == nil {
		return "", "", false
	}
	return m.Progress.Take(chatID)
}

func (m *ToolFeedbackMixin) RecordToolFeedbackMessage(chatID, messageID, content string) {
	if m.Progress == nil {
		return
	}
	m.Progress.Record(chatID, messageID, content)
}

func (m *ToolFeedbackMixin) ClearToolFeedbackMessage(chatID string) {
	if m.Progress == nil {
		return
	}
	m.Progress.Clear(chatID)
}

func (m *ToolFeedbackMixin) DismissToolFeedbackMessage(ctx context.Context, chatID string) {
	msgID, ok := m.CurrentToolFeedbackMessage(chatID)
	if !ok {
		return
	}
	m.DismissTrackedToolFeedbackMessage(ctx, chatID, msgID)
}

func (m *ToolFeedbackMixin) DismissTrackedToolFeedbackMessage(ctx context.Context, chatID, messageID string) {
	if strings.TrimSpace(chatID) == "" || strings.TrimSpace(messageID) == "" {
		return
	}
	m.ClearToolFeedbackMessage(chatID)
	if m.DeleteFn != nil {
		_ = m.DeleteFn(ctx, chatID, messageID)
	}
}

func (m *ToolFeedbackMixin) FinalizeTrackedToolFeedbackMessage(
	ctx context.Context,
	chatID string,
	content string,
	editFn EditFunc,
) ([]string, bool) {
	msgID, baseContent, ok := m.TakeToolFeedbackMessage(chatID)
	if !ok || editFn == nil {
		return nil, false
	}
	if err := editFn(ctx, chatID, msgID, content); err != nil {
		m.RecordToolFeedbackMessage(chatID, msgID, baseContent)
		return nil, false
	}
	return []string{msgID}, true
}

func (m *ToolFeedbackMixin) FinalizeToolFeedbackMessage(ctx context.Context, msg bus.OutboundMessage) ([]string, bool) {
	if IsToolFeedbackMessage(msg) {
		return nil, false
	}
	return m.FinalizeTrackedToolFeedbackMessage(ctx, msg.ChatID, msg.Content, m.EditFn)
}
