import { db } from './db'
import type { ExportData, ImportResult, ImportPreview, ImportMode } from '@/types/export'

const CURRENT_VERSION = '1.0.0'
const APP_NAME = 'momentum-notes'

/**
 * Export all data from IndexedDB
 */
export async function exportAllData(): Promise<ExportData> {
  try {
    const notes = await db.notes.toArray()
    const edges = await db.edges.toArray()
    const tags = await db.tags.toArray()

    const exportData: ExportData = {
      version: CURRENT_VERSION,
      exported_at: new Date().toISOString(),
      app: APP_NAME,
      data: {
        notes,
        edges,
        tags,
      },
      metadata: {
        note_count: notes.length,
        edge_count: edges.length,
        tag_count: tags.length,
      },
    }

    return exportData
  } catch (error) {
    console.error('Export failed:', error)
    throw new Error(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Create and download JSON file
 */
export function downloadAsJSON(data: ExportData, filename?: string): void {
  try {
    const jsonStr = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename || `momentum-notes-backup-${new Date().toISOString().split('T')[0]}.json`
    
    document.body.appendChild(link)
    link.click()
    
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Download failed:', error)
    throw new Error('Failed to download file. Your browser may not support downloads.')
  }
}

/**
 * Validate export data structure
 */
export function validateExportData(data: unknown): data is ExportData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data: not an object')
  }

  const d = data as any

  // Check required top-level fields
  if (!d.version || typeof d.version !== 'string') {
    throw new Error('Invalid or missing version field')
  }

  if (!d.app || d.app !== APP_NAME) {
    throw new Error(`Invalid app field. Expected "${APP_NAME}", got "${d.app}"`)
  }

  if (!d.data || typeof d.data !== 'object') {
    throw new Error('Missing or invalid data field')
  }

  // Check data arrays
  if (!Array.isArray(d.data.notes)) {
    throw new Error('Invalid or missing notes array')
  }

  if (!Array.isArray(d.data.edges)) {
    throw new Error('Invalid or missing edges array')
  }

  if (!Array.isArray(d.data.tags)) {
    throw new Error('Invalid or missing tags array')
  }

  // Validate note structure
  for (const note of d.data.notes) {
    if (!note.id || typeof note.id !== 'string') {
      throw new Error('Invalid note: missing or invalid id')
    }
    if (!note.title || typeof note.title !== 'string') {
      throw new Error(`Invalid note ${note.id}: missing or invalid title`)
    }
    if (typeof note.content !== 'string') {
      throw new Error(`Invalid note ${note.id}: missing or invalid content`)
    }
    if (!note.createdAt || !note.updatedAt) {
      throw new Error(`Invalid note ${note.id}: missing timestamps`)
    }
  }

  // Validate edge structure
  for (const edge of d.data.edges) {
    if (!edge.id || typeof edge.id !== 'string') {
      throw new Error('Invalid edge: missing or invalid id')
    }
    if (!edge.source || typeof edge.source !== 'string') {
      throw new Error(`Invalid edge ${edge.id}: missing or invalid source`)
    }
    if (!edge.target || typeof edge.target !== 'string') {
      throw new Error(`Invalid edge ${edge.id}: missing or invalid target`)
    }
  }

  // Validate tag structure
  for (const tag of d.data.tags) {
    if (!tag.id || typeof tag.id !== 'string') {
      throw new Error('Invalid tag: missing or invalid id')
    }
    if (!tag.name || typeof tag.name !== 'string') {
      throw new Error(`Invalid tag ${tag.id}: missing or invalid name`)
    }
    if (typeof tag.usageCount !== 'number') {
      throw new Error(`Invalid tag ${tag.id}: missing or invalid usageCount`)
    }
  }

  return true
}

/**
 * Parse and validate imported JSON file
 */
export async function parseImportFile(file: File): Promise<ExportData> {
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    
    if (validateExportData(data)) {
      return data
    }
    
    throw new Error('Validation failed')
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('File is not valid JSON')
    }
    throw error
  }
}

/**
 * Preview import without committing
 */
export async function previewImport(data: ExportData): Promise<ImportPreview> {
  const existingNotes = await db.notes.toArray()
  const existingEdges = await db.edges.toArray()
  const existingTags = await db.tags.toArray()

  const existingNoteIds = new Set(existingNotes.map(n => n.id))
  const existingEdgeIds = new Set(existingEdges.map(e => e.id))
  const existingTagIds = new Set(existingTags.map(t => t.id))

  const newNotes = data.data.notes.filter(n => !existingNoteIds.has(n.id))
  const newEdges = data.data.edges.filter(e => !existingEdgeIds.has(e.id))
  const newTags = data.data.tags.filter(t => !existingTagIds.has(t.id))

  return {
    total_notes: data.data.notes.length,
    total_edges: data.data.edges.length,
    total_tags: data.data.tags.length,
    new_notes: newNotes.length,
    new_edges: newEdges.length,
    new_tags: newTags.length,
    existing_notes: data.data.notes.length - newNotes.length,
    existing_edges: data.data.edges.length - newEdges.length,
    existing_tags: data.data.tags.length - newTags.length,
  }
}

/**
 * Import data with specified strategy
 */
export async function importData(
  data: ExportData,
  mode: ImportMode
): Promise<ImportResult> {
  try {
    let notesAdded = 0
    let notesSkipped = 0
    let edgesAdded = 0
    let edgesSkipped = 0
    let tagsAdded = 0
    let tagsSkipped = 0

    if (mode === 'replace') {
      // Clear all existing data
      await db.transaction('rw', [db.notes, db.edges, db.tags], async () => {
        await db.notes.clear()
        await db.edges.clear()
        await db.tags.clear()
      })
    }

    // Import tags first (notes may reference them)
    for (const tag of data.data.tags) {
      const existing = await db.tags.get(tag.id)
      if (!existing || mode === 'replace') {
        await db.tags.put(tag)
        tagsAdded++
      } else {
        tagsSkipped++
      }
    }

    // Import notes
    for (const note of data.data.notes) {
      const existing = await db.notes.get(note.id)
      if (!existing || mode === 'replace') {
        await db.notes.put(note)
        notesAdded++
      } else {
        notesSkipped++
      }
    }

    // Import edges (validate that source/target notes exist)
    const noteIds = new Set((await db.notes.toArray()).map(n => n.id))
    
    for (const edge of data.data.edges) {
      // Validate foreign key relationships
      if (!noteIds.has(edge.source) || !noteIds.has(edge.target)) {
        console.warn(`Skipping edge ${edge.id}: source or target note doesn't exist`)
        edgesSkipped++
        continue
      }

      const existing = await db.edges.get(edge.id)
      if (!existing || mode === 'replace') {
        await db.edges.put(edge)
        edgesAdded++
      } else {
        edgesSkipped++
      }
    }

    // Recalculate tag usage counts
    await recalculateTagUsage()

    return {
      success: true,
      message: `Successfully imported ${notesAdded} notes, ${edgesAdded} connections, and ${tagsAdded} tags`,
      stats: {
        notes_added: notesAdded,
        notes_skipped: notesSkipped,
        edges_added: edgesAdded,
        edges_skipped: edgesSkipped,
        tags_added: tagsAdded,
        tags_skipped: tagsSkipped,
      },
    }
  } catch (error) {
    console.error('Import failed:', error)
    return {
      success: false,
      message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stats: {
        notes_added: 0,
        notes_skipped: 0,
        edges_added: 0,
        edges_skipped: 0,
        tags_added: 0,
        tags_skipped: 0,
      },
    }
  }
}

/**
 * Recalculate usage count for all tags
 */
async function recalculateTagUsage(): Promise<void> {
  const notes = await db.notes.toArray()
  const tags = await db.tags.toArray()

  const usageMap = new Map<string, number>()

  // Count tag usage
  for (const note of notes) {
    if (note.tags) {
      for (const tagId of note.tags) {
        usageMap.set(tagId, (usageMap.get(tagId) || 0) + 1)
      }
    }
  }

  // Update tags
  for (const tag of tags) {
    const count = usageMap.get(tag.id) || 0
    if (tag.usageCount !== count) {
      await db.tags.update(tag.id, { usageCount: count })
    }
  }
}

/**
 * Get current database statistics
 */
export async function getDatabaseStats() {
  const noteCount = await db.notes.count()
  const edgeCount = await db.edges.count()
  const tagCount = await db.tags.count()

  return {
    noteCount,
    edgeCount,
    tagCount,
  }
}

/**
 * Clear all data from database (with confirmation required from UI)
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.notes, db.edges, db.tags], async () => {
    await db.notes.clear()
    await db.edges.clear()
    await db.tags.clear()
  })
}