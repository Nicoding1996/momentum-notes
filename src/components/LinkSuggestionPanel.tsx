import { Sparkles, X, Check } from 'lucide-react'

interface LinkSuggestion {
  noteId: string
  noteTitle: string
  confidence: number
  reason: string
  sharedTags: string[]
}

interface LinkSuggestionPanelProps {
  suggestions: LinkSuggestion[]
  isAnalyzing: boolean
  onAccept: (noteId: string, noteTitle: string) => void
  onDismiss: () => void
}

export function LinkSuggestionPanel({
  suggestions,
  isAnalyzing,
  onAccept,
  onDismiss,
}: LinkSuggestionPanelProps) {
  if (isAnalyzing) {
    return (
      <div className="link-suggestion-panel analyzing">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 animate-pulse text-accent-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Analyzing connections...</span>
        </div>
      </div>
    )
  }
  
  if (suggestions.length === 0) return null
  
  return (
    <div className="link-suggestion-panel">
      {/* Header */}
      <div className="suggestion-header">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Link Suggestions</span>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label="Dismiss suggestions"
        >
          <X className="w-3 h-3 text-gray-500 dark:text-gray-400" />
        </button>
      </div>
      
      {/* Suggestions */}
      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <SuggestionItem
            key={suggestion.noteId}
            suggestion={suggestion}
            onAccept={() => onAccept(suggestion.noteId, suggestion.noteTitle)}
          />
        ))}
      </div>
    </div>
  )
}

function SuggestionItem({
  suggestion,
  onAccept,
}: {
  suggestion: LinkSuggestion
  onAccept: () => void
}) {
  const confidenceColor = 
    suggestion.confidence >= 0.9 ? 'text-green-600 dark:text-green-400' :
    suggestion.confidence >= 0.8 ? 'text-blue-600 dark:text-blue-400' :
    'text-yellow-600 dark:text-yellow-400'
  
  return (
    <div className="suggestion-item">
      <div className="flex items-start gap-3">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
            [[{suggestion.noteTitle}]]
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {suggestion.reason}
          </div>
          {suggestion.sharedTags.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Tags: {suggestion.sharedTags.join(', ')}
            </div>
          )}
        </div>
        
        {/* Confidence & Action */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-medium ${confidenceColor}`}>
            {Math.round(suggestion.confidence * 100)}%
          </span>
          <button
            onClick={onAccept}
            className="p-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
            aria-label="Accept suggestion"
            title="Insert link"
          >
            <Check className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}