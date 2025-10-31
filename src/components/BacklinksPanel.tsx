import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { ChevronDown, ChevronRight, Link2 } from 'lucide-react'
import { useState } from 'react'
import type { Note } from '@/types/note'
import type { WikiLink } from '@/types/wikilink'
import { BacklinkItem } from './BacklinkItem'

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