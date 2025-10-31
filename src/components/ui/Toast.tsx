import { useEffect } from 'react'
import { X, CheckCircle2, XCircle, Info, Loader2 } from 'lucide-react'
import { Toast as ToastType, useToast } from '@/contexts/ToastContext'

interface ToastItemProps {
  toast: ToastType
}

function ToastItem({ toast }: ToastItemProps) {
  const { hideToast } = useToast()

  useEffect(() => {
    // Auto-dismiss after duration (except for loading toasts)
    if (toast.type !== 'loading' && toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        hideToast(toast.id)
      }, toast.duration)

      return () => clearTimeout(timer)
    }
  }, [toast.id, toast.duration, toast.type, hideToast])

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'loading':
        return <Loader2 className="w-5 h-5 text-accent-500 animate-spin" />
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getStyles = () => {
    const baseStyles = 'flex items-start gap-3 min-w-[300px] max-w-md p-4 rounded-xl shadow-lg backdrop-blur-sm border transition-all duration-300 ease-out'
    
    switch (toast.type) {
      case 'success':
        return `${baseStyles} bg-white/95 dark:bg-gray-800/95 border-green-200 dark:border-green-800`
      case 'error':
        return `${baseStyles} bg-white/95 dark:bg-gray-800/95 border-red-200 dark:border-red-800`
      case 'loading':
        return `${baseStyles} bg-white/95 dark:bg-gray-800/95 border-accent-200 dark:border-accent-800`
      case 'info':
      default:
        return `${baseStyles} bg-white/95 dark:bg-gray-800/95 border-blue-200 dark:border-blue-800`
    }
  }

  return (
    <div
      className={`${getStyles()} animate-toast-slide-in`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
          {toast.message}
        </p>
      </div>

      {toast.type !== 'loading' && (
        <button
          onClick={() => hideToast(toast.id)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export function ToastContainer() {
  const { toasts } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  )
}