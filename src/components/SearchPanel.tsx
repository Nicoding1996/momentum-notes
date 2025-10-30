import { useState, useEffect, useMemo } from 'react'
import { Search, X, Calendar, Tag as TagIcon, Sparkles } from 'lucide-react'
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

  // Recalculate tag usage counts
  const recalculateTagUsage = async () => {
    const notes = await db.notes.toArray()
    const tags = await db.tags.toArray()
    
    const usageCounts = new Map<string, number>()
    notes.forEach(note => {
      if (note.tags && note.tags.length > 0) {
        note.tags.forEach(tagId => {
          usageCounts.set(tagId, (usageCounts.get(tagId) || 0) + 1)
        })
      }
    })
    
    for (const tag of tags) {
      const actualCount = usageCounts.get(tag.id) || 0
      
      if (actualCount === 0) {
        await db.tags.delete(tag.id)
      } else if (actualCount !== tag.usageCount) {
        await db.tags.update(tag.id, { usageCount: actualCount })
      }
    }
  }

  // Load all notes and tags
  useEffect(() => {
    const loadData = async () => {
      await recalculateTagUsage()
      
      const notes = await db.notes.orderBy('updatedAt').reverse().toArray()
      const tags = await db.tags.toArray()
      
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
    
    if (textLower === patternLower) return 100
    if (textLower.startsWith(patternLower)) return 90
    if (textLower.includes(patternLower)) return 80
    
    const words = textLower.split(/\s+/)
    for (const word of words) {
      if (word.startsWith(patternLower)) return 70
      if (word.includes(patternLower)) return 60
    }
    
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
    
    if (selectedTagFilter) {
      filtered = filtered.filter(note => note.tags?.includes(selectedTagFilter))
    }
    
    if (query.trim()) {
      const scoredNotes = filtered.map(note => {
        const titleScore = searchMatch(note.title, query)
        const contentScore = searchMatch(note.content, query)
        
        let tagScore = 0
        if (note.tags && note.tags.length > 0) {
          const noteTags = allTags.filter(tag => note.tags?.includes(tag.id))
          tagScore = Math.max(...noteTags.map(tag => searchMatch(tag.name, query)), 0)
        }
        
        const maxScore = Math.max(titleScore, contentScore, tagScore)
        return { note, score: maxScore }
      }).filter(item => item.score > 0)
      
      scoredNotes.sort((a, b) => b.score - a.score)
      return scoredNotes.map(item => item.note)
    }
    
    return filtered
  }, [query, allNotes, allTags, dateFilter, selectedTagFilter])

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
        <mark className="bg-primary-200 dark:bg-primary-800/50 text-primary-900 dark:text-primary-100 px-1 rounded">{text.substring(index, index + query.length)}</mark>
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
    
    const start = Math.max(0, index - 50)
    const end = Math.min(content.length, index + query.length + 100)
    const excerpt = (start > 0 ? '...' : '') + content.substring(start, end) + (end < content.length ? '...' : '')
    
    return excerpt
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto animate-in">
      {/* Backdrop */}
      <div
        className="modal-backdrop"
        onClick={onClose}
      />

      {/* Search Panel */}
      <div className="flex min-h-full items-start justify-center p-4 pt-24">
        <div
          className="modal w-full max-w-3xl animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="p-6 border-b border-gray-200/60 dark:border-gray-800/60">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-primary-100 dark:bg-primary-900/20 rounded-xl">
                <Search className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes by title, content, or tags..."
                autoFocus
                className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-xl placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 font-medium"
              />
              <button
                onClick={onClose}
                className="btn-icon"
                aria-label="Close search"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Filters */}
            <div className="space-y-5">
              {/* Date Filter */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-accent-100 dark:bg-accent-900/20 rounded-lg">
                    <Calendar className="w-4 h-4 text-accent-600 dark:text-accent-400" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 tracking-tight">Time Range</span>
                </div>
                <div className="flex gap-2 flex-wrap ml-8">
                  {(['all', 'today', 'week', 'month'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setDateFilter(filter)}
                      className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                        dateFilter === filter
                          ? 'bg-gradient-to-br from-accent-600 to-accent-700 text-white shadow-sm'
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
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-success-100 dark:bg-success-900/20 rounded-lg">
                      <TagIcon className="w-4 h-4 text-success-600 dark:text-success-400" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 tracking-tight">Filter by Tags</span>
                  </div>
                  <div className="flex gap-2 flex-wrap ml-8">
                    <button
                      onClick={() => setSelectedTagFilter(null)}
                      className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                        selectedTagFilter === null
                          ? 'bg-gradient-to-br from-success-600 to-success-700 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      All tags
                    </button>
                    {allTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => setSelectedTagFilter(tag.id)}
                        className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                          selectedTagFilter === tag.id
                            ? 'bg-gradient-to-br from-success-600 to-success-700 text-white shadow-sm'
                            : 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 hover:bg-success-100 dark:hover:bg-success-900/30 border border-success-200/50 dark:border-success-800/50'
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
          <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
            {results.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  {query ? 'No notes found matching your search' : 'Start typing to search your notes'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200/60 dark:divide-gray-800/60">
                {results.map((note) => (
                  <li
                    key={note.id}
                    onClick={() => {
                      onSelectNote(note)
                      onClose()
                    }}
                    className="p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-all group border-l-4 border-transparent hover:border-primary-500"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-base text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {highlightText(note.title || 'Untitled', query)}
                      </h4>
                      <Sparkles className="w-4 h-4 text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-medium">
                      {new Date(note.updatedAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {note.tags && note.tags.length > 0 && (
                      <div className="mb-3">
                        <TagDisplay tagIds={note.tags} maxDisplay={3} />
                      </div>
                    )}
                    {note.content && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {highlightText(getExcerpt(note.content, query), query)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200/60 dark:border-gray-800/60 text-sm text-center bg-gradient-to-r from-transparent via-gray-50/50 to-transparent dark:via-gray-900/50">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{results.length}</span>
            <span className="text-gray-500 dark:text-gray-400 ml-1">
              {results.length === 1 ? 'note found' : 'notes found'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}