# Backlinks Panel Implementation Plan

## Overview
This document outlines the design for implementing a Backlinks Panel in Momentum Notes, which displays all notes that link TO the currently open note. This creates bidirectional awareness and enables users to discover connections they may have forgotten about.

## Purpose & Benefits

### User Value
- **Discovery**: Find related notes you've referenced this note from
- **Context**: Understand why a note matters by seeing what links to it
- **Navigation**: Jump between connected notes without using canvas
- **Validation**: Confirm that your knowledge graph is well-connected

### Examples
```
Current Note: "React Hooks Best Practices"

Backlinks Panel shows:
📄 "Building a Todo App" 
   ...mentioned useEffect for side effects, see [[React Hooks Best Practices]]...
   
📄 "Performance Optimization Guide"
   ...reduce re-renders by following [[React Hooks Best Practices]]...
   
📄 "My Development Notes"
   ...remember to check [[React Hooks Best Practices]] before review...
```

---

## Architecture Design

### Data Flow

```
┌─────────────────────────────────────────────────────┐
│  Current Note: "Note A" (ID: abc123)                │
│                                                      │
│  Query wikilinks table:                             │
│    WHERE targetNoteId = 'abc123'                    │
│                                                      │
│  Results:                                           │
│  ┌──────────────────────────────────────────────┐  │
│  │ WikiLink 1: from "Note B"                    │  │
│  │ WikiLink 2: from "Note C"                    │  │
│  │ WikiLink 3: from "Note D"                    │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  For each wikilink:                                 │
│  1. Fetch source note by sourceNoteId               │
│  2. Extract context around wikilink position        │
│  3. Display in Backlinks Panel                      │
└─────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
NoteEditor
├── Header (title, tags, close button)
├── AI Toolbar
├── Content Editor (Tiptap)
└── Sidebar (NEW)
    ├── BacklinksPanel (collapsible)
    │   ├── BacklinkItem (for each linking note)
    │   │   ├── Note Title (clickable)
    │   │   ├── Relationship Badge
    │   │   ├── Context Snippet
    │   │   └── Timestamp
    │   └── Empty State (no backlinks)
    └── Future: Tags Panel, Metadata, etc.
```

---

## Component Implementation

### 1. BacklinksPanel Component

```typescript
// src/components/BacklinksPanel.tsx

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { ArrowRight, ChevronDown, ChevronRight, Link2 } from 'lucide-react'
import { useState } from 'react'
import type { Note } from '@/types/note'
import type { WikiLink } from '@/types/wikilink'

interface BacklinkData {
  wikilink: WikiLink
  sourceNote: Note
  contextSnippet: string
}

interface BacklinksPanelProps {
  currentNoteId: string
  currentNoteTitle: string
  onNavigateToNote: (noteId: string) => void
}

export function BacklinksPanel({ 
  currentNoteId, 
  currentNoteTitle,
  onNavigateToNote 
}: BacklinksPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  
  // Query all wikilinks pointing to this note
  const backlinks = useLiveQuery(async (): Promise<BacklinkData[]> => {
    // Find all wikilinks where target is current note
    const links = await db.wikilinks
      .where('targetNoteId')
      .equals(currentNoteId)
      .toArray()
    
    // Fetch source notes and extract context
    const backlinksData = await Promise.all(
      links.map(async (link) => {
        const sourceNote = await db.notes.get(link.sourceNoteId)
        if (!sourceNote) return null
        
        // Extract context around the wikilink
        const contextSnippet = extractContext(
          sourceNote.content, 
          link.targetTitle,
          60 // characters before/after
        )
        
        return {
          wikilink: link,
          sourceNote,
          contextSnippet,
        }
      })
    )
    
    // Filter out null results and sort by recency
    return backlinksData
      .filter((b): b is BacklinkData => b !== null)
      .sort((a, b) => 
        b.sourceNote.updatedAt.localeCompare(a.sourceNote.updatedAt)
      )
  }, [currentNoteId])
  
  if (!backlinks) {
    return (
      <div className="backlinks-panel">
        <div className="p-4 text-sm text-gray-500">Loading...</div>
      </div>
    )
  }
  
  return (
    <div className="backlinks-panel">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="backlinks-header"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <Link2 className="w-4 h-4" />
          <span className="font-semibold">Backlinks</span>
        </div>
        <span className="text-sm text-gray-500">
          {backlinks.length}
        </span>
      </button>
      
      {/* Content */}
      {isExpanded && (
        <div className="backlinks-content">
          {backlinks.length === 0 ? (
            <div className="backlinks-empty">
              <div className="text-gray-400 mb-2">
                <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                No notes link to <strong>{currentNoteTitle}</strong> yet
              </p>
              <p className="text-xs text-gray-500 text-center mt-2">
                Create links using [[{currentNoteTitle}]]
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {backlinks.map(({ wikilink, sourceNote, contextSnippet }) => (
                <BacklinkItem
                  key={wikilink.id}
                  sourceNote={sourceNote}
                  contextSnippet={contextSnippet}
                  relationshipType={wikilink.relationshipType}
                  onClick={() => onNavigateToNote(sourceNote.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Helper function to extract context
function extractContext(
  htmlContent: string,
  searchTerm: string,
  contextLength: number
): string {
  // Strip HTML tags
  const text = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  
  // Find the search term (case-insensitive)
  const lowerText = text.toLowerCase()
  const lowerSearch = searchTerm.toLowerCase()
  const index = lowerText.indexOf(lowerSearch)
  
  if (index === -1) {
    // Fallback: return first N characters
    return text.slice(0, contextLength * 2) + '...'
  }
  
  // Extract context before and after
  const start = Math.max(0, index - contextLength)
  const end = Math.min(text.length, index + searchTerm.length + contextLength)
  
  let snippet = text.slice(start, end)
  
  // Add ellipsis
  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet = snippet + '...'
  
  return snippet.trim()
}
```

### 2. BacklinkItem Component

```typescript
// src/components/BacklinkItem.tsx

import { ArrowRight, FileText } from 'lucide-react'
import type { Note } from '@/types/note'
import { RELATIONSHIP_TYPES } from '@/types/edge'

interface BacklinkItemProps {
  sourceNote: Note
  contextSnippet: string
  relationshipType: string
  onClick: () => void
}

export function BacklinkItem({
  sourceNote,
  contextSnippet,
  relationshipType,
  onClick,
}: BacklinkItemProps) {
  const relationship = RELATIONSHIP_TYPES[
    relationshipType.toUpperCase().replace('-', '_') as keyof typeof RELATIONSHIP_TYPES
  ] || RELATIONSHIP_TYPES.REFERENCES
  
  return (
    <div 
      className="backlink-item group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Note Title */}
      <div className="flex items-start gap-2 mb-2">
        <FileText className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {sourceNote.title}
          </h4>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>
      
      {/* Relationship Badge */}
      <div className="mb-2">
        <span 
          className="relationship-badge"
          style={{ 
            backgroundColor: `${relationship.color}20`,
            color: relationship.color,
          }}
        >
          {relationship.label}
        </span>
      </div>
      
      {/* Context Snippet */}
      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
        {highlightSearchTerm(contextSnippet)}
      </p>
      
      {/* Timestamp */}
      <div className="text-xs text-gray-400 mt-2">
        {formatTimestamp(sourceNote.updatedAt)}
      </div>
    </div>
  )
}

// Helper to highlight the wikilink in context
function highlightSearchTerm(text: string): React.ReactNode {
  // Find [[term]] patterns and highlight them
  const parts = text.split(/(\[\[[^\]]+\]\])/)
  
  return parts.map((part, index) => {
    if (part.match(/^\[\[.*\]\]$/)) {
      return (
        <mark 
          key={index}
          className="bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100 font-medium"
        >
          {part}
        </mark>
      )
    }
    return <span key={index}>{part}</span>
  })
}

// Format timestamp
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
```

---

## Styling

### CSS Styles

```css
/* Add to src/index.css */

/* Backlinks Panel Container */
.backlinks-panel {
  border-top: 1px solid var(--color-gray-200);
  background: var(--color-gray-50);
  max-height: 400px;
  display: flex;
  flex-direction: column;
}

.dark .backlinks-panel {
  border-top-color: var(--color-gray-700);
  background: var(--color-gray-800);
}

/* Header */
.backlinks-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: background-color 150ms;
  font-size: 0.875rem;
  color: var(--color-gray-700);
}

.dark .backlinks-header {
  color: var(--color-gray-300);
}

.backlinks-header:hover {
  background: var(--color-gray-100);
}

.dark .backlinks-header:hover {
  background: var(--color-gray-700);
}

/* Content Area */
.backlinks-content {
  padding: 0 16px 16px;
  overflow-y: auto;
  flex: 1;
}

/* Empty State */
.backlinks-empty {
  padding: 32px 16px;
  text-align: center;
}

/* Individual Backlink Item */
.backlink-item {
  padding: 12px;
  border-radius: 8px;
  background: white;
  border: 1px solid var(--color-gray-200);
  cursor: pointer;
  transition: all 150ms;
}

.dark .backlink-item {
  background: var(--color-gray-900);
  border-color: var(--color-gray-700);
}

.backlink-item:hover {
  background: var(--color-primary-50);
  border-color: var(--color-primary-200);
  transform: translateX(2px);
}

.dark .backlink-item:hover {
  background: var(--color-primary-900);
  border-color: var(--color-primary-700);
}

.backlink-item:focus {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* Relationship Badge */
.relationship-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

/* Highlight in context */
.backlinks-content mark {
  padding: 1px 3px;
  border-radius: 3px;
}
```

---

## Integration with NoteEditor

### Layout Changes

```typescript
// Update NoteEditor.tsx layout

export function NoteEditor({ note, onClose }: NoteEditorProps) {
  // ... existing code ...
  
  return (
    <div className="note-editor">
      {/* Header */}
      <div className="editor-header">...</div>
      
      {/* Main content area - now with sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor (left side) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <EditorContent editor={editor} />
        </div>
        
        {/* Sidebar (right side) */}
        <div className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
          <BacklinksPanel
            currentNoteId={note.id}
            currentNoteTitle={note.title}
            onNavigateToNote={handleNavigateToNote}
          />
        </div>
      </div>
      
      {/* Footer */}
      <div className="editor-footer">...</div>
    </div>
  )
}
```

### Responsive Behavior

```typescript
// Mobile: Collapsible Sidebar
const [sidebarVisible, setSidebarVisible] = useState(false)

// Desktop: Always visible
const isDesktop = useMediaQuery('(min-width: 1024px)')

return (
  <div className="note-editor">
    {/* Main content */}
    <div className="flex">
      <div className="flex-1">
        <EditorContent editor={editor} />
      </div>
      
      {/* Sidebar - conditional rendering */}
      {(isDesktop || sidebarVisible) && (
        <div className="sidebar">
          <BacklinksPanel {...props} />
        </div>
      )}
    </div>
    
    {/* Mobile toggle button */}
    {!isDesktop && (
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarVisible(!sidebarVisible)}
      >
        <Link2 /> Backlinks ({backlinkCount})
      </button>
    )}
  </div>
)
```

---

## Features & Interactions

### 1. Click to Navigate
- Clicking a backlink item opens that note in the editor
- Current note auto-saves before navigation
- Smooth transition between notes

### 2. Hover Effects
- Highlight on hover
- Show arrow icon indicating navigation
- Tooltip with full note title (if truncated)

### 3. Keyboard Navigation
- Tab through backlink items
- Enter/Space to open note
- Arrow keys to navigate list

### 4. Contextual Information
- Relationship type badge with color
- Timestamp showing last update
- Context snippet with highlighted wikilink
- Note title truncated with ellipsis

### 5. Performance
- Live updates with Dexie `useLiveQuery`
- Lazy loading of context snippets
- Efficient database queries with indexes
- Virtualization for 100+ backlinks (future)

---

## Edge Cases

### No Backlinks
- Show friendly empty state
- Provide hint: "Create links using [[Note Title]]"
- Icon + message

### Broken Links
- If source note is deleted, backlink disappears automatically
- `useLiveQuery` handles this reactively

### Same Note Referenced Multiple Times
- Show each instance separately
- Each gets its own context snippet
- Sorted by creation time

### Very Long Context
- Truncate to 150 characters
- Add ellipsis
- Full context on hover (future)

---

## Future Enhancements

### Phase 2
1. **Unlinked Mentions**: Show notes that mention this note's title but don't have wikilinks
2. **Grouped by Relationship**: Collapsible sections for each relationship type
3. **Link Strength**: Visual indicator of how many times a note is referenced
4. **Context Preview**: Expand to show more context on click

### Phase 3
1. **Bi-directional Link Creation**: Quick button to create reverse link
2. **Inline Editing**: Edit context snippet directly in panel
3. **Filtering**: Filter by relationship type, date, tags
4. **Search**: Search within backlinks

---

## Implementation Checklist

### Component Development
- [ ] Create `BacklinksPanel.tsx`
- [ ] Create `BacklinkItem.tsx`
- [ ] Implement context extraction function
- [ ] Add relationship badge rendering
- [ ] Add timestamp formatting

### Styling
- [ ] Define CSS classes for panel layout
- [ ] Style backlink items (default, hover, focus)
- [ ] Style relationship badges
- [ ] Add responsive breakpoints
- [ ] Dark mode support

### Integration
- [ ] Add sidebar to NoteEditor layout
- [ ] Implement navigation handler
- [ ] Add mobile toggle button
- [ ] Handle loading/empty states
- [ ] Add keyboard navigation

### Database Queries
- [ ] Test backlinks query performance
- [ ] Verify compound indexes work
- [ ] Handle edge cases (deleted notes)
- [ ] Optimize context extraction

### Testing
- [ ] Test with 0 backlinks
- [ ] Test with 1 backlink
- [ ] Test with 50+ backlinks
- [ ] Test navigation between notes
- [ ] Test responsive behavior
- [ ] Test keyboard navigation

---

## Dependencies

### Required (from Wikilinks)
- `wikilinks` table in database
- WikiLink interface type
- Working wikilink system

### No Additional Packages Needed ✅

---

## Timeline Estimate

- **Week 1**: Component development (BacklinksPanel, BacklinkItem)
- **Week 2**: Styling and responsive design
- **Week 3**: Integration with NoteEditor
- **Week 4**: Testing and polish

**Total: 4 weeks**

---

## Success Metrics

### Usage
- % of sessions where backlinks panel is used (target: 60%)
- Avg backlink navigations per session (target: 3-5)
- Time spent in backlinks panel

### Quality
- Query response time < 50ms
- Zero layout shift on panel load
- Positive user feedback

---

*Document Version: 1.0*  
*Last Updated: 2025-01-31*  
*Author: Kilo Code (Architect Mode)*