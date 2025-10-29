import { useState, useEffect, useRef } from 'react'
import { X, Plus } from 'lucide-react'
import { db } from '@/lib/db'
import { nanoid } from 'nanoid'
import type { Tag } from '@/types/tag'

interface TagInputProps {
  tags: string[] // Array of tag IDs
  onChange: (tags: string[]) => void
  placeholder?: string
}

export function TagInput({ tags, onChange, placeholder = 'Add tags...' }: TagInputProps) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<Tag[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Load all tags from database
  useEffect(() => {
    loadTags()
  }, [])

  // Load selected tags details
  useEffect(() => {
    loadSelectedTags()
  }, [tags])

  // Filter suggestions based on input
  useEffect(() => {
    if (input.trim()) {
      const filtered = allTags.filter(
        (tag) =>
          tag.name.toLowerCase().includes(input.toLowerCase()) &&
          !tags.includes(tag.id)
      )
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [input, allTags, tags])

  const loadTags = async () => {
    const tagsFromDb = await db.tags.toArray()
    setAllTags(tagsFromDb)
  }

  const loadSelectedTags = async () => {
    if (tags.length === 0) {
      setSelectedTags([])
      return
    }
    const tagsFromDb = await db.tags.bulkGet(tags)
    setSelectedTags(tagsFromDb.filter((t): t is Tag => t !== undefined))
  }

  const createTag = async (name: string): Promise<Tag> => {
    const tagName = name.trim().toLowerCase()
    
    // Check if tag already exists
    const existing = allTags.find((t) => t.name.toLowerCase() === tagName)
    if (existing) {
      return existing
    }

    // Create new tag
    const newTag: Tag = {
      id: nanoid(),
      name: tagName,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    }

    await db.tags.add(newTag)
    setAllTags([...allTags, newTag])
    return newTag
  }

  const addTag = async (tag: Tag) => {
    if (tags.includes(tag.id)) return

    // Update tag usage count
    await db.tags.update(tag.id, {
      usageCount: tag.usageCount + 1,
    })

    onChange([...tags, tag.id])
    setInput('')
    setShowSuggestions(false)
    loadTags() // Reload to get updated usage counts
  }

  const removeTag = async (tagId: string) => {
    // Update tag usage count
    const tag = allTags.find((t) => t.id === tagId)
    if (tag) {
      const newCount = tag.usageCount - 1
      
      if (newCount <= 0) {
        // Delete tag if no longer used by any notes
        await db.tags.delete(tagId)
      } else {
        // Update usage count
        await db.tags.update(tagId, {
          usageCount: newCount,
        })
      }
    }

    onChange(tags.filter((id) => id !== tagId))
    loadTags() // Reload to get updated usage counts
  }

  const handleInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault()
      
      // If there are suggestions, use the first one
      if (suggestions.length > 0) {
        await addTag(suggestions[0])
      } else {
        // Create new tag
        const newTag = await createTag(input)
        await addTag(newTag)
      }
    } else if (e.key === 'Backspace' && !input && selectedTags.length > 0) {
      // Remove last tag when backspace is pressed on empty input
      await removeTag(selectedTags[selectedTags.length - 1].id)
    }
  }

  const handleSuggestionClick = async (tag: Tag) => {
    await addTag(tag)
    inputRef.current?.focus()
  }

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
        {/* Display selected tags */}
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-md"
          >
            {tag.name}
            <button
              onClick={() => removeTag(tag.id)}
              className="ml-1 hover:bg-primary-200 dark:hover:bg-primary-800 rounded-full p-0.5"
              aria-label={`Remove ${tag.name} tag`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Input field */}
        <div className="flex-1 min-w-[120px]">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onFocus={() => input.trim() && setShowSuggestions(suggestions.length > 0)}
            placeholder={selectedTags.length === 0 ? placeholder : ''}
            className="w-full bg-transparent border-none outline-none focus:ring-0 text-sm placeholder-gray-400 dark:placeholder-gray-600"
          />
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg max-h-48 overflow-y-auto"
        >
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleSuggestionClick(tag)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
            >
              <span>{tag.name}</span>
              <span className="ml-auto text-xs text-gray-500">
                {tag.usageCount} {tag.usageCount === 1 ? 'note' : 'notes'}
              </span>
            </button>
          ))}
          {input.trim() && !suggestions.some((s) => s.name.toLowerCase() === input.toLowerCase()) && (
            <div className="px-3 py-2 text-sm text-gray-500 border-t border-gray-200 dark:border-gray-800 flex items-center gap-2">
              <Plus className="w-3 h-3" />
              Press Enter to create "{input.trim().toLowerCase()}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}