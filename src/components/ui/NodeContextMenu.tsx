import { useEffect, useRef, useState } from 'react'
import { Copy, Trash2, Edit, Link } from 'lucide-react'
import { db } from '@/lib/db'
import { NOTE_COLORS } from '@/types/note'
import type { NoteColorId } from '@/types/note'

interface NodeContextMenuProps {
  nodeId: string
  x: number
  y: number
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onCopy: () => void
  currentColor?: NoteColorId
  onColorChange?: (color: NoteColorId) => void
}

export function NodeContextMenu({
  nodeId,
  x,
  y,
  onClose,
  onEdit,
  onDelete,
  onCopy,
  currentColor = 'default',
  onColorChange
}: NodeContextMenuProps) {
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

  const handleCopyLink = async () => {
    try {
      const note = await db.notes.get(nodeId)
      if (note) {
        // Copy a wikilink reference with unique ID to prevent ambiguity
        // Format: [[Title|id]] - the ID ensures it links to the right note even with duplicate titles
        await navigator.clipboard.writeText(`[[${note.title}|${note.id}]]`)
        onClose()
      }
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  const menuItems = [
    {
      id: 'copy',
      label: 'Copy Note',
      icon: <Copy className="w-4 h-4" />,
      onClick: () => {
        onCopy()
        onClose()
      },
      shortcut: 'Ctrl+C'
    },
    {
      id: 'copy-link',
      label: 'Copy Link to Note',
      icon: <Link className="w-4 h-4" />,
      onClick: handleCopyLink,
      shortcut: ''
    },
    {
      id: 'edit',
      label: 'Open in Editor',
      icon: <Edit className="w-4 h-4" />,
      onClick: () => {
        onEdit()
        onClose()
      },
      shortcut: ''
    },
    {
      id: 'delete',
      label: 'Delete Note',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => {
        onDelete()
        onClose()
      },
      shortcut: 'Delete',
      danger: true
    }
  ]

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
          Note Actions
        </h4>
      </div>
      
      <div className="py-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`
              w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors
              ${item.danger 
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' 
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }
            `}
          >
            <div className={item.danger ? '' : 'text-gray-600 dark:text-gray-400'}>
              {item.icon}
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium">
                {item.label}
              </span>
            </div>
            {item.shortcut && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {item.shortcut}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Color picker - always visible */}
      {onColorChange && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 pb-1">
          <div className="px-3 py-2">
            <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Change Color
            </h5>
            <div className="grid grid-cols-5 gap-2.5">
              {Object.entries(NOTE_COLORS).map(([colorId, colorConfig]) => (
                <button
                  key={colorId}
                  onClick={() => {
                    onColorChange(colorId as NoteColorId)
                    onClose()
                  }}
                  className={`
                    w-10 h-10 rounded-lg transition-all duration-150
                    ${colorConfig.background}
                    border-2
                    ${currentColor === colorId ? colorConfig.border : 'border-gray-300 dark:border-gray-600'}
                    hover:scale-110 hover:shadow-lg
                    ${currentColor === colorId ? 'ring-2 ring-accent-500 ring-offset-2 dark:ring-offset-gray-900 scale-105' : ''}
                  `}
                  style={{
                    boxShadow: currentColor === colorId
                      ? '0 4px 12px rgba(0, 0, 0, 0.15)'
                      : '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}
                  title={colorId}
                  aria-label={`Set color to ${colorId}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}