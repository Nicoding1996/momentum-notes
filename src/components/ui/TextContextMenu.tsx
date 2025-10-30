import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, FileText, Wand2, Loader2 } from 'lucide-react'

interface ContextMenuAction {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  onClick: () => void | Promise<void>
  disabled?: boolean
}

interface TextContextMenuProps {
  x: number
  y: number
  isOpen: boolean
  onClose: () => void
  selectedText: string
  onExpand: () => Promise<void>
  onSummarize: () => Promise<void>
  onImprove: () => Promise<void>
  isLoading?: boolean
}

export function TextContextMenu({
  x,
  y,
  isOpen,
  onClose,
  selectedText,
  onExpand,
  onSummarize,
  onImprove,
  isLoading = false
}: TextContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  const actions: ContextMenuAction[] = [
    {
      id: 'expand',
      label: 'Expand',
      description: 'Expand selected text',
      icon: <Sparkles className="w-4 h-4" />,
      onClick: onExpand,
      disabled: !selectedText.trim() || isLoading
    },
    {
      id: 'summarize',
      label: 'Summarize',
      description: 'Summarize selected text',
      icon: <FileText className="w-4 h-4" />,
      onClick: onSummarize,
      disabled: !selectedText.trim() || isLoading
    },
    {
      id: 'improve',
      label: 'Improve',
      description: 'Enhance selected text',
      icon: <Wand2 className="w-4 h-4" />,
      onClick: onImprove,
      disabled: !selectedText.trim() || isLoading
    }
  ]

  // Calculate smart positioning to keep menu in viewport
  useEffect(() => {
    if (!isOpen || !menuRef.current) return

    const menu = menuRef.current
    const menuRect = menu.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let adjustedX = x
    let adjustedY = y

    // Adjust horizontal position if menu would overflow right edge
    if (adjustedX + menuRect.width > viewportWidth) {
      adjustedX = viewportWidth - menuRect.width - 16
    }

    // Adjust vertical position if menu would overflow bottom edge
    if (adjustedY + menuRect.height > viewportHeight) {
      adjustedY = viewportHeight - menuRect.height - 16
    }

    // Ensure menu doesn't go off left/top edges
    adjustedX = Math.max(16, adjustedX)
    adjustedY = Math.max(16, adjustedY)

    menu.style.left = `${adjustedX}px`
    menu.style.top = `${adjustedY}px`
  }, [isOpen, x, y])

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Small delay to prevent immediate closure from the right-click event
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div
        ref={menuRef}
        className="fixed context-menu-container"
        style={{ left: x, top: y }}
      >
        {/* Menu Header */}
        <div className="context-menu-header">
          <Sparkles className="w-4 h-4 text-accent-500 dark:text-accent-400" />
          <span className="font-display font-semibold">AI Tools</span>
          {isLoading && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-500 ml-auto" />
          )}
        </div>

        {/* Menu Items */}
        <div className="context-menu-items">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={async () => {
                if (!action.disabled) {
                  await action.onClick()
                }
              }}
              disabled={action.disabled}
              className="context-menu-item group"
            >
              <div className="context-menu-icon text-accent-500 dark:text-accent-400 group-hover:text-accent-600 dark:group-hover:text-accent-300">
                {action.icon}
              </div>
              <div className="flex flex-col items-start flex-1">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-gray-950 dark:group-hover:text-gray-50">
                  {action.label}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                  {action.description}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Selection Preview */}
        {selectedText && (
          <div className="context-menu-footer">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {selectedText.length} characters selected
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}