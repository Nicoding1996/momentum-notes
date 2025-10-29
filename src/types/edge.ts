export interface NoteEdge {
  id: string;
  source: string; // Source note ID
  target: string; // Target note ID
  createdAt: string; // ISO date
  label?: string; // Optional label for the connection
  relationshipType?: string; // Type of relationship (e.g., "related-to", "depends-on")
}

// Predefined relationship types for the knowledge graph
export const RELATIONSHIP_TYPES = {
  RELATED_TO: { id: 'related-to', label: 'Related to', color: '#3b82f6', description: 'General semantic relationship' },
  DEPENDS_ON: { id: 'depends-on', label: 'Depends on', color: '#ef4444', description: 'One note depends on another' },
  PART_OF: { id: 'part-of', label: 'Part of', color: '#10b981', description: 'One note is part of another' },
  SUPPORTS: { id: 'supports', label: 'Supports', color: '#f59e0b', description: 'One note supports another' },
  CONTRADICTS: { id: 'contradicts', label: 'Contradicts', color: '#8b5cf6', description: 'One note contradicts another' },
  REFERENCES: { id: 'references', label: 'References', color: '#06b6d4', description: 'One note references another' },
} as const;

export type RelationshipTypeId = keyof typeof RELATIONSHIP_TYPES | string;