import { ChevronDown, ChevronRight, Link, FileText } from 'lucide-react'
import { useState } from 'react'
import type { UnlinkedMention } from '@/hooks/useUnlinkedMentions'
import { eventBus } from '@/lib/event-bus'
import { db } from '@/lib/db'
import { nanoid } from 'nanoid'
import { useToast } from '@/contexts/ToastContext'
import { syncWikilinkToEdge } from '@/lib/wikilink-sync'

interface UnlinkedMentionsPanelProps {
  mentions: UnlinkedMention[]
  isLoading: boolean
  currentNoteId: string
  currentNoteTitle: string
}

export function UnlinkedMentionsPanel({
  mentions,
  isLoading,
  currentNoteId,
  currentNoteTitle,
}: UnlinkedMentionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const { showToast } = useToast()

  const handleLinkMention = async (mention: UnlinkedMention) => {
    try {
      // Get the latest version of the source note from database
      const sourceNote = await db.notes.get(mention.sourceNote.id)
      if (!sourceNote) {
        console.error('Source note not found')
        showToast('Source note not found', 'error', 3000)
        return
      }
      
      // Get the plain text content
      const plainText = stripHtml(sourceNote.content)
      
      // Find the mention in the plain text
      const lowerText = plainText.toLowerCase()
      const lowerTitle = currentNoteTitle.toLowerCase()
      const textPosition = lowerText.indexOf(lowerTitle, mention.position)
      
      if (textPosition === -1) {
        console.error('Could not find mention in note content')
        showToast('Could not find mention in note content', 'error', 3000)
        return
      }
      
      // Get the actual text (preserve case)
      const actualText = plainText.slice(textPosition, textPosition + currentNoteTitle.length)
      
      // Create the wikilink in the database FIRST
      const wikilinkId = nanoid()
      const wikilink = {
        id: wikilinkId,
        sourceNoteId: sourceNote.id,
        targetNoteId: currentNoteId,
        targetTitle: currentNoteTitle,
        position: textPosition,
        createdAt: new Date().toISOString(),
        relationshipType: 'references',
      }
      await db.wikilinks.add(wikilink)
      
      // Immediately sync the wikilink to create a canvas edge
      await syncWikilinkToEdge(wikilink)
      
      // Emit event to request wikilink creation in the editor
      // This will be handled by the NoteEditor if/when the note is opened
      eventBus.emit('create-wikilink', {
        noteId: mention.sourceNote.id,
        searchText: actualText,
        targetNoteId: currentNoteId,
        targetTitle: currentNoteTitle,
      })
      
      showToast(`Linked to ${currentNoteTitle}`, 'success', 2000)
    } catch (error) {
      console.error('Error creating wikilink:', error)
      showToast('Failed to create link. Please try again.', 'error', 4000)
    }
  }
  
  if (isLoading) {
    return (
      <div className="unlinked-mentions-panel">
        <div className="p-4 text-sm text-gray-500">Loading...</div>
      </div>
    )
  }
  
  return (
    <div className="unlinked-mentions-panel">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="unlinked-mentions-header"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <Link className="w-4 h-4" />
          <span className="font-semibold">Unlinked Mentions</span>
        </div>
        <span className="text-sm text-gray-500">
          {mentions.length}
        </span>
      </button>
      
      {/* Content */}
      {isExpanded && (
        <div className="unlinked-mentions-content">
          {mentions.length === 0 ? (
            <div className="unlinked-mentions-empty">
              <div className="text-gray-400 mb-2">
                <Link className="w-8 h-8 mx-auto mb-2 opacity-50" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                No unlinked mentions of <strong>{currentNoteTitle}</strong>
              </p>
              <p className="text-xs text-gray-500 text-center mt-2">
                Mentions are text that matches this note's title but isn't linked yet
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {mentions.map((mention) => (
                <UnlinkedMentionItem
                  key={mention.id}
                  mention={mention}
                  currentNoteTitle={currentNoteTitle}
                  onLink={() => handleLinkMention(mention)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function UnlinkedMentionItem({
  mention,
  currentNoteTitle,
  onLink,
}: {
  mention: UnlinkedMention
  currentNoteTitle: string
  onLink: () => void
}) {
  return (
    <div className="unlinked-mention-item group">
      {/* Note Title */}
      <div className="flex items-start gap-2 mb-2">
        <FileText className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
            {mention.sourceNote.title}
          </h4>
        </div>
        <button
          onClick={onLink}
          className="flex-shrink-0 p-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
          aria-label="Convert to link"
          title="Convert to wikilink"
        >
          <Link className="w-3 h-3" />
        </button>
      </div>
      
      {/* Context Snippet */}
      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed overflow-hidden break-words">
        {highlightMention(mention.contextSnippet, currentNoteTitle)}
      </p>
      
      {/* Timestamp */}
      <div className="text-xs text-gray-400 mt-2">
        {formatTimestamp(mention.sourceNote.updatedAt)}
      </div>
    </div>
  )
}

// Helper to highlight the mention in context
function highlightMention(text: string, mention: string): React.ReactNode {
  const parts = text.split(new RegExp(`(${escapeRegex(mention)})`, 'gi'))
  
  return parts.map((part, index) => {
    if (part.toLowerCase() === mention.toLowerCase()) {
      return (
        <mark 
          key={index}
          className="bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 font-medium"
        >
          {part}
        </mark>
      )
    }
    return <span key={index}>{part}</span>
  })
}

// Helper to escape regex special characters
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Helper to strip HTML
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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