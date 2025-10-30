import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import type { Tag } from '@/types/tag'
import { Tag as TagIcon } from 'lucide-react'

interface TagDisplayProps {
  tagIds: string[]
  maxDisplay?: number
  className?: string
}

export function TagDisplay({ tagIds, maxDisplay = 3, className = '' }: TagDisplayProps) {
  const [tags, setTags] = useState<Tag[]>([])

  useEffect(() => {
    if (tagIds.length === 0) {
      setTags([])
      return
    }

    const loadTags = async () => {
      const tagsFromDb = await db.tags.bulkGet(tagIds)
      setTags(tagsFromDb.filter((t): t is Tag => t !== undefined))
    }

    loadTags()
  }, [tagIds])

  if (tags.length === 0) return null

  const displayTags = tags.slice(0, maxDisplay)
  const remainingCount = tags.length - maxDisplay

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {displayTags.map((tag) => (
        <span
          key={tag.id}
          className="tag text-xs"
        >
          <TagIcon className="w-3 h-3" />
          {tag.name}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200/50 dark:border-gray-700/50">
          +{remainingCount} more
        </span>
      )}
    </div>
  )
}