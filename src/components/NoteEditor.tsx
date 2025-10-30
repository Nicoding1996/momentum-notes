import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { X, Save, Sparkles, FileText, Wand2, Mic, MicOff, Eye, Edit3 } from 'lucide-react'
import type { Note } from '@/types/note'
import { db } from '@/lib/db'
import { useChromeAI } from '@/hooks/useChromeAI'
import { useVoiceTranscription } from '@/hooks/useVoiceTranscription'
import { TagInput } from '@/components/ui/TagInput'

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
  const [selectedText, setSelectedText] = useState('')
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const interimStartPosRef = useRef<number | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout>()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const { status: aiStatus, expandText, summarizeText, improveWriting, refresh, runDiagnosticProbe } = useChromeAI()

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
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
        const textarea = textareaRef.current
        if (textarea) {
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const newContent = content.substring(0, start) + summary + content.substring(end)
          setContent(newContent)
        }
      } else {
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
          className="modal w-full max-w-5xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-gray-200/60 dark:border-gray-800/60 px-8 py-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 mr-6">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Note title"
                  className="w-full text-3xl font-bold bg-transparent border-none outline-none focus:ring-0 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 tracking-tight"
                />
              </div>
              <button
                onClick={handleClose}
                className="btn-icon"
                aria-label="Close editor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Tags Input */}
            <div className="mt-4">
              <TagInput
                tags={tags}
                onChange={setTags}
                placeholder="Add tags..."
              />
            </div>
          </div>

          {/* AI Toolbar */}
          <div className="border-b border-gray-200/60 dark:border-gray-800/60 px-8 py-4 bg-gradient-to-r from-gray-50/50 to-transparent dark:from-gray-900/50">
            {aiStatus.available ? (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 mr-auto">
                  <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">AI Tools</span>
                </div>
                
                <button
                  onClick={handleAIExpand}
                  disabled={aiLoading || !selectedText}
                  className="btn btn-secondary text-sm disabled:opacity-40"
                  title="Expand selected text"
                >
                  <Sparkles className="w-4 h-4" />
                  Expand
                </button>
                <button
                  onClick={handleAISummarize}
                  disabled={aiLoading}
                  className="btn btn-secondary text-sm disabled:opacity-40"
                  title="Summarize"
                >
                  <FileText className="w-4 h-4" />
                  Summarize
                </button>
                <button
                  onClick={handleAIImprove}
                  disabled={aiLoading || !selectedText}
                  className="btn btn-secondary text-sm disabled:opacity-40"
                  title="Improve selected text"
                >
                  <Wand2 className="w-4 h-4" />
                  Improve
                </button>
                
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

          {/* Editor Mode Toggle */}
          <div className="flex items-center justify-between px-8 pt-6 pb-4">
            <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden p-1 bg-gray-100/50 dark:bg-gray-800/50">
              <button
                onClick={() => setMode('write')}
                className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  mode === 'write'
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
                aria-pressed={mode === 'write'}
              >
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  Write
                </div>
              </button>
              <button
                onClick={() => setMode('preview')}
                className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  mode === 'preview'
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
                aria-pressed={mode === 'preview'}
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Preview
                </div>
              </button>
            </div>
          </div>

          {/* Editor Content */}
          <div className="flex-1 overflow-hidden px-8">
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
                onSelect={handleTextSelect}
                placeholder="Start writing your note..."
                className="w-full h-full bg-transparent border-none outline-none focus:ring-0 resize-none placeholder-gray-400 dark:placeholder-gray-500 text-base leading-relaxed text-gray-900 dark:text-gray-100 custom-scrollbar py-4"
              />
            ) : (
              <div className="h-full overflow-y-auto py-4 custom-scrollbar">
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
          <div className="flex items-center justify-between border-t border-gray-200/60 dark:border-gray-800/60 px-8 py-5 bg-gradient-to-r from-transparent to-gray-50/50 dark:to-gray-900/50">
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
        </div>
      </div>
    </div>
  )
}