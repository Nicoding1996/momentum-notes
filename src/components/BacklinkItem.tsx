import { ArrowRight, FileText } from 'lucide-react'
import type { Note } from '@/types/note'
import { RELATIONSHIP_TYPES } from '@/types/edge'

interface BacklinkItemProps {
  sourceNote: Note
  contextSnippet: string
  relationshipType: string
  onClick: () => void
}

export function BacklinkItem({
  sourceNote,
  contextSnippet,
  relationshipType,
  onClick,
}: BacklinkItemProps) {
  const relationship = RELATIONSHIP_TYPES[
    relationshipType.toUpperCase().replace('-', '_') as keyof typeof RELATIONSHIP_TYPES
  ] || RELATIONSHIP_TYPES.REFERENCES
  
  return (
    <div 
      className="backlink-item group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Note Title */}
      <div className="flex items-start gap-2 mb-2">
        <FileText className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {sourceNote.title}
          </h4>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>
      
      {/* Relationship Badge */}
      <div className="mb-2">
        <span 
          className="relationship-badge"
          style={{ 
            backgroundColor: `${relationship.color}20`,
            color: relationship.color,
          }}
        >
          {relationship.label}
        </span>
      </div>
      
      {/* Context Snippet */}
      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
        {highlightSearchTerm(contextSnippet)}
      </p>
      
      {/* Timestamp */}
      <div className="text-xs text-gray-400 mt-2">
        {formatTimestamp(sourceNote.updatedAt)}
      </div>
    </div>
  )
}

// Helper to highlight the wikilink in context
function highlightSearchTerm(text: string): React.ReactNode {
  // Find [[term]] patterns and highlight them
  const parts = text.split(/(\[\[[^\]]+\]\])/)
  
  return parts.map((part, index) => {
    if (part.match(/^\[\[.*\]\]$/)) {
      return (
        <mark 
          key={index}
          className="bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100 font-medium"
        >
          {part}
        </mark>
      )
    }
    return <span key={index}>{part}</span>
  })
}

// Format timestamp
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}