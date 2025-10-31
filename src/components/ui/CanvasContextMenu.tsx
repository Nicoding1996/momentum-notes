import { useEffect, useRef, useState } from 'react'
import { Plus, Clipboard, ZoomIn } from 'lucide-react'

interface CanvasContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onCreateNote: () => void
  onPaste: () => void
  onZoomToFit: () => void
  hasCopiedNote: boolean
}

export function CanvasContextMenu({ 
  x, 
  y,
  onClose,
  onCreateNote,
  onPaste,
  onZoomToFit,
  hasCopiedNote
}: CanvasContextMenuProps) {
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

  const menuItems = [
    {
      id: 'create',
      label: 'Create New Note',
      icon: <Plus className="w-4 h-4" />,
      onClick: () => {
        onCreateNote()
        onClose()
      },
      shortcut: ''
    },
    {
      id: 'paste',
      label: 'Paste Note',
      icon: <Clipboard className="w-4 h-4" />,
      onClick: () => {
        onPaste()
        onClose()
      },
      shortcut: 'Ctrl+V',
      disabled: !hasCopiedNote
    },
    {
      id: 'zoom',
      label: 'Zoom to Fit All',
      icon: <ZoomIn className="w-4 h-4" />,
      onClick: () => {
        onZoomToFit()
        onClose()
      },
      shortcut: ''
    }
  ]

  return (
    <div
      ref={menuRef}
      className="fixed z-[60] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 min-w-[220px] animate-scale-in"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Canvas Actions
        </h4>
      </div>
      
      <div className="py-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            disabled={item.disabled}
            className={`
              w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors
              ${item.disabled 
                ? 'opacity-40 cursor-not-allowed' 
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }
            `}
          >
            <div className="text-gray-600 dark:text-gray-400">
              {item.icon}
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
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
    </div>
  )
}