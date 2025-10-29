import { useState, useEffect, useMemo } from 'react'
import { Search, X, Calendar } from 'lucide-react'
import type { Note } from '@/types/note'
import { db } from '@/lib/db'

interface SearchPanelProps {
  onClose: () => void
  onSelectNote: (note: Note) => void
}

export function SearchPanel({ onClose, onSelectNote }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Note[]>([])
  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')

  // Load all notes on mount
  useEffect(() => {
    const loadNotes = async () => {
      const notes = await db.notes.orderBy('updatedAt').reverse().toArray()
      setAllNotes(notes)
    }
    loadNotes()
  }, [])

  // Fuzzy match algorithm
  const fuzzyMatch = (text: string, pattern: string): boolean => {
    const textLower = text.toLowerCase()
    const patternLower = pattern.toLowerCase()
    
    // Exact match
    if (textLower.includes(patternLower)) return true
    
    // Fuzzy matching - check if pattern characters appear in order
    let patternIdx = 0
    for (let i = 0; i < textLower.length && patternIdx < patternLower.length; i++) {
      if (textLower[i] === patternLower[patternIdx]) {
        patternIdx++
      }
    }
    return patternIdx === patternLower.length
  }

  // Filter by date range
  const filterByDate = (note: Note): boolean => {
    if (dateFilter === 'all') return true
    
    const noteDate = new Date(note.updatedAt)
    const now = new Date()
    const dayInMs = 24 * 60 * 60 * 1000
    
    switch (dateFilter) {
      case 'today':
        return now.getTime() - noteDate.getTime() < dayInMs
      case 'week':
        return now.getTime() - noteDate.getTime() < 7 * dayInMs
      case 'month':
        return now.getTime() - noteDate.getTime() < 30 * dayInMs
      default:
        return true
    }
  }

  // Search with fuzzy matching
  const searchResults = useMemo(() => {
    if (!query.trim()) return allNotes.filter(filterByDate)
    
    return allNotes.filter(note => {
      if (!filterByDate(note)) return false
      
      const matchTitle = fuzzyMatch(note.title, query)
      const matchContent = fuzzyMatch(note.content, query)
      
      return matchTitle || matchContent
    })
  }, [query, allNotes, dateFilter])

  // Update results when search changes
  useEffect(() => {
    setResults(searchResults)
  }, [searchResults])

  // Highlight matching text
  const highlightText = (text: string, query: string): JSX.Element => {
    if (!query.trim()) return <>{text}</>
    
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const index = lowerText.indexOf(lowerQuery)
    
    if (index === -1) return <>{text}</>
    
    return (
      <>
        {text.substring(0, index)}
        <mark className="bg-yellow-200 dark:bg-yellow-800">{text.substring(index, index + query.length)}</mark>
        {text.substring(index + query.length)}
      </>
    )
  }

  // Get excerpt with match context
  const getExcerpt = (content: string, query: string, maxLength = 150): string => {
    if (!query.trim()) return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '')
    
    const lowerContent = content.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const index = lowerContent.indexOf(lowerQuery)
    
    if (index === -1) return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '')
    
    // Show context around the match
    const start = Math.max(0, index - 50)
    const end = Math.min(content.length, index + query.length + 100)
    const excerpt = (start > 0 ? '...' : '') + content.substring(start, end) + (end < content.length ? '...' : '')
    
    return excerpt
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Search Panel */}
      <div className="flex min-h-full items-start justify-center p-4 pt-20">
        <div 
          className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes..."
                autoFocus
                className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-lg placeholder-gray-400 dark:placeholder-gray-600"
              />
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close search"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Filters */}
            <div className="flex items-center gap-2 mt-3">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div className="flex gap-2">
                {(['all', 'today', 'week', 'month'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDateFilter(filter)}
                    className={`px-3 py-1 text-sm rounded ${
                      dateFilter === filter
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {filter === 'all' ? 'All time' : filter === 'today' ? 'Today' : filter === 'week' ? 'This week' : 'This month'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {results.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {query ? 'No notes found' : 'Start typing to search'}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                {results.map((note) => (
                  <li
                    key={note.id}
                    onClick={() => {
                      onSelectNote(note)
                      onClose()
                    }}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <h4 className="font-semibold mb-1">
                      {highlightText(note.title || 'Untitled', query)}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {new Date(note.updatedAt).toLocaleString()}
                    </p>
                    {note.content && (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {highlightText(getExcerpt(note.content, query), query)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-500 text-center">
            {results.length} {results.length === 1 ? 'note' : 'notes'} found
          </div>
        </div>
      </div>
    </div>
  )
}