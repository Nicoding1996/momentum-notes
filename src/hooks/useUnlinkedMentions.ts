import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import type { Note } from '@/types/note'

export interface UnlinkedMention {
  id: string
  sourceNote: Note
  contextSnippet: string
  position: number
}

interface UseUnlinkedMentionsOptions {
  currentNoteId: string
  currentNoteTitle: string
  enabled?: boolean
}

export function useUnlinkedMentions({
  currentNoteId,
  currentNoteTitle,
  enabled = true,
}: UseUnlinkedMentionsOptions) {
  const mentions = useLiveQuery(async (): Promise<UnlinkedMention[]> => {
    if (!enabled || !currentNoteTitle || currentNoteTitle.trim().length === 0) {
      return []
    }
    
    // Get all notes except the current one
    const allNotes = await db.notes
      .where('id')
      .notEqual(currentNoteId)
      .toArray()
    
    // Get existing wikilinks to filter them out
    const existingWikilinks = await db.wikilinks
      .where('targetTitle')
      .equals(currentNoteTitle)
      .toArray()
    
    // Create a set of source note IDs that already have wikilinks
    const notesWithWikilinks = new Set(
      existingWikilinks.map(link => link.sourceNoteId)
    )
    
    // Find unlinked mentions
    const mentionsList: UnlinkedMention[] = []
    
    for (const note of allNotes) {
      // Skip if this note already has a wikilink to current note
      if (notesWithWikilinks.has(note.id)) {
        continue
      }
      
      // Strip HTML to get plain text
      const plainText = stripHtml(note.content)
      
      // Find all occurrences of the title (case-insensitive)
      const mentions = findMentions(plainText, currentNoteTitle)
      
      // Add each mention to the list
      for (const mention of mentions) {
        mentionsList.push({
          id: `${note.id}-${mention.position}`,
          sourceNote: note,
          contextSnippet: mention.context,
          position: mention.position,
        })
      }
    }
    
    // Sort by most recently updated notes first
    return mentionsList.sort((a, b) => 
      b.sourceNote.updatedAt.localeCompare(a.sourceNote.updatedAt)
    )
  }, [currentNoteId, currentNoteTitle, enabled])
  
  return {
    mentions: mentions || [],
    isLoading: mentions === undefined,
  }
}

// Helper: Strip HTML tags from content
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Helper: Find all mentions of a title in text
function findMentions(
  text: string,
  title: string,
  contextLength: number = 60
): Array<{ position: number; context: string }> {
  const mentions: Array<{ position: number; context: string }> = []
  const lowerText = text.toLowerCase()
  const lowerTitle = title.toLowerCase()
  
  let position = 0
  while ((position = lowerText.indexOf(lowerTitle, position)) !== -1) {
    // Extract context around the mention
    const start = Math.max(0, position - contextLength)
    const end = Math.min(text.length, position + title.length + contextLength)
    
    let context = text.slice(start, end)
    
    // Add ellipsis
    if (start > 0) context = '...' + context
    if (end < text.length) context = context + '...'
    
    mentions.push({
      position,
      context: context.trim(),
    })
    
    // Move past this occurrence
    position += title.length
  }
  
  return mentions
}