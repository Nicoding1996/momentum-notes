# Wikilink Implementation Plan

## Overview
This document outlines the architectural design for implementing inline wikilink functionality (`[[Note Title]]` syntax) in Momentum Notes, enabling users to create note connections directly within the editor while writing.

## Current Architecture Analysis

### Editor Stack
- **Editor**: Tiptap (ProseMirror-based WYSIWYG)
- **Extensions**: StarterKit, UnderlineExtension, ImageExtension
- **Content Format**: HTML (stored and rendered)

### Database Schema (Dexie/IndexedDB)
```typescript
// Current tables
notes: 'id, updatedAt, createdAt, *tags'
edges: 'id, source, target, createdAt, relationshipType'
tags: 'id, name, usageCount'
```

### Current Linking System
- **Method**: Canvas-based drag connections
- **Storage**: `NoteEdge` objects in `edges` table
- **Relationship Types**: 6 predefined types with colors
- **Navigation**: Visual canvas only

---

## Implementation Architecture

### Phase 1: Database Schema Extension

#### 1.1 New WikiLink Table
```typescript
interface WikiLink {
  id: string                    // Unique identifier
  sourceNoteId: string          // Note containing the wikilink
  targetNoteId: string | null   // Linked note ID (null if target doesn't exist)
  targetTitle: string           // Title used in [[Title]] syntax
  position: number              // Character offset in source content
  createdAt: string             // ISO timestamp
  relationshipType: string      // Default: 'references'
}

// Database version update
db.version(5).stores({
  notes: 'id, updatedAt, createdAt, *tags',
  edges: 'id, source, target, createdAt, relationshipType',
  tags: 'id, name, usageCount',
  wikilinks: 'id, sourceNoteId, targetNoteId, targetTitle, [sourceNoteId+targetTitle]' // Compound index for fast lookups
})
```

**Indexes Explanation**:
- `sourceNoteId`: Fast lookup of all wikilinks in a note
- `targetNoteId`: Fast backlinks queries
- `targetTitle`: Case-sensitive title matching
- `[sourceNoteId+targetTitle]`: Compound index prevents duplicate wikilinks in same note

#### 1.2 Migration Strategy
```typescript
// Add to db.ts
async function migrateToV5() {
  // Existing notes remain unchanged
  // New wikilinks table automatically created
  // No data migration needed (fresh feature)
}
```

---

### Phase 2: Tiptap Wikilink Extension

#### 2.1 Custom Node Extension
```typescript
// src/extensions/WikilinkExtension.ts
import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface WikilinkOptions {
  HTMLAttributes: Record<string, any>
  onNavigate: (noteId: string) => void
  onTriggerAutocomplete: (query: string, position: number) => void
  validateTarget: (title: string) => Promise<string | null> // Returns noteId or null
}

export const WikilinkExtension = Node.create<WikilinkOptions>({
  name: 'wikilink',
  
  group: 'inline',
  inline: true,
  
  atom: true, // Cannot split or edit inline
  
  addAttributes() {
    return {
      targetNoteId: {
        default: null,
      },
      targetTitle: {
        default: '',
      },
      exists: {
        default: true, // Whether target note exists
      }
    }
  },
  
  parseHTML() {
    return [
      {
        tag: 'span[data-type="wikilink"]',
      },
    ]
  },
  
  renderHTML({ node, HTMLAttributes }) {
    const exists = node.attrs.exists
    return [
      'span',
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        {
          'data-type': 'wikilink',
          'data-note-id': node.attrs.targetNoteId,
          'data-title': node.attrs.targetTitle,
          'class': `wikilink ${exists ? 'wikilink-exists' : 'wikilink-broken'}`,
        }
      ),
      `[[${node.attrs.targetTitle}]]`,
    ]
  },
  
  addProseMirrorPlugins() {
    return [
      // Plugin for click handling
      new Plugin({
        key: new PluginKey('wikilink-click'),
        props: {
          handleClick: (view, pos, event) => {
            const { schema } = view.state
            const coords = { left: event.clientX, top: event.clientY }
            const posAtCoords = view.posAtCoords(coords)
            
            if (!posAtCoords) return false
            
            const node = view.state.doc.nodeAt(posAtCoords.pos)
            if (node?.type.name === 'wikilink' && node.attrs.targetNoteId) {
              event.preventDefault()
              this.options.onNavigate(node.attrs.targetNoteId)
              return true
            }
            return false
          },
        },
      }),
      
      // Plugin for autocomplete triggering
      new Plugin({
        key: new PluginKey('wikilink-autocomplete'),
        state: {
          init: () => ({ active: false, query: '' }),
          apply: (tr, value) => {
            // Track typing of [[
            const { selection } = tr
            const { $from } = selection
            const textBefore = $from.parent.textBetween(
              Math.max(0, $from.parentOffset - 10),
              $from.parentOffset
            )
            
            // Check if user is typing inside [[...
            const wikilinkPattern = /\[\[([^\]]*?)$/
            const match = textBefore.match(wikilinkPattern)
            
            if (match) {
              return { active: true, query: match[1] }
            }
            return { active: false, query: '' }
          }
        },
        props: {
          decorations: (state) => {
            // Visual feedback for wikilink creation
            const { active, query } = this.getState(state)
            if (!active) return DecorationSet.empty
            
            // Highlight the [[ trigger
            // Implementation details...
            return DecorationSet.empty
          }
        }
      })
    ]
  },
  
  addInputRules() {
    return [
      // Convert [[Title]] text to wikilink node on Enter or space
      {
        find: /\[\[([^\]]+)\]\]/g,
        handler: async ({ state, range, match }) => {
          const title = match[1].trim()
          const noteId = await this.options.validateTarget(title)
          
          const { tr } = state
          const start = range.from
          const end = range.to
          
          tr.replaceWith(start, end, state.schema.nodes.wikilink.create({
            targetNoteId: noteId,
            targetTitle: title,
            exists: noteId !== null,
          }))
          
          return tr
        }
      }
    ]
  }
})
```

#### 2.2 Styling
```css
/* Add to src/index.css */

/* Wikilink base styles */
.wikilink {
  color: var(--color-primary-600);
  background-color: var(--color-primary-50);
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  border-bottom: 1px dotted var(--color-primary-400);
  transition: all 150ms ease;
  font-weight: 500;
}

.wikilink:hover {
  background-color: var(--color-primary-100);
  border-bottom-color: var(--color-primary-600);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
}

/* Broken wikilink (target doesn't exist) */
.wikilink-broken {
  color: var(--color-red-600);
  background-color: var(--color-red-50);
  border-bottom-color: var(--color-red-400);
}

.wikilink-broken:hover {
  background-color: var(--color-red-100);
}

/* Dark mode */
.dark .wikilink {
  color: var(--color-primary-400);
  background-color: var(--color-primary-900);
  border-bottom-color: var(--color-primary-600);
}

.dark .wikilink:hover {
  background-color: var(--color-primary-800);
}

.dark .wikilink-broken {
  color: var(--color-red-400);
  background-color: var(--color-red-900);
  border-bottom-color: var(--color-red-600);
}

.dark .wikilink-broken:hover {
  background-color: var(--color-red-800);
}
```

---

### Phase 3: Autocomplete System

#### 3.1 Autocomplete Component
```typescript
// src/components/WikilinkAutocomplete.tsx
import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import type { Note } from '@/types/note'

interface Position {
  top: number
  left: number
}

interface WikilinkAutocompleteProps {
  query: string
  position: Position
  onSelect: (note: Note) => void
  onClose: () => void
  excludeNoteId?: string // Don't suggest the current note
}

export function WikilinkAutocomplete({
  query,
  position,
  onSelect,
  onClose,
  excludeNoteId
}: WikilinkAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Search notes by title (case-insensitive)
  const suggestions = useLiveQuery(async () => {
    if (!query) {
      // Show recent notes
      return db.notes
        .orderBy('updatedAt')
        .reverse()
        .limit(10)
        .toArray()
    }
    
    // Filter by title match
    const allNotes = await db.notes.toArray()
    return allNotes
      .filter(note => 
        note.id !== excludeNoteId &&
        note.title.toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => {
        // Prioritize exact matches and starts-with
        const aTitle = a.title.toLowerCase()
        const bTitle = b.title.toLowerCase()
        const q = query.toLowerCase()
        
        if (aTitle === q && bTitle !== q) return -1
        if (bTitle === q && aTitle !== q) return 1
        if (aTitle.startsWith(q) && !bTitle.startsWith(q)) return -1
        if (bTitle.startsWith(q) && !aTitle.startsWith(q)) return 1
        
        return b.updatedAt.localeCompare(a.updatedAt)
      })
      .slice(0, 10)
  }, [query, excludeNoteId])
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!suggestions?.length) return
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(i => (i + 1) % suggestions.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(i => (i - 1 + suggestions.length) % suggestions.length)
          break
        case 'Enter':
          e.preventDefault()
          if (suggestions[selectedIndex]) {
            onSelect(suggestions[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [suggestions, selectedIndex, onSelect, onClose])
  
  // Auto-scroll selected item into view
  useEffect(() => {
    if (containerRef.current) {
      const selected = containerRef.current.children[selectedIndex] as HTMLElement
      selected?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])
  
  if (!suggestions?.length) {
    return (
      <div
        className="autocomplete-panel"
        style={{
          position: 'absolute',
          top: position.top,
          left: position.left,
        }}
      >
        <div className="text-sm text-gray-500 p-3">
          No notes found
        </div>
      </div>
    )
  }
  
  return (
    <div
      ref={containerRef}
      className="autocomplete-panel"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
      }}
    >
      {suggestions.map((note, index) => (
        <button
          key={note.id}
          className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(note)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="font-medium">{note.title}</div>
          {note.tags && note.tags.length > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              {note.tags.slice(0, 3).join(', ')}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
```

#### 3.2 Autocomplete Styles
```css
/* Add to src/index.css */

.autocomplete-panel {
  z-index: 1000;
  background: white;
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  max-height: 320px;
  overflow-y: auto;
  min-width: 280px;
  max-width: 400px;
}

.autocomplete-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 12px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background-color 100ms;
  border-bottom: 1px solid var(--color-gray-100);
}

.autocomplete-item:last-child {
  border-bottom: none;
}

.autocomplete-item:hover,
.autocomplete-item.selected {
  background-color: var(--color-primary-50);
}

.autocomplete-item.selected {
  border-left: 3px solid var(--color-primary-600);
}

/* Dark mode */
.dark .autocomplete-panel {
  background: var(--color-gray-800);
  border-color: var(--color-gray-700);
}

.dark .autocomplete-item {
  border-bottom-color: var(--color-gray-700);
}

.dark .autocomplete-item:hover,
.dark .autocomplete-item.selected {
  background-color: var(--color-primary-900);
}
```

---

### Phase 4: Integration with NoteEditor

#### 4.1 Updated NoteEditor Integration
```typescript
// Key changes to src/components/NoteEditor.tsx

import { WikilinkExtension } from '@/extensions/WikilinkExtension'
import { WikilinkAutocomplete } from '@/components/WikilinkAutocomplete'
import { db } from '@/lib/db'

export function NoteEditor({ note, onClose }: NoteEditorProps) {
  // ... existing state ...
  
  // New state for wikilinks
  const [autocompleteState, setAutocompleteState] = useState<{
    active: boolean
    query: string
    position: { top: number; left: number }
  } | null>(null)
  
  // Wikilink handlers
  const handleNavigateToNote = async (noteId: string) => {
    // Save current note first
    await handleSave(true)
    
    // Load and open the linked note
    const linkedNote = await db.notes.get(noteId)
    if (linkedNote) {
      setEditingNote(linkedNote)
      // OR: Navigate in-place by updating note state
    }
  }
  
  const validateWikilinkTarget = async (title: string): Promise<string | null> => {
    const notes = await db.notes.toArray()
    const match = notes.find(n => 
      n.title.toLowerCase() === title.toLowerCase()
    )
    return match?.id || null
  }
  
  const handleAutocompleteSelect = (selectedNote: Note) => {
    if (!editor) return
    
    // Insert wikilink node
    editor.chain()
      .focus()
      .insertContent({
        type: 'wikilink',
        attrs: {
          targetNoteId: selectedNote.id,
          targetTitle: selectedNote.title,
          exists: true,
        },
      })
      .run()
    
    // Close autocomplete
    setAutocompleteState(null)
    
    // Save wikilink to database
    saveWikilinkToDatabase(note.id, selectedNote.id, selectedNote.title)
  }
  
  const saveWikilinkToDatabase = async (
    sourceNoteId: string,
    targetNoteId: string,
    targetTitle: string
  ) => {
    const id = nanoid()
    await db.wikilinks.add({
      id,
      sourceNoteId,
      targetNoteId,
      targetTitle,
      position: 0, // Calculate actual position if needed
      createdAt: new Date().toISOString(),
      relationshipType: 'references',
    })
    
    // Also create canvas edge for visual representation
    await createCanvasEdge(sourceNoteId, targetNoteId, 'references')
  }
  
  // Tiptap Editor with Wikilink extension
  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
      ImageExtension,
      WikilinkExtension.configure({
        onNavigate: handleNavigateToNote,
        onTriggerAutocomplete: (query, position) => {
          // Calculate screen position for autocomplete
          const coords = editor.view.coordsAtPos(position)
          setAutocompleteState({
            active: true,
            query,
            position: {
              top: coords.bottom + 8,
              left: coords.left,
            },
          })
        },
        validateTarget: validateWikilinkTarget,
      }),
    ],
    // ... rest of editor config ...
  })
  
  return (
    <div className="note-editor">
      {/* ... existing UI ... */}
      
      <EditorContent editor={editor} />
      
      {/* Wikilink Autocomplete */}
      {autocompleteState?.active && (
        <WikilinkAutocomplete
          query={autocompleteState.query}
          position={autocompleteState.position}
          onSelect={handleAutocompleteSelect}
          onClose={() => setAutocompleteState(null)}
          excludeNoteId={note.id}
        />
      )}
    </div>
  )
}
```

---

### Phase 5: Synchronization with Canvas Edges

#### 5.1 Bidirectional Sync Strategy

**Problem**: Wikilinks and canvas edges represent the same connections but exist in different systems.

**Solution**: 
1. Wikilinks automatically create canvas edges
2. Canvas edges do NOT automatically create wikilinks (manual process)
3. Deleting a note updates both systems

```typescript
// src/lib/wikilink-sync.ts

import { db } from './db'
import { nanoid } from 'nanoid'
import type { WikiLink } from '@/types/wikilink'
import type { NoteEdge } from '@/types/edge'

/**
 * Create a canvas edge from a wikilink
 */
export async function syncWikilinkToEdge(wikilink: WikiLink): Promise<void> {
  // Check if edge already exists
  const existingEdge = await db.edges
    .where('[source+target]')
    .equals([wikilink.sourceNoteId, wikilink.targetNoteId!])
    .first()
  
  if (existingEdge) return // Already synced
  
  // Create new edge
  const edge: NoteEdge = {
    id: nanoid(),
    source: wikilink.sourceNoteId,
    target: wikilink.targetNoteId!,
    createdAt: new Date().toISOString(),
    relationshipType: wikilink.relationshipType || 'references',
    label: `[[${wikilink.targetTitle}]]`,
  }
  
  await db.edges.add(edge)
}

/**
 * Update all wikilinks when a note's title changes
 */
export async function updateWikilinksOnTitleChange(
  noteId: string,
  oldTitle: string,
  newTitle: string
): Promise<void> {
  // Find all wikilinks pointing to this note by old title
  const affectedLinks = await db.wikilinks
    .where('targetTitle')
    .equals(oldTitle)
    .toArray()
  
  // Update them
  for (const link of affectedLinks) {
    await db.wikilinks.update(link.id, {
      targetTitle: newTitle,
      targetNoteId: noteId,
    })
  }
}

/**
 * Clean up wikilinks when a note is deleted
 */
export async function cleanupWikilinksOnNoteDelete(noteId: string): Promise<void> {
  // Find all wikilinks in the deleted note
  const sourceLinks = await db.wikilinks
    .where('sourceNoteId')
    .equals(noteId)
    .toArray()
  
  // Find all wikilinks pointing to the deleted note
  const targetLinks = await db.wikilinks
    .where('targetNoteId')
    .equals(noteId)
    .toArray()
  
  // Delete source links entirely
  await db.wikilinks.bulkDelete(sourceLinks.map(l => l.id))
  
  // Mark target links as broken (targetNoteId = null)
  for (const link of targetLinks) {
    await db.wikilinks.update(link.id, {
      targetNoteId: null, // Broken link
    })
  }
}

/**
 * Scan note content for wikilinks and sync to database
 * Use when note is saved
 */
export async function scanAndSyncWikilinks(
  noteId: string,
  content: string
): Promise<void> {
  // Extract all [[Title]] patterns
  const wikilinkRegex = /\[\[([^\]]+)\]\]/g
  const matches = [...content.matchAll(wikilinkRegex)]
  
  // Get existing wikilinks for this note
  const existing = await db.wikilinks
    .where('sourceNoteId')
    .equals(noteId)
    .toArray()
  
  const existingTitles = new Set(existing.map(l => l.targetTitle))
  const foundTitles = new Set<string>()
  
  // Process each match
  for (const match of matches) {
    const title = match[1].trim()
    foundTitles.add(title)
    
    if (existingTitles.has(title)) continue // Already exists
    
    // Find target note
    const notes = await db.notes.toArray()
    const targetNote = notes.find(n => 
      n.title.toLowerCase() === title.toLowerCase()
    )
    
    // Create wikilink
    const wikilink: WikiLink = {
      id: nanoid(),
      sourceNoteId: noteId,
      targetNoteId: targetNote?.id || null,
      targetTitle: title,
      position: match.index || 0,
      createdAt: new Date().toISOString(),
      relationshipType: 'references',
    }
    
    await db.wikilinks.add(wikilink)
    
    // Sync to canvas if target exists
    if (targetNote) {
      await syncWikilinkToEdge(wikilink)
    }
  }
  
  // Remove wikilinks that no longer exist in content
  const toDelete = existing.filter(l => !foundTitles.has(l.targetTitle))
  await db.wikilinks.bulkDelete(toDelete.map(l => l.id))
}
```

---

### Phase 6: Visual Indicators & UX Enhancements

#### 6.1 Wikilink Count Badge
```typescript
// Add to note cards in Grid view (App.tsx)

const wikilinkCount = useLiveQuery(async () => {
  return db.wikilinks
    .where('sourceNoteId')
    .equals(note.id)
    .count()
}, [note.id])

// In note card JSX:
{wikilinkCount > 0 && (
  <div className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
    <LinkIcon className="w-3 h-3" />
    {wikilinkCount} links
  </div>
)}
```

#### 6.2 Hover Preview (Future Enhancement)
```typescript
// WikilinkHoverCard.tsx - Show preview on hover
// Implementation deferred to Phase 2
```

---

## Implementation Checklist

### Database Layer
- [ ] Create `WikiLink` interface type
- [ ] Add `wikilinks` table to database schema (version 5)
- [ ] Create compound indexes for fast queries
- [ ] Test database migrations

### Tiptap Extension
- [ ] Create `WikilinkExtension.ts` 
- [ ] Implement node rendering with proper attributes
- [ ] Add click handler for navigation
- [ ] Add input rules for `[[Title]]` detection
- [ ] Implement autocomplete trigger detection
- [ ] Style wikilinks (exists vs broken)

### Autocomplete System
- [ ] Create `WikilinkAutocomplete.tsx` component
- [ ] Implement note search by title
- [ ] Add keyboard navigation (arrows, Enter, Esc)
- [ ] Position autocomplete near cursor
- [ ] Style autocomplete dropdown

### NoteEditor Integration  
- [ ] Add WikilinkExtension to Tiptap config
- [ ] Implement navigation handler
- [ ] Implement autocomplete selection handler
- [ ] Add autocomplete overlay to render tree
- [ ] Handle edge cases (empty query, no matches)

### Synchronization
- [ ] Create `wikilink-sync.ts` utility functions
- [ ] Sync wikilinks → canvas edges on creation
- [ ] Update wikilinks when note titles change
- [ ] Clean up broken links on note deletion
- [ ] Scan and sync wikilinks on note save

### Testing & Polish
- [ ] Test wikilink creation with `[[Title]]`
- [ ] Test autocomplete with partial queries
- [ ] Test navigation by clicking wikilinks
- [ ] Test broken link styling (non-existent notes)
- [ ] Test keyboard shortcuts
- [ ] Test mobile responsiveness
- [ ] Performance test with 100+ notes

---

## Future Enhancements (Post-MVP)

### Phase 2: Advanced Features
1. **Hover Previews**: Show note content on wikilink hover
2. **Quick Create**: Create new note if wikilink target doesn't exist
3. **Aliases**: Support `[[Note Title|Display Text]]` syntax
4. **Block References**: Support `[[Note Title#heading]]` 
5. **Backlinks Panel**: Show incoming links (see BACKLINKS_PLAN.md)

### Phase 3: AI Integration
1. **Smart Suggestions**: AI suggests wikilinks while typing
2. **Auto-linking**: AI scans content and suggests connections
3. **Semantic Search**: Find related notes beyond title matching

---

## Technical Decisions & Rationale

### Why Tiptap Node (not Mark)?
- **Decision**: Implement wikilinks as `Node` (block-level element)
- **Rationale**: 
  - Nodes can be clicked atomically
  - Better separation from regular text
  - Easier to attach metadata (targetNoteId, exists status)
  - Consistent with how Obsidian/Notion handle links

### Why Separate Wikilinks Table?
- **Decision**: Don't merge with `edges` table
- **Rationale**:
  - Different use cases (text vs visual)
  - Different query patterns (by position vs source/target)
  - Allows wikilinks to exist without visual edges
  - Cleaner data model

### Why HTML Storage (not Markdown)?
- **Decision**: Keep using HTML for content storage
- **Rationale**:
  - Current system already uses HTML
  - Tiptap outputs HTML natively
  - Migration to Markdown is complex and risky
  - HTML preserves formatting better
  - Can still support `[[wikilinks]]` in HTML

---

## Performance Considerations

### Database Queries
- Compound indexes for O(log n) lookups
- Limit autocomplete results to 10 items
- Debounce autocomplete queries (150ms)

### Rendering
- Wikilinks render as atomic nodes (no re-parsing)
- Use CSS for styling (no JS-based rendering)
- Lazy-load autocomplete component

### Memory
- Store wikilinks separately from note content
- Use IndexedDB cursors for large datasets
- Clear autocomplete state on close

---

## Migration & Rollback Plan

### Safe Rollout
1. Deploy database schema update (version 5)
2. Feature flag: `ENABLE_WIKILINKS` (default: false)
3. Beta test with select users
4. Gradual rollout over 2 weeks
5. Monitor error rates and performance

### Rollback Strategy
- Feature flag can disable wikilinks instantly
- Database table can remain (no breaking changes)
- Existing canvas edges unaffected
- No data loss on rollback

---

## Success Metrics

### Adoption
- % of notes containing wikilinks (target: 40% after 1 month)
- Avg wikilinks per note (target: 2-3)
- Daily wikilink navigation events

### Performance
- Autocomplete response time < 100ms
- No editor lag when typing `[[`
- Database query time < 50ms

### Quality
- < 5% broken links (deleted note targets)
- Zero crashes related to wikilinks
- Positive user feedback on ease of use

---

## Dependencies

### NPM Packages (Already Installed)
- `@tiptap/react` - Editor framework
- `@tiptap/core` - Core functionality
- `@tiptap/pm` - ProseMirror integration
- `dexie` - IndexedDB wrapper
- `dexie-react-hooks` - React hooks for Dexie
- `nanoid` - ID generation

### No New Dependencies Required ✅

---

## Timeline Estimate

- **Week 1-2**: Database + Tiptap Extension
- **Week 2-3**: Autocomplete System  
- **Week 3-4**: NoteEditor Integration
- **Week 4-5**: Synchronization Logic
- **Week 5-6**: Testing & Polish

**Total: 6 weeks for full implementation**

---

## Next Steps

1. Review this plan with the team
2. Set up feature branch: `feature/wikilinks`
3. Create database migration script
4. Implement Phase 1 (Database Schema)
5. Begin Tiptap extension development

---

*Document Version: 1.0*  
*Last Updated: 2025-01-31*  
*Author: Kilo Code (Architect Mode)*