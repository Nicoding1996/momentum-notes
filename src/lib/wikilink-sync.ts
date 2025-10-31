import { db } from './db'
import { nanoid } from 'nanoid'
import type { WikiLink } from '@/types/wikilink'
import type { NoteEdge } from '@/types/edge'

/**
 * Create a canvas edge from a wikilink
 */
export async function syncWikilinkToEdge(wikilink: WikiLink): Promise<void> {
  if (!wikilink.targetNoteId) return // Can't create edge for broken links
  
  // Check if edge already exists
  const existingEdge = await db.edges
    .where('source')
    .equals(wikilink.sourceNoteId)
    .and(edge => edge.target === wikilink.targetNoteId)
    .first()
  
  if (existingEdge) return // Already synced
  
  // Create new edge
  const edge: NoteEdge = {
    id: nanoid(),
    source: wikilink.sourceNoteId,
    target: wikilink.targetNoteId,
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
  if (toDelete.length > 0) {
    await db.wikilinks.bulkDelete(toDelete.map(l => l.id))
  }
}

/**
 * Find note by title (case-insensitive)
 */
export async function findNoteByTitle(title: string): Promise<string | null> {
  const notes = await db.notes.toArray()
  const match = notes.find(n => 
    n.title.toLowerCase() === title.toLowerCase()
  )
  return match?.id || null
}