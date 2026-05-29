package routing

import (
	"strings"
	"sync"
	"time"

	"github.com/sipeed/picoclaw/pkg/bus"
	"github.com/sipeed/picoclaw/pkg/config"
)

// SessionPolicy describes how a routed message should be mapped to a session.
type SessionPolicy struct {
	Dimensions    []string
	IdentityLinks map[string][]string
}

// ResolvedRoute is the result of agent routing.
type ResolvedRoute struct {
	AgentID       string
	Channel       string
	AccountID     string
	SessionPolicy SessionPolicy
	MatchedBy     string
}

// cachedRoute stores a resolved route with an expiry time for TTL caching.
type cachedRoute struct {
	route   ResolvedRoute
	expires time.Time
}

const routeCacheTTL = 5 * time.Second

// RouteResolver determines which agent handles a message.
type RouteResolver struct {
	cfg *config.Config
	// Pre-normalized identity links (canonical keys + IDs lowercased/trimmed).
	// Computed once at construction to avoid per-message normalization.
	normIdentityLinks map[string][]string
	// Pre-normalized dispatch rules (When clause normalized once).
	normDispatchRules []config.DispatchRule
	// Route cache keyed by normalized inbound context, with short TTL.
	routeCache sync.Map // map[string]*cachedRoute
}

// NewRouteResolver creates a new route resolver.
func NewRouteResolver(cfg *config.Config) *RouteResolver {
	r := &RouteResolver{
		cfg:               cfg,
		normIdentityLinks: preNormalizeIdentityLinks(cfg.Session.IdentityLinks),
	}
	if cfg.Agents.Dispatch != nil {
		r.normDispatchRules = preNormalizeDispatchSelectors(cfg.Agents.Dispatch.Rules)
	}
	return r
}

// ResolveRoute determines which agent handles the message from a normalized
// inbound context and returns the session policy that should be used to
// allocate session state. Results are cached for routeCacheTTL to avoid
// repeated computation for the same inbound context.
func (r *RouteResolver) ResolveRoute(inbound bus.InboundContext) ResolvedRoute {
	key := routeCacheKey(inbound)
	if v, ok := r.routeCache.Load(key); ok {
		if cr := v.(*cachedRoute); time.Now().Before(cr.expires) {
			return cr.route
		}
	}

	channel := strings.ToLower(strings.TrimSpace(inbound.Channel))
	accountID := NormalizeAccountID(inbound.Account)
	view := buildDispatchView(inbound, r.normIdentityLinks)

	var result ResolvedRoute
	if rule := r.matchDispatchRule(view); rule != nil {
		result = ResolvedRoute{
			AgentID:       r.pickAgentID(rule.Agent),
			Channel:       channel,
			AccountID:     accountID,
			SessionPolicy: r.sessionPolicy(rule),
			MatchedBy:     matchedByForRule(rule),
		}
	} else {
		result = ResolvedRoute{
			AgentID:       r.pickAgentID(r.resolveDefaultAgentID()),
			Channel:       channel,
			AccountID:     accountID,
			SessionPolicy: r.sessionPolicy(nil),
			MatchedBy:     "default",
		}
	}

	r.routeCache.Store(key, &cachedRoute{
		route:   result,
		expires: time.Now().Add(routeCacheTTL),
	})
	return result
}

func (r *RouteResolver) pickAgentID(agentID string) string {
	trimmed := strings.TrimSpace(agentID)
	if trimmed == "" {
		return NormalizeAgentID(r.resolveDefaultAgentID())
	}
	normalized := NormalizeAgentID(trimmed)
	agents := r.cfg.Agents.List
	if len(agents) == 0 {
		return normalized
	}
	for _, a := range agents {
		if NormalizeAgentID(a.ID) == normalized {
			return normalized
		}
	}
	return NormalizeAgentID(r.resolveDefaultAgentID())
}

func (r *RouteResolver) resolveDefaultAgentID() string {
	agents := r.cfg.Agents.List
	if len(agents) == 0 {
		return DefaultAgentID
	}
	for _, a := range agents {
		if a.Default {
			id := strings.TrimSpace(a.ID)
			if id != "" {
				return NormalizeAgentID(id)
			}
		}
	}
	if id := strings.TrimSpace(agents[0].ID); id != "" {
		return NormalizeAgentID(id)
	}
	return DefaultAgentID
}

func (r *RouteResolver) sessionPolicy(rule *config.DispatchRule) SessionPolicy {
	dimensions := r.cfg.Session.Dimensions
	if rule != nil && len(rule.SessionDimensions) > 0 {
		dimensions = rule.SessionDimensions
	}
	return SessionPolicy{
		Dimensions:    normalizeSessionDimensions(dimensions),
		IdentityLinks: cloneIdentityLinks(r.normIdentityLinks),
	}
}

func normalizeSessionDimensions(dimensions []string) []string {
	if len(dimensions) == 0 {
		return nil
	}

	normalized := make([]string, 0, len(dimensions))
	seen := make(map[string]struct{}, len(dimensions))
	for _, dimension := range dimensions {
		dimension = strings.ToLower(strings.TrimSpace(dimension))
		switch dimension {
		case "space", "chat", "topic", "sender", "user":
		default:
			continue
		}
		if _, ok := seen[dimension]; ok {
			continue
		}
		seen[dimension] = struct{}{}
		normalized = append(normalized, dimension)
	}
	if len(normalized) == 0 {
		return nil
	}
	return normalized
}

func cloneIdentityLinks(src map[string][]string) map[string][]string {
	if len(src) == 0 {
		return nil
	}
	cloned := make(map[string][]string, len(src))
	for canonical, ids := range src {
		dup := make([]string, len(ids))
		copy(dup, ids)
		cloned[canonical] = dup
	}
	return cloned
}

type dispatchView struct {
	Channel   string
	Account   string
	Space     string
	Chat      string
	Topic     string
	Sender    string
	Mentioned bool
}

func (r *RouteResolver) matchDispatchRule(view dispatchView) *config.DispatchRule {
	if r.cfg == nil || len(r.normDispatchRules) == 0 {
		return nil
	}

	for i := range r.normDispatchRules {
		rule := &r.normDispatchRules[i]
		if !selectorHasAnyConstraint(rule.When) {
			continue
		}
		if ruleMatchesView(*rule, view) {
			return rule
		}
	}
	return nil
}

func ruleMatchesView(rule config.DispatchRule, view dispatchView) bool {
	// Selector fields are pre-normalized at construction time.
	when := rule.When
	if when.Channel != "" && when.Channel != view.Channel {
		return false
	}
	if when.Account != "" && when.Account != view.Account {
		return false
	}
	if when.Space != "" && when.Space != view.Space {
		return false
	}
	if when.Chat != "" && when.Chat != view.Chat {
		return false
	}
	if when.Topic != "" && when.Topic != view.Topic {
		return false
	}
	if when.Sender != "" && when.Sender != view.Sender {
		return false
	}
	if when.Mentioned != nil && *when.Mentioned != view.Mentioned {
		return false
	}
	return true
}

func matchedByForRule(rule *config.DispatchRule) string {
	if rule == nil {
		return "default"
	}
	name := strings.TrimSpace(rule.Name)
	if name == "" {
		return "dispatch.rule"
	}
	return "dispatch.rule:" + strings.ToLower(name)
}

func buildDispatchView(inbound bus.InboundContext, identityLinks map[string][]string) dispatchView {
	view := dispatchView{
		Channel:   strings.ToLower(strings.TrimSpace(inbound.Channel)),
		Account:   NormalizeAccountID(inbound.Account),
		Mentioned: inbound.Mentioned,
	}

	if spaceID := strings.TrimSpace(inbound.SpaceID); spaceID != "" {
		spaceType := strings.ToLower(strings.TrimSpace(inbound.SpaceType))
		if spaceType == "" {
			spaceType = "space"
		}
		var b strings.Builder
		b.Grow(len(spaceType) + 1 + len(spaceID))
		b.WriteString(spaceType)
		b.WriteByte(':')
		b.WriteString(strings.ToLower(spaceID))
		view.Space = b.String()
	}

	if chatID := strings.TrimSpace(inbound.ChatID); chatID != "" {
		chatType := strings.ToLower(strings.TrimSpace(inbound.ChatType))
		if chatType == "" {
			chatType = "direct"
		}
		var b strings.Builder
		b.Grow(len(chatType) + 1 + len(chatID))
		b.WriteString(chatType)
		b.WriteByte(':')
		b.WriteString(strings.ToLower(chatID))
		view.Chat = b.String()
	}

	if topicID := strings.TrimSpace(inbound.TopicID); topicID != "" {
		view.Topic = "topic:" + strings.ToLower(topicID)
	}

	view.Sender = canonicalDispatchSenderID(inbound.Channel, inbound.SenderID, identityLinks)

	return view
}

func normalizeDispatchSelector(selector config.DispatchSelector) config.DispatchSelector {
	selector.Channel = strings.ToLower(strings.TrimSpace(selector.Channel))
	selector.Account = NormalizeAccountID(selector.Account)
	selector.Space = strings.ToLower(strings.TrimSpace(selector.Space))
	selector.Chat = strings.ToLower(strings.TrimSpace(selector.Chat))
	selector.Topic = strings.ToLower(strings.TrimSpace(selector.Topic))
	selector.Sender = strings.ToLower(strings.TrimSpace(selector.Sender))
	return selector
}

func selectorHasAnyConstraint(selector config.DispatchSelector) bool {
	return selector.Channel != "" ||
		selector.Account != "" ||
		selector.Space != "" ||
		selector.Chat != "" ||
		selector.Topic != "" ||
		selector.Sender != "" ||
		selector.Mentioned != nil
}

func canonicalDispatchSenderID(channel, rawID string, identityLinks map[string][]string) string {
	normalizedID := strings.TrimSpace(rawID)
	if normalizedID == "" {
		return ""
	}
	if linked := resolveLinkedDispatchID(identityLinks, channel, normalizedID); linked != "" {
		normalizedID = linked
	}
	return strings.ToLower(normalizedID)
}

func resolveLinkedDispatchID(identityLinks map[string][]string, channel, peerID string) string {
	if len(identityLinks) == 0 {
		return ""
	}
	peerID = strings.TrimSpace(peerID)
	if peerID == "" {
		return ""
	}

	candidates := make(map[string]bool)
	rawCandidate := strings.ToLower(peerID)
	if rawCandidate != "" {
		candidates[rawCandidate] = true
	}
	channel = strings.ToLower(strings.TrimSpace(channel))
	if channel != "" {
		var b strings.Builder
		b.Grow(len(channel) + 1 + len(rawCandidate))
		b.WriteString(channel)
		b.WriteByte(':')
		b.WriteString(rawCandidate)
		candidates[b.String()] = true
	}
	if idx := strings.Index(rawCandidate, ":"); idx > 0 && idx < len(rawCandidate)-1 {
		candidates[rawCandidate[idx+1:]] = true
	}

	for canonical, ids := range identityLinks {
		// Identity links are pre-normalized; use canonical directly.
		if canonical == "" {
			continue
		}
		for _, id := range ids {
			if id != "" && candidates[id] {
				return canonical
			}
		}
	}
	return ""
}

// routeCacheKey builds a deterministic cache key from the inbound context fields
// that affect routing. Uses strings.Builder to avoid fmt.Sprintf allocations.
func routeCacheKey(inbound bus.InboundContext) string {
	var b strings.Builder
	b.WriteString("c:")
	b.WriteString(strings.ToLower(strings.TrimSpace(inbound.Channel)))
	b.WriteString("|a:")
	b.WriteString(NormalizeAccountID(inbound.Account))
	b.WriteString("|s:")
	b.WriteString(strings.ToLower(strings.TrimSpace(inbound.SpaceType)))
	b.WriteByte(':')
	b.WriteString(strings.ToLower(strings.TrimSpace(inbound.SpaceID)))
	b.WriteString("|ch:")
	b.WriteString(strings.ToLower(strings.TrimSpace(inbound.ChatType)))
	b.WriteByte(':')
	b.WriteString(strings.ToLower(strings.TrimSpace(inbound.ChatID)))
	b.WriteString("|t:")
	b.WriteString(strings.ToLower(strings.TrimSpace(inbound.TopicID)))
	b.WriteString("|sn:")
	b.WriteString(strings.TrimSpace(inbound.SenderID))
	b.WriteString("|m:")
	if inbound.Mentioned {
		b.WriteByte('1')
	} else {
		b.WriteByte('0')
	}
	return b.String()
}

// preNormalizeIdentityKeys lowercases and trims all keys and values in the
// identity links map so callers don't need to normalize per message.
func preNormalizeIdentityLinks(src map[string][]string) map[string][]string {
	if len(src) == 0 {
		return nil
	}
	norm := make(map[string][]string, len(src))
	for canonical, ids := range src {
		nc := strings.ToLower(strings.TrimSpace(canonical))
		if nc == "" {
			continue
		}
		dup := make([]string, 0, len(ids))
		for _, id := range ids {
			if nid := strings.ToLower(strings.TrimSpace(id)); nid != "" {
				dup = append(dup, nid)
			}
		}
		if len(dup) > 0 {
			norm[nc] = dup
		}
	}
	if len(norm) == 0 {
		return nil
	}
	return norm
}

// preNormalizeDispatchSelectors returns a copy of rules with every When clause
// pre-normalized, so ruleMatchesView can skip normalization on every message.
func preNormalizeDispatchSelectors(rules []config.DispatchRule) []config.DispatchRule {
	if len(rules) == 0 {
		return nil
	}
	out := make([]config.DispatchRule, len(rules))
	copy(out, rules)
	for i := range out {
		out[i].When = normalizeDispatchSelector(out[i].When)
	}
	return out
}
