import { useState, useEffect, useRef } from 'react'
import { X, AlertTriangle, Info, CheckCircle } from 'lucide-react'

export type DialogType = 'alert' | 'confirm' | 'prompt'
export type DialogVariant = 'info' | 'warning' | 'danger' | 'success'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (value?: string) => void
  title: string
  message: string
  type?: DialogType
  variant?: DialogVariant
  confirmText?: string
  cancelText?: string
  placeholder?: string
  defaultValue?: string
  requireExactMatch?: string // For dangerous actions, require user to type exact text
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'confirm',
  variant = 'info',
  confirmText = 'OK',
  cancelText = 'Cancel',
  placeholder = '',
  defaultValue = '',
  requireExactMatch,
}: ConfirmationModalProps) {
  const [inputValue, setInputValue] = useState(defaultValue)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue(defaultValue)
      setError(null)
      if (type === 'prompt' && inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    }
  }, [isOpen, defaultValue, type])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter' && type === 'alert') {
        handleConfirm()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, type, onClose])

  const handleConfirm = () => {
    if (type === 'prompt') {
      if (requireExactMatch && inputValue !== requireExactMatch) {
        setError(`Please type "${requireExactMatch}" exactly to confirm`)
        return
      }
      if (!inputValue.trim() && placeholder) {
        setError('This field is required')
        return
      }
      onConfirm(inputValue)
    } else {
      onConfirm()
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  const variantConfig = {
    info: {
      icon: Info,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-100 dark:bg-blue-900/20',
      buttonClass: 'btn-primary',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-100 dark:bg-amber-900/20',
      buttonClass: 'btn bg-amber-500 hover:bg-amber-600 text-white',
    },
    danger: {
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-100 dark:bg-red-900/20',
      buttonClass: 'btn bg-red-500 hover:bg-red-600 text-white',
    },
    success: {
      icon: CheckCircle,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-100 dark:bg-green-900/20',
      buttonClass: 'btn-primary',
    },
  }

  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div
        className="modal max-w-md w-full p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Icon */}
        <div className="flex items-start gap-4 mb-4">
          <div className={`flex-shrink-0 w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${config.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-2">
              {title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
              {message}
            </p>
          </div>
          {type === 'alert' && (
            <button
              onClick={onClose}
              className="btn-icon flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Input for prompt type */}
        {type === 'prompt' && (
          <div className="mt-4 mb-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleConfirm()
                }
              }}
              placeholder={placeholder}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 text-gray-900 dark:text-gray-100"
            />
            {error && (
              <p className="mt-2 text-sm text-red-500 dark:text-red-400">
                {error}
              </p>
            )}
            {requireExactMatch && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Type "{requireExactMatch}" to confirm
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 mt-6">
          {type !== 'alert' && (
            <button
              onClick={onClose}
              className="btn-ghost"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={config.buttonClass}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}