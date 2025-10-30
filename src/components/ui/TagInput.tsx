import { useState, useEffect, useRef } from 'react'
import { X, Plus, Tag as TagIcon } from 'lucide-react'
import { db } from '@/lib/db'
import { nanoid } from 'nanoid'
import type { Tag } from '@/types/tag'

interface TagInputProps {
  tags: string[]
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

  useEffect(() => {
    loadTags()
  }, [])

  useEffect(() => {
    loadSelectedTags()
  }, [tags])

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
    
    const existing = allTags.find((t) => t.name.toLowerCase() === tagName)
    if (existing) {
      return existing
    }

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

    await db.tags.update(tag.id, {
      usageCount: tag.usageCount + 1,
    })

    onChange([...tags, tag.id])
    setInput('')
    setShowSuggestions(false)
    loadTags()
  }

  const removeTag = async (tagId: string) => {
    const tag = allTags.find((t) => t.id === tagId)
    if (tag) {
      const newCount = tag.usageCount - 1
      
      if (newCount <= 0) {
        await db.tags.delete(tagId)
      } else {
        await db.tags.update(tagId, {
          usageCount: newCount,
        })
      }
    }

    onChange(tags.filter((id) => id !== tagId))
    loadTags()
  }

  const handleInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault()
      
      if (suggestions.length > 0) {
        await addTag(suggestions[0])
      } else {
        const newTag = await createTag(input)
        await addTag(newTag)
      }
    } else if (e.key === 'Backspace' && !input && selectedTags.length > 0) {
      await removeTag(selectedTags[selectedTags.length - 1].id)
    }
  }

  const handleSuggestionClick = async (tag: Tag) => {
    await addTag(tag)
    inputRef.current?.focus()
  }

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
      <div className="flex flex-wrap gap-2 p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus-within:ring-2 focus-within:ring-primary-500/50 focus-within:border-primary-500 transition-all">
        {/* Display selected tags */}
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="tag group"
          >
            <TagIcon className="w-3 h-3" />
            {tag.name}
            <button
              onClick={() => removeTag(tag.id)}
              className="ml-1 hover:bg-primary-200 dark:hover:bg-primary-800 rounded-full p-0.5 transition-colors"
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
            className="w-full bg-transparent border-none outline-none focus:ring-0 text-sm placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-10 w-full mt-2 modal max-h-60 overflow-y-auto custom-scrollbar p-2"
        >
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleSuggestionClick(tag)}
              className="w-full px-4 py-3 text-left text-sm rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center group-hover:bg-primary-200 dark:group-hover:bg-primary-900/30 transition-colors">
                  <TagIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">{tag.name}</span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {tag.usageCount} {tag.usageCount === 1 ? 'note' : 'notes'}
              </span>
            </button>
          ))}
          {input.trim() && !suggestions.some((s) => s.name.toLowerCase() === input.toLowerCase()) && (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 flex items-center gap-3 mt-2 pt-3">
              <div className="w-8 h-8 rounded-lg bg-success-100 dark:bg-success-900/20 flex items-center justify-center">
                <Plus className="w-4 h-4 text-success-600 dark:text-success-400" />
              </div>
              <div>
                <div className="font-medium text-gray-700 dark:text-gray-300">Create new tag</div>
                <div className="text-xs">Press Enter to create "{input.trim().toLowerCase()}"</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}