import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { X, Save, Sparkles, Mic, MicOff, Eye, Edit3, Maximize2 } from 'lucide-react'
import type { Note } from '@/types/note'
import { db } from '@/lib/db'
import { useChromeAI } from '@/hooks/useChromeAI'
import { useVoiceTranscription } from '@/hooks/useVoiceTranscription'
import { useTextSelection } from '@/hooks/useTextSelection'
import { TagInput } from '@/components/ui/TagInput'
import { AIChatPanel } from '@/components/AIChatPanel'
import { TextContextMenu } from '@/components/ui/TextContextMenu'

interface NoteEditorProps {
  note: Note
  onClose: () => void
}

export function NoteEditor({ note, onClose }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [tags, setTags] = useState<string[]>(note.tags || [])
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [isAIChatVisible, setIsAIChatVisible] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [contentHistory, setContentHistory] = useState<string[]>([])
  const interimStartPosRef = useRef<number | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout>()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const { status: aiStatus, expandText, summarizeText, improveWriting, refresh, runDiagnosticProbe } = useChromeAI()

  // Text selection and context menu
  const {
    selectedText,
    isTextSelected,
    contextMenuState,
    handleContextMenu,
    closeContextMenu,
    replaceSelection
  } = useTextSelection({
    elementRef: textareaRef
  })

  // Voice transcription
  const handleTranscript = (text: string, isFinal: boolean) => {
    const trimmedText = text.trim()
    if (!trimmedText) return

    if (isFinal) {
      setContent((prev) => {
        if (interimStartPosRef.current !== null) {
          const beforeInterim = prev.substring(0, interimStartPosRef.current)
          interimStartPosRef.current = null
          return beforeInterim.trim() ? `${beforeInterim.trimEnd()} ${trimmedText}` : trimmedText
        }
        const prevTrim = prev.trim()
        return prevTrim ? `${prevTrim} ${trimmedText}` : trimmedText
      })
    } else {
      setContent((prev) => {
        if (interimStartPosRef.current === null) {
          interimStartPosRef.current = prev.length
        }
        const beforeInterim = prev.substring(0, interimStartPosRef.current)
        return beforeInterim.trim() ? `${beforeInterim.trimEnd()} ${trimmedText}` : trimmedText
      })
    }
  }

  const { status: voiceStatus, toggleRecording } = useVoiceTranscription({
    onTranscript: handleTranscript,
    continuous: true,
    interimResults: true,
    language: 'en-US',
  })

  // Track unsaved changes
  useEffect(() => {
    const changed = title !== note.title || content !== note.content ||
                   JSON.stringify(tags) !== JSON.stringify(note.tags || [])
    setHasUnsavedChanges(changed)
  }, [title, content, tags, note.title, note.content, note.tags])

  // Auto-save with debounce (2 seconds)
  useEffect(() => {
    if (!hasUnsavedChanges) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(() => {
      handleSave(true)
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

  // Auto-resize textarea to fit content
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea && mode === 'write') {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto'
      // Set height to scrollHeight to fit all content
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [content, mode])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape') {
        if (isFocusMode) {
          setIsFocusMode(false)
        } else {
          handleClose()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [title, content, hasUnsavedChanges, isFocusMode])

  const handleSave = async (silent = false) => {
    if (!silent) setIsSaving(true)

    const now = new Date().toISOString()
    const updatedNote: Note = {
      ...note,
      title: title.trim() || 'Untitled',
      content: content,
      updatedAt: now,
    }
    
    if (tags.length > 0) {
      updatedNote.tags = tags
    } else {
      delete updatedNote.tags
    }

    try {
      await db.notes.put(updatedNote)
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
      const confirmed = confirm('You have unsaved changes. Close anyway?')
      if (!confirmed) return
    }
    onClose()
  }

  // AI Actions for context menu - all require selected text
  const handleAIExpand = async () => {
    if (!selectedText.trim()) return
    
    setAiLoading(true)
    try {
      setContentHistory(prev => [...prev, content])
      const expanded = await expandText(selectedText, `This is part of a note titled: ${title}`)
      replaceSelection(expanded, setContent)
      closeContextMenu()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to expand text')
    } finally {
      setAiLoading(false)
    }
  }

  const handleAISummarize = async () => {
    if (!selectedText.trim()) return
    
    setAiLoading(true)
    try {
      setContentHistory(prev => [...prev, content])
      const summary = await summarizeText(selectedText, 'tl;dr')
      replaceSelection(summary, setContent)
      closeContextMenu()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to summarize')
    } finally {
      setAiLoading(false)
    }
  }

  const handleAIImprove = async () => {
    if (!selectedText.trim()) return
    
    setAiLoading(true)
    try {
      setContentHistory(prev => [...prev, content])
      const improved = await improveWriting(selectedText)
      replaceSelection(improved, setContent)
      closeContextMenu()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to improve text')
    } finally {
      setAiLoading(false)
    }
  }

  // AI Chat handlers with undo support
  const handleReplaceContent = (newContent: string) => {
    // Save current content to history before replacing
    setContentHistory(prev => [...prev, content])
    setContent(newContent)
  }

  const handleInsertContent = (contentToInsert: string) => {
    // Save current content to history before inserting
    setContentHistory(prev => [...prev, content])
    
    // Smart insertion: no extra newlines if note is empty
    if (content.trim() === '') {
      setContent(contentToInsert)
    } else {
      setContent(content + '\n\n' + contentToInsert)
    }
  }

  const handleUndo = () => {
    if (contentHistory.length === 0) return
    
    // Get the last saved content
    const previousContent = contentHistory[contentHistory.length - 1]
    
    // Remove it from history
    setContentHistory(prev => prev.slice(0, -1))
    
    // Restore the content
    setContent(previousContent)
  }

  const charCount = content.length
  const wordCount = content.trim().split(/\s+/).filter(w => w.length > 0).length

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto animate-in">
      {/* Backdrop */}
      <div
        className="modal-backdrop"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="modal w-full max-w-5xl h-[85vh] flex overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Two-column layout when AI Chat is visible */}
          <div className={`flex ${isAIChatVisible ? 'flex-row' : 'flex-col'} w-full h-full overflow-hidden`}>
            {/* Docked AI Chat on the left */}
            {isAIChatVisible && (
              <div className="w-[380px] min-w-[340px] max-w-[420px] border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <AIChatPanel
                  key={note.id}
                  note={{ ...note, title, content, tags }}
                  onReplaceContent={handleReplaceContent}
                  onInsertContent={handleInsertContent}
                  onUndo={handleUndo}
                  canUndo={contentHistory.length > 0}
                />
              </div>
            )}
            {/* Main Editor Section */}
            <div className={`flex flex-col ${isAIChatVisible ? 'flex-1' : 'w-full'} overflow-hidden ${isFocusMode ? 'h-full' : ''}`}>
          {/* Header */}
          {!isFocusMode && (
          <div className="border-b border-gray-200/60 dark:border-gray-800/60 px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Note title"
                  className="w-full text-xl font-bold bg-transparent border-none outline-none focus:ring-0 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 tracking-tight"
                />
              </div>
              <button
                onClick={handleClose}
                className="btn-icon flex-shrink-0"
                aria-label="Close editor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Tags Input - Compact */}
            <div className="mt-2">
              <TagInput
                tags={tags}
                onChange={setTags}
                placeholder="Add tags..."
              />
            </div>
          </div>
          )}

          {/* AI Toolbar */}
          {!isFocusMode && (
          <div className="border-b border-gray-200/60 dark:border-gray-800/60 px-6 py-2.5 bg-gradient-to-r from-gray-50/50 to-transparent dark:from-gray-900/50">
            {aiStatus.available ? (
              <div className="flex items-center gap-3 flex-wrap">
                {/* AI Chat Button - Primary Action */}
                <button
                  onClick={() => setIsAIChatVisible(!isAIChatVisible)}
                  className="btn bg-gradient-to-br from-accent-400 via-accent-500 to-accent-600 text-gray-900 shadow-glow-accent text-sm relative overflow-hidden group"
                  title="Open AI Chat Assistant"
                >
                  <Sparkles className="w-4 h-4 group-hover:animate-pulse" />
                  AI Chat
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                </button>

                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    Right-click selected text for AI tools
                  </p>
                </div>
                
                {/* Voice Button */}
                {voiceStatus.supported && (
                  <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200 dark:border-gray-700">
                    <button
                      onClick={toggleRecording}
                      disabled={aiLoading}
                      className={`btn text-sm ${
                        voiceStatus.isRecording
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30'
                          : 'btn-secondary'
                      }`}
                      title={voiceStatus.isRecording ? 'Stop recording' : 'Start voice input'}
                    >
                      {voiceStatus.isRecording ? (
                        <>
                          <MicOff className="w-4 h-4" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4" />
                          Record
                        </>
                      )}
                    </button>
                    {voiceStatus.isRecording && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                          <span className="text-sm text-red-600 dark:text-red-400 font-medium">Listening...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {aiLoading && (
                  <div className="flex items-center gap-2 ml-auto">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full animate-pulse"></div>
                    <span className="text-sm text-primary-600 dark:text-primary-400 font-medium">Processing...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-medium">AI tools unavailable</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const result = await runDiagnosticProbe()
                      alert(`Diagnostic Results:\n\n${result}`)
                    }}
                    className="btn-secondary text-xs"
                  >
                    Run Probe
                  </button>
                  <button onClick={refresh} className="btn-secondary text-xs">
                    Re-check
                  </button>
                  <a
                    href="chrome://flags/#prompt-api-for-gemini-nano"
                    className="btn-secondary text-xs"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Flags
                  </a>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Editor Mode Toggle & Focus Mode Button */}
          {!isFocusMode && (
          <div className="flex items-center justify-between px-6 py-3">
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden p-0.5 bg-gray-100/50 dark:bg-gray-800/50">
              <button
                onClick={() => setMode('write')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                  mode === 'write'
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
                aria-pressed={mode === 'write'}
              >
                <div className="flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" />
                  Write
                </div>
              </button>
              <button
                onClick={() => setMode('preview')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                  mode === 'preview'
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
                aria-pressed={mode === 'preview'}
              >
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </div>
              </button>
            </div>
            
            {/* Focus Mode Toggle */}
            <button
              onClick={() => setIsFocusMode(true)}
              className="btn btn-ghost text-xs px-3 py-1.5"
              title="Enter Focus Mode (Esc to exit)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Focus
            </button>
          </div>
          )}

          {/* Editor Content */}
          <div className="flex-1 overflow-y-auto px-6 py-3">
            {mode === 'write' ? (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value)
                  if (interimStartPosRef.current !== null) {
                    interimStartPosRef.current = null
                  }
                }}
                onContextMenu={handleContextMenu}
                placeholder="Start writing your note..."
                className={`editor-textarea w-full min-h-[500px] bg-transparent border-none outline-none focus:ring-0 resize-none placeholder-gray-400 dark:placeholder-gray-500 text-base leading-relaxed text-gray-900 dark:text-gray-100 ${isTextSelected ? 'has-selection' : ''}`}
              />
            ) : (
              <div className="min-h-[500px]">
                <div className="prose-custom">
                  <ReactMarkdown
                    components={{
                      strong: ({ children }) => <strong className="font-bold text-gray-900 dark:text-gray-100">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      h1: ({ children }) => <h1 className="text-3xl font-bold mt-6 mb-4">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-2xl font-bold mt-5 mb-3">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-xl font-bold mt-4 mb-2">{children}</h3>,
                      ul: ({ children }) => <ul className="list-disc list-inside my-3 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside my-3 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="my-1 text-gray-700 dark:text-gray-300">{children}</li>,
                      p: ({ children }) => <p className="my-3 text-gray-700 dark:text-gray-300 leading-relaxed">{children}</p>,
                      code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg text-sm font-mono text-primary-600 dark:text-primary-400">{children}</code>,
                      a: ({ children, href }) => <a href={href} className="text-primary-600 dark:text-primary-400 hover:underline font-medium" target="_blank" rel="noopener noreferrer">{children}</a>,
                    }}
                  >
                    {content || '_Nothing to preview yet_'}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {!isFocusMode && (
          <div className="flex items-center justify-between border-t border-gray-200/60 dark:border-gray-800/60 px-6 py-3 bg-gradient-to-r from-transparent to-gray-50/50 dark:to-gray-900/50">
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 font-medium">
              <span className="flex items-center gap-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{wordCount}</span>
                <span>words</span>
              </span>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <span className="flex items-center gap-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{charCount}</span>
                <span>characters</span>
              </span>
              {lastSaved && (
                <>
                  <span className="text-gray-300 dark:text-gray-700">•</span>
                  <span className="text-success-600 dark:text-success-400">
                    Saved {lastSaved.toLocaleTimeString()}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {contentHistory.length > 0 && (
                <button
                  onClick={handleUndo}
                  className="btn-secondary text-sm"
                >
                  Undo
                </button>
              )}
              {hasUnsavedChanges && (
                <span className="text-sm text-amber-600 dark:text-amber-400 font-medium mr-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                  Unsaved changes
                </span>
              )}
              <button
                onClick={handleClose}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave()}
                disabled={isSaving || !hasUnsavedChanges}
                className="btn-primary"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
          )}
          </div>
          </div>
        </div>

        {/* Focus Mode Exit Hint */}
        {isFocusMode && (
          <div className="absolute top-4 right-4 bg-gray-900/80 dark:bg-gray-100/80 text-white dark:text-gray-900 px-4 py-2 rounded-full text-xs font-medium opacity-50 hover:opacity-100 transition-opacity pointer-events-none">
            Press ESC to exit Focus Mode
          </div>
        )}

        {/* Context Menu for Selected Text */}
        <TextContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          isOpen={contextMenuState.isOpen}
          onClose={closeContextMenu}
          selectedText={selectedText}
          onExpand={handleAIExpand}
          onSummarize={handleAISummarize}
          onImprove={handleAIImprove}
          isLoading={aiLoading}
        />
      </div>
    </div>
  )
}