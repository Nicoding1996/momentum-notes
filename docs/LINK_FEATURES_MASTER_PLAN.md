# Link & Autolink Features - Master Implementation Plan

## Executive Summary

This document provides a comprehensive roadmap for implementing three major linking improvements in Momentum Notes:

1. **Wikilink Syntax** (`[[Note Title]]`) - Inline text-based linking
2. **Backlinks Panel** - Bidirectional link awareness
3. **AI Link Suggestions** - Proactive, intelligent connection building

These features transform linking from a manual canvas-only operation into a seamless, AI-assisted workflow that happens naturally while writing.

---

## Strategic Implementation Order

### Phase 1: Foundation (Weeks 1-6)
**Goal**: Implement wikilink syntax as the core linking mechanism

- ✅ Database schema extension (wikilinks table)
- ✅ Tiptap custom extension for wikilink nodes
- ✅ Autocomplete system with note search
- ✅ Click-to-navigate functionality
- ✅ Visual styling (exists vs broken links)
- ✅ Synchronization with canvas edges

**Why First**: Wikilinks are the foundation. Both backlinks and AI suggestions depend on this system.

**Reference**: [`WIKILINK_IMPLEMENTATION_PLAN.md`](./WIKILINK_IMPLEMENTATION_PLAN.md)

### Phase 2: Discovery (Weeks 7-10)
**Goal**: Enable users to discover existing connections

- ✅ Backlinks panel component
- ✅ Context snippet extraction
- ✅ Relationship type badges
- ✅ Click-to-navigate from backlinks
- ✅ Responsive sidebar layout

**Why Second**: Once wikilinks exist, users need to see the reverse connections to understand their knowledge graph.

**Reference**: [`BACKLINKS_PANEL_PLAN.md`](./BACKLINKS_PANEL_PLAN.md)

### Phase 3: Intelligence (Weeks 11-14)
**Goal**: Proactively suggest connections using AI

- ✅ AI analysis hook with debouncing
- ✅ Candidate filtering and ranking
- ✅ Suggestion panel UI
- ✅ One-click acceptance
- ✅ Keyboard shortcuts

**Why Third**: AI suggestions enhance the existing systems by automating discovery. They require wikilinks to be functional.

**Reference**: [`AI_LINK_SUGGESTIONS_PLAN.md`](./AI_LINK_SUGGESTIONS_PLAN.md)

---

## Visual & UX Improvements

### Enhanced Connection Handles (Canvas View)

#### Current State
- Small blue dots appear on hover
- Basic drag-to-connect

#### Improvements
```typescript
// Larger, more accessible handles
.note-handle {
  width: 24px;       // Up from 16px
  height: 24px;
  border: 3px solid var(--color-primary-500);
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: crosshair;
  transition: transform 150ms;
}

.note-handle:hover {
  transform: scale(1.2);
  border-width: 4px;
}

// Magnetic snapping when near target
.note-handle.snapping {
  transform: scale(1.3);
  border-color: var(--color-success-500);
}
```

**Features**:
- Larger touch targets (better for tablets)
- Pulse animation to indicate draggability
- Magnetic snapping when dragging near another note
- Preview line while dragging (ghost line with opacity)
- Show connection type icon on handle hover

### Radial Menu for Connection Types

#### Current State
- Modal dialog with 6 options
- Requires multiple clicks

#### Improved Design
```
User drags from Note A to Note B
    ↓
Radial menu appears around connection point:

                References (cyan)
                    ↑
    Contradicts  ←  ●  →  Related to
    (purple)           (blue)
                    ↓
                Depends on (red)

User moves mouse toward desired type → Hover highlights
User releases → Connection created
```

**Implementation**:
```typescript
// RadialConnectionMenu.tsx
<div className="radial-menu" style={{ top, left }}>
  {RELATIONSHIP_TYPES.map((type, index) => {
    const angle = (index / 6) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(angle) * 60
    const y = Math.sin(angle) * 60
    
    return (
      <button
        key={type.id}
        className="radial-item"
        style={{ 
          transform: `translate(${x}px, ${y}px)`,
          backgroundColor: type.color 
        }}
        onMouseEnter={() => setHovered(type.id)}
      >
        {type.label}
      </button>
    )
  })}
</div>
```

**Fallback**: Keyboard shortcuts (R, D, P, S, C, F) for quick selection

### Enhanced Wikilink Styling

#### Multiple States
```css
/* Default wikilink */
.wikilink {
  background: linear-gradient(135deg, 
    var(--color-primary-50) 0%, 
    var(--color-primary-100) 100%
  );
  border-bottom: 2px dotted var(--color-primary-400);
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 500;
  transition: all 200ms;
}

/* Hover state - elevated */
.wikilink:hover {
  background: var(--color-primary-100);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.2);
  border-bottom-style: solid;
}

/* Broken link (target doesn't exist) */
.wikilink-broken {
  background: linear-gradient(135deg,
    var(--color-red-50) 0%,
    var(--color-red-100) 100%
  );
  border-bottom-color: var(--color-red-400);
  font-style: italic;
  opacity: 0.8;
}

/* Recently created (fade animation) */
.wikilink-new {
  animation: wikilinkAppear 500ms ease-out;
}

@keyframes wikilinkAppear {
  from {
    background: var(--color-accent-200);
    transform: scale(1.1);
  }
  to {
    background: var(--color-primary-50);
    transform: scale(1);
  }
}

/* Connection count badge */
.wikilink::after {
  content: attr(data-connection-count);
  display: inline-block;
  margin-left: 4px;
  font-size: 0.7em;
  background: var(--color-primary-200);
  padding: 1px 4px;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 200ms;
}

.wikilink:hover::after {
  opacity: 1;
}
```

### Connection Line Improvements

#### Current State
- Simple smooth-step curves
- Single color per type

#### Enhanced Design
```css
/* Animated gradient lines */
.connection-line {
  stroke-width: 2px;
  stroke: url(#lineGradient);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  transition: all 200ms;
}

.connection-line:hover {
  stroke-width: 3px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
}

/* Animated flow particles */
.connection-line-flow {
  animation: flowParticles 3s linear infinite;
}

@keyframes flowParticles {
  0% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: 20;
  }
}

/* Bidirectional indicator */
.connection-bidirectional {
  stroke-width: 3px;
  stroke-dasharray: 8, 4;
}
```

**Features**:
- Curved Bezier paths (more organic than smooth-step)
- Subtle animated particles showing flow direction
- Hover highlights both connected notes
- Double-click edge to edit relationship type
- Context menu on right-click: Change Type, Add Note, Delete

### Autocomplete Dropdown Enhancements

#### Current Design
Simple list with titles

#### Enhanced Design
```typescript
<div className="autocomplete-item">
  {/* Icon based on note type/tags */}
  <div className="item-icon">
    {note.tags.includes('project') ? <Folder /> : <FileText />}
  </div>
  
  {/* Content */}
  <div className="item-content">
    <div className="item-title">
      {/* Highlight matching text */}
      {highlightMatch(note.title, query)}
    </div>
    
    {/* Tags preview */}
    {note.tags.length > 0 && (
      <div className="item-tags">
        {note.tags.slice(0, 3).map(tag => (
          <span className="tag-pill">{tag}</span>
        ))}
      </div>
    )}
    
    {/* Connection count */}
    <div className="item-metadata">
      <Link2 className="w-3 h-3" />
      {connectionCount} connections
    </div>
  </div>
  
  {/* Quick preview on hover */}
  <div className="item-preview">
    {note.content.slice(0, 100)}...
  </div>
</div>
```

**Features**:
- Fuzzy search with match highlighting
- Icon indicators (📁 projects, 📝 notes, 💡 ideas)
- Tag pills with colors
- Connection count badge
- Hover preview of note content
- Recent notes section at top

---

## User Workflow Improvements

### Workflow 1: Link-as-You-Write

**Current (Manual Canvas)**:
```
1. Write content
2. Switch to Canvas View
3. Find note cards
4. Drag connection handle
5. Select relationship type
6. Back to writing
```
**Time**: ~30-45 seconds

**New (Wikilink)**:
```
1. Write: "This relates to [[Proj..." 
2. Select from autocomplete
3. Continue writing
```
**Time**: ~3-5 seconds  
**Improvement**: 85-90% faster

### Workflow 2: Discover Connections

**Current**:
```
1. Wonder what's related
2. Open Canvas View
3. Visually scan for connections
4. Click around to explore
```

**New (Backlinks)**:
```
1. Open any note
2. See Backlinks panel automatically
3. Click to navigate
```
**Improvement**: Instant awareness

### Workflow 3: Build Knowledge Graph

**Current**:
```
1. Manually remember related notes
2. Manually create connections
3. Hope you don't forget anything
```

**New (AI Suggestions)**:
```
1. Write naturally
2. AI suggests relevant connections
3. One-click to accept
```
**Improvement**: Proactive assistance

---

## Keyboard Shortcuts

### New Shortcuts
| Shortcut | Action |
|----------|--------|
| `[[` | Start wikilink (triggers autocomplete) |
| `Ctrl+K` | Quick link menu |
| `Ctrl+L` | Show/hide backlinks panel |
| `Ctrl+Shift+L` | Trigger AI link suggestions |
| `Alt+Click` on note | Show all connections |
| `Ctrl+Click` on wikilink | Open in split view (future) |
| Arrow keys | Navigate autocomplete |
| `Enter` | Accept autocomplete suggestion |
| `Esc` | Close autocomplete |
| `Tab` | Accept AI suggestion |

### Canvas Shortcuts
| Shortcut | Action |
|----------|--------|
| `R` | Create "Related to" connection |
| `D` | Create "Depends on" connection |
| `P` | Create "Part of" connection |
| `S` | Create "Supports" connection |
| `C` | Create "Contradicts" connection |
| `F` | Create "References" connection |

---

## Mobile Optimizations

### Touch-Friendly Improvements

**Connection Handles**:
- 32px minimum size (Apple HIG compliance)
- Larger tap targets with invisible padding
- Haptic feedback on drag start
- Visual feedback for successful connection

**Autocomplete**:
- Bottom sheet on mobile (not dropdown)
- Large tap targets (56px)
- Swipe gestures to dismiss
- Voice input support for titles

**Backlinks Panel**:
- Collapsible by default on mobile
- Bottom drawer interaction
- Swipe down to close
- Reduced information density

---

## Performance Benchmarks

### Target Metrics

| Operation | Target | Acceptable | Poor |
|-----------|--------|------------|------|
| Autocomplete open | < 50ms | < 100ms | > 100ms |
| Wikilink render | < 10ms | < 50ms | > 50ms |
| Backlinks query | < 50ms | < 100ms | > 100ms |
| AI suggestion | < 2s | < 5s | > 5s |
| Canvas edge update | < 16ms | < 33ms | > 33ms |

### Optimization Strategies

**Database**:
- Compound indexes on wikilinks table
- Batch queries for backlinks
- Lazy load note content
- Cache frequent queries

**Rendering**:
- Virtual scrolling for 100+ backlinks
- Debounced autocomplete queries
- CSS-only animations
- Memoized components

**AI**:
- Request cancellation on new input
- Response caching (5 min TTL)
- Rate limiting (1 req per 5s)
- Fallback to keyword matching

---

## Migration Strategy

### Phase 1: Silent Launch (Week 0)
- Deploy database schema v5
- Feature flag: `ENABLE_WIKILINKS = false`
- Monitor database performance
- No user-facing changes

### Phase 2: Beta Test (Weeks 1-2)
- Enable for 10% of users
- Collect feedback via in-app survey
- Monitor error rates and performance
- Fix critical bugs

### Phase 3: Gradual Rollout (Weeks 3-4)
- 25% → 50% → 75% → 100%
- Monitor key metrics:
  - Wikilink creation rate
  - Autocomplete usage
  - Canvas vs wikilink ratio
  - User satisfaction scores

### Phase 4: Default Enabled (Week 5+)
- Feature becomes standard
- Update documentation
- Create tutorial for new users
- Announce in release notes

---

## Rollback Plan

### Scenario 1: Critical Bug
**Action**: Disable via feature flag
**Impact**: Users lose wikilink features but data preserved
**Recovery Time**: < 5 minutes

### Scenario 2: Performance Issues
**Action**: Disable AI suggestions, keep wikilinks
**Impact**: Partial feature degradation
**Recovery Time**: < 10 minutes

### Scenario 3: Data Corruption
**Action**: Rollback database to previous version
**Impact**: Loss of recent wikilinks (backup restored)
**Recovery Time**: < 30 minutes

---

## Success Metrics & KPIs

### Adoption Metrics
- **Wikilink Usage**: % of notes containing at least 1 wikilink
  - Target: 40% after 1 month, 60% after 3 months
- **Autocomplete Acceptance**: % of autocomplete triggers that result in link creation
  - Target: 30% acceptance rate
- **Backlinks Navigation**: Avg clicks per session
  - Target: 2-3 navigations per session

### Quality Metrics
- **Broken Links**: % of wikilinks pointing to deleted notes
  - Target: < 5%
- **AI Suggestion Accuracy**: % of accepted AI suggestions
  - Target: > 40% acceptance rate
- **User Satisfaction**: NPS score on linking features
  - Target: > 8/10

### Performance Metrics
- **Autocomplete Latency**: P95 response time
  - Target: < 100ms
- **Backlinks Query Time**: P95 response time
  - Target: < 50ms
- **AI Suggestion Time**: P95 response time
  - Target: < 2s

---

## Testing Strategy

### Unit Tests
```typescript
// Wikilink parsing
describe('WikilinkExtension', () => {
  it('should parse [[Title]] syntax', () => {
    const input = 'Check [[Project Alpha]] for details'
    const parsed = parseWikilinks(input)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].title).toBe('Project Alpha')
  })
  
  it('should handle broken links', () => {
    const wikilink = createWikilink('Nonexistent Note')
    expect(wikilink.exists).toBe(false)
    expect(wikilink.className).toContain('wikilink-broken')
  })
})

// Backlinks query
describe('BacklinksPanel', () => {
  it('should query backlinks correctly', async () => {
    const backlinks = await getBacklinks('note-123')
    expect(backlinks).toHaveLength(2)
    expect(backlinks[0].sourceNote.id).toBe('note-456')
  })
})

// AI suggestions
describe('useAILinkSuggestions', () => {
  it('should filter low-confidence suggestions', () => {
    const suggestions = [
      { confidence: 0.9, noteTitle: 'A' },
      { confidence: 0.6, noteTitle: 'B' }, // Should be filtered
      { confidence: 0.8, noteTitle: 'C' },
    ]
    const filtered = filterSuggestions(suggestions, 0.7)
    expect(filtered).toHaveLength(2)
  })
})
```

### Integration Tests
- Wikilink → Canvas edge synchronization
- Backlinks real-time updates
- AI suggestion → wikilink creation flow
- Navigation between notes via wikilinks

### E2E Tests (Playwright)
```typescript
test('complete wikilink workflow', async ({ page }) => {
  // Create note
  await page.click('[data-testid="new-note"]')
  await page.fill('[data-testid="note-title"]', 'Test Note')
  
  // Type wikilink
  await page.fill('[data-testid="editor"]', 'Check [[')
  
  // Autocomplete should appear
  await expect(page.locator('.autocomplete-panel')).toBeVisible()
  
  // Select first suggestion
  await page.keyboard.press('Enter')
  
  // Wikilink should be created
  await expect(page.locator('.wikilink')).toBeVisible()
  
  // Click wikilink to navigate
  await page.click('.wikilink')
  
  // Should navigate to linked note
  await expect(page.locator('[data-testid="note-title"]')).not.toHaveValue('Test Note')
})
```

---

## Documentation Updates

### User-Facing Docs
1. **Getting Started Guide**
   - "Creating Your First Link"
   - "Understanding Backlinks"
   - "Using AI Suggestions"

2. **Feature Documentation**
   - Wikilink syntax reference
   - Relationship types explained
   - Keyboard shortcuts cheat sheet

3. **Tutorial Videos**
   - "Building a Knowledge Graph" (3 min)
   - "Advanced Linking Techniques" (5 min)

### Developer Docs
1. **Architecture Overview**
   - Database schema
   - Component hierarchy
   - Data flow diagrams

2. **API Reference**
   - Wikilink extension API
   - Database queries
   - Hooks documentation

---

## Timeline & Resources

### Overall Timeline: 14 Weeks

| Phase | Duration | Team |
|-------|----------|------|
| Phase 1: Wikilinks | 6 weeks | 2 engineers |
| Phase 2: Backlinks | 4 weeks | 1 engineer |
| Phase 3: AI Suggestions | 4 weeks | 1 engineer |

### Parallel Work Opportunities
- Weeks 1-6: Focus on wikilinks (blocking work)
- Weeks 5-10: Start backlinks (requires wikilinks DB)
- Weeks 9-14: Start AI (requires wikilinks + backlinks)

### Resource Requirements
- **Engineering**: 2 full-time engineers
- **Design**: 0.5 FTE for UI/UX refinement
- **QA**: 0.5 FTE for testing
- **PM**: 0.25 FTE for coordination

---

## Risk Management

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AI API rate limits | Medium | High | Cache responses, fallback to keywords |
| Database migration fails | Low | Critical | Staged rollout, backup strategy |
| Performance degradation | Medium | Medium | Benchmarking, optimization pass |
| Tiptap compatibility | Low | High | Test with latest version, have rollback |

### User Experience Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Autocomplete too aggressive | Medium | Medium | Make dismissible, add settings |
| AI suggestions inaccurate | High | Medium | High confidence threshold, user feedback |
| Broken links confuse users | Medium | Low | Clear visual distinction, tooltips |
| Feature complexity | Low | Medium | Progressive disclosure, tutorials |

---

## Future Enhancements (Post-Launch)

### Phase 4: Advanced Features
1. **Hover Previews**: Show note content on wikilink hover
2. **Block References**: Support `[[Note#heading]]` syntax
3. **Aliases**: Support `[[Note|Display Text]]`
4. **Unlinked Mentions**: Detect potential links in text
5. **Graph Navigation Mode**: Full-screen graph exploration

### Phase 5: Collaboration
1. **Shared Knowledge Graphs**: Team workspaces
2. **Link Comments**: Annotate why connection matters
3. **Link History**: Track when/why links were created
4. **Suggested by Others**: See teammate's link suggestions

### Phase 6: Analytics
1. **Connection Insights**: Most-connected notes dashboard
2. **Orphan Detection**: Find isolated notes
3. **Graph Health Score**: Measure knowledge graph quality
4. **Usage Patterns**: How users navigate their graph

---

## Appendix: Technical Specifications

### Database Schema (Final)
```typescript
// Version 5 schema
db.version(5).stores({
  notes: 'id, updatedAt, createdAt, *tags',
  edges: 'id, source, target, createdAt, relationshipType',
  tags: 'id, name, usageCount',
  wikilinks: 'id, sourceNoteId, targetNoteId, targetTitle, [sourceNoteId+targetTitle]'
})

interface WikiLink {
  id: string
  sourceNoteId: string
  targetNoteId: string | null
  targetTitle: string
  position: number
  createdAt: string
  relationshipType: string
}
```

### API Endpoints (if applicable)
```typescript
// Future: Sync API
POST /api/wikilinks
GET /api/wikilinks/:noteId
DELETE /api/wikilinks/:id
GET /api/backlinks/:noteId
POST /api/ai/suggest-links
```

### Event Tracking
```typescript
// Analytics events
trackEvent('wikilink_created', {
  method: 'autocomplete' | 'manual',
  targetExists: boolean,
  relationshipType: string
})

trackEvent('backlink_clicked', {
  sourceNoteId: string,
  targetNoteId: string
})

trackEvent('ai_suggestion_accepted', {
  confidence: number,
  suggestionIndex: number
})
```

---

## Conclusion

These three features—Wikilinks, Backlinks, and AI Suggestions—work together to create a powerful, intuitive linking system that:

1. **Reduces friction** in creating connections
2. **Increases discoverability** of related content
3. **Leverages AI** to augment human thinking
4. **Maintains backward compatibility** with existing canvas system

The result is a note-taking experience that feels intelligent and supportive, helping users build a true "second brain" that actively assists in connecting ideas.

---

*Document Version: 1.0*  
*Last Updated: 2025-01-31*  
*Author: Kilo Code (Architect Mode)*