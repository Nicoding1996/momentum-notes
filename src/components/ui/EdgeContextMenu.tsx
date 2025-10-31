import { useEffect, useRef, useState } from 'react'
import { RELATIONSHIP_TYPES } from '@/types/edge'
import { db } from '@/lib/db'

interface EdgeContextMenuProps {
  edgeId: string
  x: number
  y: number
  currentType?: string
  onClose: () => void
  onTypeChange: (type: string) => void
}

export function EdgeContextMenu({ 
  edgeId, 
  x, 
  y, 
  currentType = 'related-to',
  onClose,
  onTypeChange 
}: EdgeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x, y })

  // Adjust position if menu would go off-screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let adjustedX = x
      let adjustedY = y

      // Adjust horizontal position
      if (x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10
      }

      // Adjust vertical position
      if (y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10
      }

      setPosition({ x: adjustedX, y: adjustedY })
    }
  }, [x, y])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const handleTypeSelect = async (typeId: string) => {
    try {
      const type = RELATIONSHIP_TYPES[typeId as keyof typeof RELATIONSHIP_TYPES]
      
      await db.edges.update(edgeId, {
        relationshipType: typeId,
        label: type?.label,
      })

      onTypeChange(typeId)
      onClose()
    } catch (error) {
      console.error('Failed to update relationship type:', error)
    }
  }

  const handleDelete = async () => {
    try {
      await db.edges.delete(edgeId)
      onClose()
    } catch (error) {
      console.error('Failed to delete edge:', error)
    }
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[60] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 min-w-[240px] animate-scale-in"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Change Relationship Type
        </h4>
      </div>
      
      <div className="py-1">
        {Object.values(RELATIONSHIP_TYPES).map((type) => (
          <button
            key={type.id}
            onClick={() => handleTypeSelect(type.id)}
            className={`
              w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors
              ${currentType === type.id 
                ? 'bg-accent-50 dark:bg-accent-900/20' 
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }
            `}
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: type.color }}
            />
            <div className="flex-1 min-w-0">
              <div className={`
                text-sm font-medium 
                ${currentType === type.id 
                  ? 'text-accent-700 dark:text-accent-400' 
                  : 'text-gray-900 dark:text-gray-100'
                }
              `}>
                {type.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {type.description}
              </div>
            </div>
            {currentType === type.id && (
              <div className="w-2 h-2 rounded-full bg-accent-500 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-1 pb-1 mt-1">
        <button
          onClick={handleDelete}
          className="w-full text-left px-3 py-2.5 flex items-center gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="text-sm font-medium">Delete Connection</span>
        </button>
      </div>
    </div>
  )
}