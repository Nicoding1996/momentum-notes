import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import type { Tag } from '@/types/tag'

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
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {displayTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded"
        >
          {tag.name}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
          +{remainingCount}
        </span>
      )}
    </div>
  )
}