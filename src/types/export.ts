import type { Note } from './note'
import type { NoteEdge } from './edge'
import type { Tag } from './tag'

export interface ExportData {
  version: string
  exported_at: string
  app: string
  data: {
    notes: Note[]
    edges: NoteEdge[]
    tags: Tag[]
  }
  metadata: {
    note_count: number
    edge_count: number
    tag_count: number
  }
}

export interface ImportResult {
  success: boolean
  message: string
  stats: {
    notes_added: number
    notes_skipped: number
    edges_added: number
    edges_skipped: number
    tags_added: number
    tags_skipped: number
  }
}

export interface ImportPreview {
  total_notes: number
  total_edges: number
  total_tags: number
  new_notes: number
  new_edges: number
  new_tags: number
  existing_notes: number
  existing_edges: number
  existing_tags: number
}

export type ImportMode = 'merge' | 'replace'