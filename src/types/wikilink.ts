export interface WikiLink {
  id: string
  sourceNoteId: string          // Note containing the wikilink
  targetNoteId: string | null   // Linked note ID (null if target doesn't exist)
  targetTitle: string           // Title used in [[Title]] syntax
  position: number              // Character offset in source content
  createdAt: string             // ISO timestamp
  relationshipType: string      // Default: 'references'
}