import { useState, useEffect, useMemo } from 'react'
import { Search, X, Calendar } from 'lucide-react'
import type { Note } from '@/types/note'
import type { Tag } from '@/types/tag'
import { db } from '@/lib/db'
import { TagDisplay } from '@/components/ui/TagDisplay'

interface SearchPanelProps {
  onClose: () => void
  onSelectNote: (note: Note) => void
}

export function SearchPanel({ onClose, onSelectNote }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Note[]>([])
  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null)

  // Recalculate tag usage counts based on actual notes
  const recalculateTagUsage = async () => {
    const notes = await db.notes.toArray()
    const tags = await db.tags.toArray()
    
    // Count actual usage for each tag
    const usageCounts = new Map<string, number>()
    notes.forEach(note => {
      if (note.tags && note.tags.length > 0) {
        note.tags.forEach(tagId => {
          usageCounts.set(tagId, (usageCounts.get(tagId) || 0) + 1)
        })
      }
    })
    
    // Update or delete tags based on actual usage
    for (const tag of tags) {
      const actualCount = usageCounts.get(tag.id) || 0
      
      if (actualCount === 0) {
        // Delete unused tags
        await db.tags.delete(tag.id)
      } else if (actualCount !== tag.usageCount) {
        // Update incorrect counts
        await db.tags.update(tag.id, { usageCount: actualCount })
      }
    }
  }

  // Load all notes and tags on mount
  useEffect(() => {
    const loadData = async () => {
      // First recalculate and cleanup tags
      await recalculateTagUsage()
      
      // Then load the cleaned data
      const notes = await db.notes.orderBy('updatedAt').reverse().toArray()
      const tags = await db.tags.toArray()
      
      // Only show tags that are actually being used
      const tagsInUse = tags.filter(tag => tag.usageCount > 0)
      setAllNotes(notes)
      setAllTags(tagsInUse)
    }
    loadData()
  }, [])

  // Enhanced search algorithm with scoring
  const searchMatch = (text: string, pattern: string): number => {
    const textLower = text.toLowerCase()
    const patternLower = pattern.toLowerCase()
    
    // Exact match gets highest score
    if (textLower === patternLower) return 100
    
    // Starts with pattern gets high score
    if (textLower.startsWith(patternLower)) return 90
    
    // Contains whole pattern gets good score
    if (textLower.includes(patternLower)) return 80
    
    // Word boundary match (pattern matches start of a word)
    const words = textLower.split(/\s+/)
    for (const word of words) {
      if (word.startsWith(patternLower)) return 70
      if (word.includes(patternLower)) return 60
    }
    
    // Fuzzy matching - pattern characters appear in order
    let patternIdx = 0
    for (let i = 0; i < textLower.length && patternIdx < patternLower.length; i++) {
      if (textLower[i] === patternLower[patternIdx]) {
        patternIdx++
      }
    }
    if (patternIdx === patternLower.length) return 40
    
    return 0
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

  // Search with enhanced scoring and ranking
  const searchResults = useMemo(() => {
    let filtered = allNotes.filter(filterByDate)
    
    // Apply tag filter if selected
    if (selectedTagFilter) {
      filtered = filtered.filter(note => note.tags?.includes(selectedTagFilter))
    }
    
    // Apply text search with scoring
    if (query.trim()) {
      const scoredNotes = filtered.map(note => {
        const titleScore = searchMatch(note.title, query)
        const contentScore = searchMatch(note.content, query)
        
        // Search tag names
        let tagScore = 0
        if (note.tags && note.tags.length > 0) {
          const noteTags = allTags.filter(tag => note.tags?.includes(tag.id))
          tagScore = Math.max(...noteTags.map(tag => searchMatch(tag.name, query)), 0)
        }
        
        const maxScore = Math.max(titleScore, contentScore, tagScore)
        return { note, score: maxScore }
      }).filter(item => item.score > 0)
      
      // Sort by score (highest first)
      scoredNotes.sort((a, b) => b.score - a.score)
      return scoredNotes.map(item => item.note)
    }
    
    return filtered
  }, [query, allNotes, allTags, dateFilter, selectedTagFilter])

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
            <div className="space-y-3 mt-4">
              {/* Date Filter */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Date Range</span>
                </div>
                <div className="flex gap-2 flex-wrap ml-6">
                  {(['all', 'today', 'week', 'month'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setDateFilter(filter)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        dateFilter === filter
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {filter === 'all' ? 'All time' : filter === 'today' ? 'Today' : filter === 'week' ? 'This week' : 'This month'}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Tag Filter */}
              {allTags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-4 h-4 flex items-center justify-center text-green-500 font-bold text-xs">#</span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Filter by Tags</span>
                  </div>
                  <div className="flex gap-2 flex-wrap ml-6">
                    <button
                      onClick={() => setSelectedTagFilter(null)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        selectedTagFilter === null
                          ? 'bg-green-500 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      All tags
                    </button>
                    {allTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => setSelectedTagFilter(tag.id)}
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                          selectedTagFilter === tag.id
                            ? 'bg-green-500 text-white shadow-sm'
                            : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30'
                        }`}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                    {note.tags && note.tags.length > 0 && (
                      <div className="mb-2">
                        <TagDisplay tagIds={note.tags} maxDisplay={3} />
                      </div>
                    )}
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