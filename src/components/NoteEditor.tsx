import { useState, useEffect, useRef } from 'react'
import { X, Save, Sparkles, FileText, Wand2 } from 'lucide-react'
import type { Note } from '@/types/note'
import { db } from '@/lib/db'
import { useChromeAI } from '@/hooks/useChromeAI'

interface NoteEditorProps {
  note: Note
  onClose: () => void
}

export function NoteEditor({ note, onClose }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const autoSaveTimerRef = useRef<NodeJS.Timeout>()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const { status: aiStatus, expandText, summarizeText, improveWriting, refresh, runDiagnosticProbe } = useChromeAI()

  // Track unsaved changes
  useEffect(() => {
    const changed = title !== note.title || content !== note.content
    setHasUnsavedChanges(changed)
  }, [title, content, note.title, note.content])

  // Auto-save with debounce (2 seconds)
  useEffect(() => {
    if (!hasUnsavedChanges) return

    // Clear previous timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Set new timer
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave(true) // silent auto-save
    }, 2000)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [title, content, hasUnsavedChanges])

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      // Esc to close (with warning if unsaved)
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [title, content, hasUnsavedChanges])

  const handleSave = async (silent = false) => {
    if (!silent) setIsSaving(true)

    const now = new Date().toISOString()
    const updatedNote: Note = {
      ...note,
      title: title.trim() || 'Untitled',
      content: content,
      updatedAt: now,
    }

    try {
      await db.notes.update(note.id, updatedNote)
      setHasUnsavedChanges(false)
      setLastSaved(new Date())
    } catch (error) {
      console.error('Failed to save note:', error)
      alert('Failed to save note. Please try again.')
    } finally {
      if (!silent) setIsSaving(false)
    }
  }

  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirmed = confirm('You have unsaved changes. Are you sure you want to close?')
      if (!confirmed) return
    }
    onClose()
  }

  // Track selected text
  const handleTextSelect = () => {
    const textarea = textareaRef.current
    if (textarea) {
      const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
      setSelectedText(selected)
    }
  }

  // AI Actions
  const handleAIExpand = async () => {
    if (!selectedText.trim()) {
      alert('Please select some text to expand')
      return
    }
    
    setAiLoading(true)
    try {
      const expanded = await expandText(selectedText, `This is part of a note titled: ${title}`)
      // Replace selected text with expanded version
      const textarea = textareaRef.current
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newContent = content.substring(0, start) + expanded + content.substring(end)
        setContent(newContent)
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to expand text')
    } finally {
      setAiLoading(false)
    }
  }

  const handleAISummarize = async () => {
    const textToSummarize = selectedText.trim() || content.trim()
    if (!textToSummarize) {
      alert('No text to summarize')
      return
    }
    
    setAiLoading(true)
    try {
      const summary = await summarizeText(textToSummarize, 'tl;dr')
      if (selectedText.trim()) {
        // Replace selected text
        const textarea = textareaRef.current
        if (textarea) {
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const newContent = content.substring(0, start) + summary + content.substring(end)
          setContent(newContent)
        }
      } else {
        // Add summary at the top
        setContent(`📝 Summary: ${summary}\n\n---\n\n${content}`)
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to summarize')
    } finally {
      setAiLoading(false)
    }
  }

  const handleAIImprove = async () => {
    if (!selectedText.trim()) {
      alert('Please select some text to improve')
      return
    }
    
    setAiLoading(true)
    try {
      const improved = await improveWriting(selectedText, 'more-formal')
      const textarea = textareaRef.current
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newContent = content.substring(0, start) + improved + content.substring(end)
        setContent(newContent)
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to improve text')
    } finally {
      setAiLoading(false)
    }
  }

  // Character and word count
  const charCount = content.length
  const wordCount = content.trim().split(/\s+/).filter(w => w.length > 0).length

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6 py-4">
            <div className="flex-1 mr-4">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title"
                className="w-full text-2xl font-semibold bg-transparent border-none outline-none focus:ring-0 placeholder-gray-400 dark:placeholder-gray-600"
              />
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible-ring"
              aria-label="Close editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* AI Toolbar / Status */}
          <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-3">
            {aiStatus.available ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500 mr-2">AI Tools:</span>
                <button
                  onClick={handleAIExpand}
                  disabled={aiLoading || !selectedText}
                  className="px-3 py-1 text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  title="Expand selected text"
                >
                  <Sparkles className="w-3 h-3" />
                  Expand
                </button>
                <button
                  onClick={handleAISummarize}
                  disabled={aiLoading}
                  className="px-3 py-1 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  title="Summarize (selection or entire note)"
                >
                  <FileText className="w-3 h-3" />
                  Summarize
                </button>
                <button
                  onClick={handleAIImprove}
                  disabled={aiLoading || !selectedText}
                  className="px-3 py-1 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  title="Improve selected text"
                >
                  <Wand2 className="w-3 h-3" />
                  Improve
                </button>
                {aiLoading && (
                  <span className="text-sm text-gray-500 animate-pulse">Processing...</span>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="text-gray-500">
                    AI tools unavailable. Ensure Chrome Built‑in AI is enabled. Origin: {location.origin}. Secure: {String(window.isSecureContext)}.
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const result = await runDiagnosticProbe()
                        alert(`Diagnostic Probe Results:\n\n${result}`)
                      }}
                      className="px-3 py-1 rounded bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/30"
                      title="Test AI session creation directly"
                    >
                      Run Probe
                    </button>
                    <button
                      onClick={refresh}
                      className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                      title="Re-check AI availability"
                    >
                      Re-check
                    </button>
                    <a
                      href="chrome://flags/#prompt-api-for-gemini-nano"
                      className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                      target="_blank"
                      rel="noreferrer"
                      title="Open Chrome flags"
                    >
                      Open flags
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Editor */}
          <div className="px-6 py-4">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onSelect={handleTextSelect}
              placeholder="Start writing..."
              className="w-full h-96 bg-transparent border-none outline-none focus:ring-0 resize-none placeholder-gray-400 dark:placeholder-gray-600 text-base leading-relaxed"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 px-6 py-4">
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{wordCount} words</span>
              <span>•</span>
              <span>{charCount} characters</span>
              {lastSaved && (
                <>
                  <span>•</span>
                  <span>Saved {lastSaved.toLocaleTimeString()}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {hasUnsavedChanges && (
                <span className="text-sm text-amber-600 dark:text-amber-400">
                  Unsaved changes
                </span>
              )}
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg focus-visible-ring"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave()}
                disabled={isSaving || !hasUnsavedChanges}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 focus-visible-ring flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}