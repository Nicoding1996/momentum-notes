# Wikilink Implementation Summary

## Overview
This document summarizes the implementation of `[[Wikilink]]` syntax in Synapse Notes, a foundational feature for creating a true knowledge graph. This enables users to create links between notes inline while writing, dramatically improving workflow efficiency.

## Architecture

### 1. Database Schema
A new `wikilinks` table was added to the IndexedDB schema to track all wikilink instances.

```typescript
// src/lib/db.ts
db.version(5).stores({
  // ...
  wikilinks: 'id, sourceNoteId, targetNoteId, targetTitle, [sourceNoteId+targetTitle]'
});

// src/types/wikilink.ts
export interface WikiLink {
  id: string;
  sourceNoteId: string;
  targetNoteId: string | null; // Null if link is broken
  targetTitle: string;
  position: number; // Character position in source note
  createdAt: string;
  relationshipType: string; // Default to 'references'
}
```

### 2. Tiptap Custom Extension
A custom Tiptap extension (`src/extensions/WikilinkExtension.ts`) was created to handle the `[[Wikilink]]` syntax. It is responsible for parsing, rendering, and applying input/paste rules.

### 3. Autocomplete System
An autocomplete dropdown (`src/components/WikilinkAutocomplete.tsx`) appears when a user types `[[`, providing fuzzy search on note titles and allowing for the creation of new notes.

### 4. Synchronization with Canvas Edges
A synchronization mechanism (`src/lib/wikilink-sync.ts`) was implemented to keep wikilinks and canvas edges in sync, ensuring that a wikilink created in the editor is reflected as a visual edge on the canvas, and vice versa.

---

## Component Implementation

### 1. `WikilinkExtension.ts`
A Tiptap extension that recognizes `[[...]]` syntax and renders it as a custom React node.

### 2. `WikilinkNode.tsx`
A React component that renders the wikilink, with different styling for existing and broken links, and handles click-to-navigate functionality.

### 3. `WikilinkAutocomplete.tsx`
A React component that provides a list of note suggestions based on the user's query, with keyboard and mouse navigation.

---

## User Experience Flow

### Creating a Link
When a user types `[[`, an autocomplete menu appears. Selecting a note from the list or typing a new note title and pressing Enter creates a styled wikilink. In the background, an entry is created in the `wikilinks` table, and a corresponding edge is created on the canvas.

### Clicking a Link
Clicking a wikilink opens the target note in the editor. The backlinks panel in the target note will show the original note.

### Broken Links
If a wikilink points to a note that doesn't exist, it is styled differently. Clicking a broken link creates a new note with that title and opens it in the editor.

---

## Implementation Checklist

- [x] Create `wikilinks` table schema.
- [x] Create `WikilinkExtension.ts` and `WikilinkNode.tsx`.
- [x] Add input rule for `[[`.
- [x] Implement click-to-navigate.
- [x] Create `WikilinkAutocomplete.tsx` with fuzzy search.
- [x] Implement `syncWikilinkToEdge` and `syncEdgeToWikilink`.
- [x] Add styling for existing vs broken links, hover effects, and responsive behavior.

---

*Document Version: 1.0*
*Last Updated: 2025-10-31*