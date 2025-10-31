import { useState, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface CanvasFindDialogProps {
  onClose: () => void
  onSearch: (query: string) => void
  onNext: () => void
  onPrevious: () => void
  currentIndex: number
  totalMatches: number
}

export function CanvasFindDialog({
  onClose,
  onSearch,
  onNext,
  onPrevious,
  currentIndex,
  totalMatches,
}: CanvasFindDialogProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Trigger search when query changes
  useEffect(() => {
    onSearch(query)
  }, [query, onSearch])

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        onPrevious()
      } else {
        onNext()
      }
    }
  }

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-white/98 dark:bg-gray-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/60 dark:border-gray-700/60 px-4 py-3 flex items-center gap-3 min-w-[400px]">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Find
        </span>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search notes on canvas..."
          className="flex-1 bg-transparent border-none outline-none focus:outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
        />

        {totalMatches > 0 && (
          <>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {currentIndex + 1}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">/</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {totalMatches}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={onPrevious}
                disabled={totalMatches === 0}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous match"
                title="Previous (Shift+Enter)"
              >
                <ChevronLeft className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              </button>
              
              <button
                onClick={onNext}
                disabled={totalMatches === 0}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next match"
                title="Next (Enter)"
              >
                <ChevronRight className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
          </>
        )}

        {query && totalMatches === 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            No matches
          </span>
        )}

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Close find"
          title="Close (Esc)"
        >
          <X className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
      </div>
    </div>
  )
}