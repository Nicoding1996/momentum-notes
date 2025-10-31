import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { FileText, Link2 } from 'lucide-react'
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
  excludeNoteId?: string
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
      selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])
  
  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])
  
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
        <div className="text-sm text-gray-500 dark:text-gray-400 p-3">
          {query ? `No notes found for "${query}"` : 'No notes available'}
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
        zIndex: 1000,
      }}
    >
      {suggestions.map((note, index) => (
        <button
          key={note.id}
          className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(note)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="flex items-start gap-3">
            <FileText className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                {highlightMatch(note.title, query)}
              </div>
              {note.tags && note.tags.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {note.tags.slice(0, 3).map(tag => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <ConnectionCount noteId={note.id} />
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

// Helper component to show connection count
function ConnectionCount({ noteId }: { noteId: string }) {
  const count = useLiveQuery(async () => {
    const incoming = await db.wikilinks.where('targetNoteId').equals(noteId).count()
    const outgoing = await db.wikilinks.where('sourceNoteId').equals(noteId).count()
    return incoming + outgoing
  }, [noteId])
  
  if (!count) return null
  
  return (
    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
      <Link2 className="w-3 h-3" />
      <span>{count} {count === 1 ? 'connection' : 'connections'}</span>
    </div>
  )
}

// Helper to highlight matching text
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  
  const parts = text.split(new RegExp(`(${query})`, 'gi'))
  
  return parts.map((part, index) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return (
        <mark
          key={index}
          className="bg-primary-200 dark:bg-primary-800 text-primary-900 dark:text-primary-100"
        >
          {part}
        </mark>
      )
    }
    return <span key={index}>{part}</span>
  })
}