package session

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/sipeed/picoclaw/pkg/providers"
	"github.com/sipeed/picoclaw/pkg/providers/messageutil"
)

type Session struct {
	Key      string              `json:"key"`
	Messages []providers.Message `json:"messages"`
	Summary  string              `json:"summary,omitempty"`
	Created  time.Time           `json:"created"`
	Updated  time.Time           `json:"updated"`
}

// Option is a functional option for configuring SessionManager.
type Option func(*SessionManager)

// WithMaxSessions sets the maximum number of sessions kept in memory.
// When the limit is reached, the least recently used session is evicted.
// If the session has a storage path, it is persisted before removal.
// A value of 0 means no limit (default).
func WithMaxSessions(n int) Option {
	return func(sm *SessionManager) {
		sm.maxSessions = n
	}
}

type SessionManager struct {
	sessions    map[string]*Session
	mu          sync.RWMutex
	orderMu     sync.Mutex // protects sessionOrder only
	storage     string
	maxSessions int
	sessionOrder []string // LRU order: oldest at front, newest at end
}

func NewSessionManager(storage string, opts ...Option) *SessionManager {
	sm := &SessionManager{
		sessions: make(map[string]*Session),
		storage:  storage,
	}

	for _, opt := range opts {
		opt(sm)
	}

	if storage != "" {
		os.MkdirAll(storage, 0o700)
		sm.loadSessions()
	}

	return sm
}

// touchSession updates the LRU access order for a key.
func (sm *SessionManager) touchSession(key string) {
	sm.orderMu.Lock()
	defer sm.orderMu.Unlock()

	// Remove existing entry if present.
	for i, k := range sm.sessionOrder {
		if k == key {
			sm.sessionOrder = append(sm.sessionOrder[:i], sm.sessionOrder[i+1:]...)
			break
		}
	}
	// Append as most-recently used.
	sm.sessionOrder = append(sm.sessionOrder, key)
}

// evictOldest persists (if storage is set) and removes the least recently
// used session. Caller must hold sm.mu (write lock).
func (sm *SessionManager) evictOldest() {
	sm.orderMu.Lock()
	if len(sm.sessionOrder) == 0 {
		sm.orderMu.Unlock()
		return
	}

	// Pop from front (oldest).
	key := sm.sessionOrder[0]
	sm.sessionOrder = sm.sessionOrder[1:]
	sm.orderMu.Unlock()

	// Persist before evicting.
	if sm.storage != "" {
		// Save takes its own RLock; temporarily release our write lock to
		// avoid deadlock, then re-acquire.
		sm.mu.Unlock()
		_ = sm.Save(key)
		sm.mu.Lock()
	}

	delete(sm.sessions, key)
}

// evictIfNeeded removes least-recently used sessions when the map exceeds
// maxSessions. Caller must hold sm.mu (write lock).
func (sm *SessionManager) evictIfNeeded() {
	if sm.maxSessions <= 0 {
		return
	}
	for len(sm.sessions) > sm.maxSessions {
		sm.evictOldest()
	}
}

func (sm *SessionManager) GetOrCreate(key string) *Session {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	session, ok := sm.sessions[key]
	if ok {
		sm.touchSession(key)
		return session
	}

	session = &Session{
		Key:      key,
		Messages: []providers.Message{},
		Created:  time.Now(),
		Updated:  time.Now(),
	}
	sm.sessions[key] = session
	sm.touchSession(key)
	sm.evictIfNeeded()

	return session
}

func ensureMessageCreatedAt(msg *providers.Message, fallback time.Time) {
	if msg.CreatedAt != nil && !msg.CreatedAt.IsZero() {
		return
	}
	ts := fallback
	msg.CreatedAt = &ts
}

func normalizeHistoryCreatedAt(history []providers.Message) {
	now := time.Now()
	for i := range history {
		ensureMessageCreatedAt(&history[i], now)
	}
}

func (sm *SessionManager) AddMessage(sessionKey, role, content string) {
	sm.AddFullMessage(sessionKey, providers.Message{
		Role:    role,
		Content: content,
	})
}

// AddFullMessage adds a complete message with tool calls and tool call ID to the session.
// This is used to save the full conversation flow including tool calls and tool results.
func (sm *SessionManager) AddFullMessage(sessionKey string, msg providers.Message) {
	if messageutil.IsTransientAssistantThoughtMessage(msg) {
		return
	}

	sm.mu.Lock()
	defer sm.mu.Unlock()

	session, ok := sm.sessions[sessionKey]
	if !ok {
		session = &Session{
			Key:      sessionKey,
			Messages: []providers.Message{},
			Created:  time.Now(),
		}
		sm.sessions[sessionKey] = session
	}

	now := time.Now()
	ensureMessageCreatedAt(&msg, now)

	session.Messages = append(session.Messages, msg)
	session.Updated = now

	sm.touchSession(sessionKey)
	sm.evictIfNeeded()
}

func (sm *SessionManager) GetHistory(key string) []providers.Message {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	session, ok := sm.sessions[key]
	if !ok {
		return []providers.Message{}
	}

	history := make([]providers.Message, len(session.Messages))
	copy(history, session.Messages)
	sm.touchSession(key)
	return history
}

func (sm *SessionManager) GetSummary(key string) string {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	session, ok := sm.sessions[key]
	if !ok {
		return ""
	}
	sm.touchSession(key)
	return session.Summary
}

func (sm *SessionManager) SetSummary(key string, summary string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	session, ok := sm.sessions[key]
	if ok {
		session.Summary = summary
		session.Updated = time.Now()
		sm.touchSession(key)
	}
}

func (sm *SessionManager) TruncateHistory(key string, keepLast int) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	session, ok := sm.sessions[key]
	if !ok {
		return
	}

	if keepLast <= 0 {
		session.Messages = []providers.Message{}
		session.Updated = time.Now()
		sm.touchSession(key)
		return
	}

	if len(session.Messages) <= keepLast {
		return
	}

	session.Messages = session.Messages[len(session.Messages)-keepLast:]
	session.Updated = time.Now()
	sm.touchSession(key)
}

func (sm *SessionManager) ListSessions() []string {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	keys := make([]string, 0, len(sm.sessions))
	for k := range sm.sessions {
		keys = append(keys, k)
	}
	return keys
}

// sanitizeFilename converts a session key into a cross-platform safe filename.
// Replaces ':' with '_' (session key separator) and '/' and '\' with '_' so
// composite IDs (e.g. Telegram forum "chatID/threadID") do not create
// subdirectories or break on Windows. The original key is preserved inside
// the JSON file, so loadSessions still maps back to the right in-memory key.
func sanitizeFilename(key string) string {
	s := strings.ReplaceAll(key, ":", "_")
	s = strings.ReplaceAll(s, "/", "_")
	s = strings.ReplaceAll(s, "\\", "_")
	return s
}

func (sm *SessionManager) Save(key string) error {
	if sm.storage == "" {
		return nil
	}

	filename := sanitizeFilename(key)

	// filepath.IsLocal rejects empty names, "..", absolute paths, and
	// OS-reserved device names (NUL, COM1 … on Windows). sanitizeFilename
	// already replaced '/' and '\' with '_', so no subdirs are created.
	if filename == "." || !filepath.IsLocal(filename) {
		return os.ErrInvalid
	}

	// Snapshot under read lock, then perform slow file I/O after unlock.
	sm.mu.RLock()
	stored, ok := sm.sessions[key]
	if !ok {
		sm.mu.RUnlock()
		return nil
	}

	snapshot := Session{
		Key:     stored.Key,
		Summary: stored.Summary,
		Created: stored.Created,
		Updated: stored.Updated,
	}
	if len(stored.Messages) > 0 {
		snapshot.Messages = messageutil.FilterInvalidHistoryMessages(stored.Messages)
	} else {
		snapshot.Messages = []providers.Message{}
	}
	sm.mu.RUnlock()

	data, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return err
	}

	sessionPath := filepath.Join(sm.storage, filename+".json")
	tmpFile, err := os.CreateTemp(sm.storage, "session-*.tmp")
	if err != nil {
		return err
	}

	tmpPath := tmpFile.Name()
	cleanup := true
	defer func() {
		if cleanup {
			_ = os.Remove(tmpPath)
		}
	}()

	if _, err := tmpFile.Write(data); err != nil {
		_ = tmpFile.Close()
		return err
	}
	if err := tmpFile.Chmod(0o600); err != nil {
		_ = tmpFile.Close()
		return err
	}
	if err := tmpFile.Sync(); err != nil {
		_ = tmpFile.Close()
		return err
	}
	if err := tmpFile.Close(); err != nil {
		return err
	}

	if err := os.Rename(tmpPath, sessionPath); err != nil {
		return err
	}
	cleanup = false
	return nil
}

func (sm *SessionManager) loadSessions() error {
	files, err := os.ReadDir(sm.storage)
	if err != nil {
		return err
	}

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		if filepath.Ext(file.Name()) != ".json" {
			continue
		}

		sessionPath := filepath.Join(sm.storage, file.Name())
		data, err := os.ReadFile(sessionPath)
		if err != nil {
			continue
		}

		var session Session
		if err := json.Unmarshal(data, &session); err != nil {
			continue
		}
		session.Messages = messageutil.FilterInvalidHistoryMessages(session.Messages)
		normalizeHistoryCreatedAt(session.Messages)

		sm.sessions[session.Key] = &session
		sm.sessionOrder = append(sm.sessionOrder, session.Key)
	}

	return nil
}

// Close is a no-op for the in-memory SessionManager; it satisfies the
// SessionStore interface so callers can release resources uniformly.
func (sm *SessionManager) Close() error {
	return nil
}

// SetHistory updates the messages of a session.
func (sm *SessionManager) SetHistory(key string, history []providers.Message) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	session, ok := sm.sessions[key]
	if ok {
		history = messageutil.FilterInvalidHistoryMessages(history)
		// Create a deep copy to strictly isolate internal state
		// from the caller's slice.
		msgs := make([]providers.Message, len(history))
		copy(msgs, history)
		normalizeHistoryCreatedAt(msgs)
		session.Messages = msgs
		session.Updated = time.Now()
		sm.touchSession(key)
	}
}
