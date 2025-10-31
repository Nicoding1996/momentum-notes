import { useState, useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExtension from '@tiptap/extension-underline'
import ImageExtension from '@tiptap/extension-image'
import { X, Save, Sparkles, Mic, MicOff, Maximize2, Bold, Italic, Underline, Strikethrough, List, ListOrdered, Image } from 'lucide-react'
import { marked } from 'marked'
import { nanoid } from 'nanoid'
import type { Note } from '@/types/note'
import { db } from '@/lib/db'
import { useChromeAI } from '@/hooks/useChromeAI'
import { useVoiceTranscription } from '@/hooks/useVoiceTranscription'
import { useTextSelection } from '@/hooks/useTextSelection'
import { useToast } from '@/contexts/ToastContext'
import { TagInput } from '@/components/ui/TagInput'
import { AIChatPanel } from '@/components/AIChatPanel'
import { TextContextMenu } from '@/components/ui/TextContextMenu'
import { WikilinkExtension } from '@/extensions/WikilinkExtension'
import { WikilinkAutocomplete } from '@/components/WikilinkAutocomplete'
import { BacklinksPanel } from '@/components/BacklinksPanel'
import { findNoteByTitle, scanAndSyncWikilinks } from '@/lib/wikilink-sync'

interface NoteEditorProps {
  note: Note
  onClose: () => void
  onNavigateToNote?: (noteId: string) => void
}

export function NoteEditor({ note, onClose, onNavigateToNote }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [tags, setTags] = useState<string[]>(note.tags || [])
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  // Track the last saved values to properly detect unsaved changes
  const [lastSavedTitle, setLastSavedTitle] = useState(note.title)
  const [lastSavedContent, setLastSavedContent] = useState(note.content)
  const [lastSavedTags, setLastSavedTags] = useState<string[]>(note.tags || [])
  const [aiLoading, setAiLoading] = useState(false)
  const [isAIChatVisible, setIsAIChatVisible] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [contentHistory, setContentHistory] = useState<string[]>([])
  const interimTranscriptRef = useRef<string>('')
  const lastInterimLengthRef = useRef<number>(0)
  const autoSaveTimerRef = useRef<NodeJS.Timeout>()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Wikilink autocomplete state
  const [autocompleteState, setAutocompleteState] = useState<{
    active: boolean
    query: string
    position: { top: number; left: number }
  } | null>(null)
  
  const { status: aiStatus, expandText, summarizeText, improveWriting, refresh, runDiagnosticProbe } = useChromeAI()
  const { showToast } = useToast()
  
  // Wikilink handlers
  const handleNavigateToNote = async (noteId: string) => {
    console.log('NoteEditor: handleNavigateToNote called with:', noteId)
    console.log('NoteEditor: onNavigateToNote prop exists?', !!onNavigateToNote)
    
    // Save current note first
    await handleSave(true)
    console.log('NoteEditor: Note saved')
    
    // Load and open the linked note
    const linkedNote = await db.notes.get(noteId)
    console.log('NoteEditor: Found linked note:', linkedNote)
    
    if (linkedNote) {
      if (onNavigateToNote) {
        // Use parent's navigation handler
        console.log('NoteEditor: Calling parent navigation handler')
        onNavigateToNote(noteId)
      } else {
        // Fallback: just show toast
        console.log('NoteEditor: No parent handler, showing toast')
        showToast(`Navigating to: ${linkedNote.title}`, 'info', 2000)
      }
    } else {
      console.log('NoteEditor: Linked note not found')
    }
  }
  
  const validateWikilinkTarget = async (title: string): Promise<string | null> => {
    return await findNoteByTitle(title)
  }
  
  const handleTriggerAutocomplete = (query: string, position: number) => {
    if (!editor) return
    
    // Get cursor position on screen
    const coords = editor.view.coordsAtPos(position)
    
    setAutocompleteState({
      active: true,
      query,
      position: {
        top: coords.bottom + 8,
        left: coords.left,
      },
    })
  }
  
  const handleAutocompleteSelect = async (selectedNote: Note) => {
    if (!editor) return
    
    // Find the @ pattern and replace it with wikilink
    const { state } = editor
    const { selection } = state
    const { $from } = selection
    
    // Get text before cursor
    const textBefore = $from.parent.textBetween(
      Math.max(0, $from.parentOffset - 50),
      $from.parentOffset
    )
    
    const match = textBefore.match(/@([^\s]*?)$/)
    if (match) {
      const matchLength = match[0].length
      const from = $from.pos - matchLength
      const to = $from.pos
      
      // Replace @ with wikilink node
      editor.chain()
        .focus()
        .deleteRange({ from, to })
        .insertContentAt(from, {
          type: 'wikilink',
          attrs: {
            targetNoteId: selectedNote.id,
            targetTitle: selectedNote.title,
            exists: true,
          },
        })
        .insertContent(' ') // Add space after mention
        .run()
      
      // Save wikilink to database
      const wikilinkId = nanoid()
      await db.wikilinks.add({
        id: wikilinkId,
        sourceNoteId: note.id,
        targetNoteId: selectedNote.id,
        targetTitle: selectedNote.title,
        position: from,
        createdAt: new Date().toISOString(),
        relationshipType: 'references',
      })
      
      showToast(`Linked to ${selectedNote.title}`, 'success', 2000)
    }
    
    // Close autocomplete
    setAutocompleteState(null)
  }

  // Tiptap Editor with Wikilink extension
  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
      ImageExtension,
      WikilinkExtension.configure({
        onNavigate: handleNavigateToNote,
        onTriggerAutocomplete: handleTriggerAutocomplete,
        validateTarget: validateWikilinkTarget,
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      setContent(html)
    },
    editorProps: {
      attributes: {
        class: 'editor-textarea w-full min-h-[500px] bg-transparent border-none outline-none focus:ring-0 text-lg leading-relaxed text-gray-900 dark:text-gray-100 prose prose-lg sm:prose-lg lg:prose-xl xl:prose-2xl focus:outline-none max-w-none',
      },
    },
  })

  // Update all state AND editor when note prop changes (for navigation)
  useEffect(() => {
    setTitle(note.title)
    setContent(note.content)
    setTags(note.tags || [])
    setLastSavedTitle(note.title)
    setLastSavedContent(note.content)
    setLastSavedTags(note.tags || [])
    setHasUnsavedChanges(false)
    setContentHistory([])
    setAutocompleteState(null)
    
    // Update editor content immediately
    if (editor) {
      editor.commands.setContent(note.content)
      console.log('NoteEditor: Editor content updated to:', note.title)
    }
    
    console.log('NoteEditor: State updated for note:', note.title)
  }, [note.id, editor])

  // Text selection (for AI context menu - still used)
  const {
    selectedText,
    contextMenuState,
    closeContextMenu,
    replaceSelection
  } = useTextSelection({
    elementRef: textareaRef
  })

  // Voice transcription - updated to work with Tiptap editor with live display
  const handleTranscript = (text: string, isFinal: boolean) => {
    const trimmedText = text.trim()
    if (!trimmedText || !editor) return

    if (isFinal) {
      // First, remove any interim text that was showing
      if (lastInterimLengthRef.current > 0) {
        // Delete the interim text by selecting backwards and deleting
        const { from } = editor.state.selection
        const deleteFrom = from - lastInterimLengthRef.current
        editor.chain()
          .setTextSelection({ from: deleteFrom, to: from })
          .deleteSelection()
          .run()
      }
      
      // Now insert the final text
      const contentBefore = editor.getText()
      const needsSpace = contentBefore.length > 0 &&
                        !contentBefore.endsWith(' ') &&
                        !contentBefore.endsWith('\n')
      
      const textToInsert = needsSpace ? ' ' + trimmedText : trimmedText
      
      // Insert at current cursor position
      editor.chain().focus().insertContent(textToInsert).run()
      
      // Clear interim tracking
      interimTranscriptRef.current = ''
      lastInterimLengthRef.current = 0
    } else {
      // For interim results, show them live
      // If we had previous interim text, delete it first
      if (lastInterimLengthRef.current > 0) {
        const { from } = editor.state.selection
        const deleteFrom = from - lastInterimLengthRef.current
        editor.chain()
          .setTextSelection({ from: deleteFrom, to: from })
          .deleteSelection()
          .run()
      }
      
      // Insert the new interim text
      const contentBefore = editor.getText()
      const needsSpace = contentBefore.length > 0 &&
                        !contentBefore.endsWith(' ') &&
                        !contentBefore.endsWith('\n')
      
      const textToInsert = needsSpace ? ' ' + trimmedText : trimmedText
      
      editor.chain().focus().insertContent(textToInsert).run()
      
      // Track the interim text for next update
      interimTranscriptRef.current = trimmedText
      lastInterimLengthRef.current = textToInsert.length
    }
  }

  const { status: voiceStatus, startRecording, stopRecording } = useVoiceTranscription({
    onTranscript: handleTranscript,
    continuous: true,
    interimResults: true,
    language: 'en-US',
  })

  // Handle recording start
  const handleStartRecording = () => {
    // Focus the editor before starting recording
    if (editor) {
      editor.chain().focus().run()
    }
    startRecording()
  }

  // Handle recording stop
  const handleStopRecording = () => {
    stopRecording()
    // Clear any remaining interim transcript
    interimTranscriptRef.current = ''
    lastInterimLengthRef.current = 0
  }

  // Handle recording toggle
  const handleToggleRecording = () => {
    if (voiceStatus.isRecording) {
      handleStopRecording()
    } else {
      handleStartRecording()
    }
  }

  // Track unsaved changes - compare against last saved values, not original note
  useEffect(() => {
    const changed = title !== lastSavedTitle || content !== lastSavedContent ||
                   JSON.stringify(tags) !== JSON.stringify(lastSavedTags)
    setHasUnsavedChanges(changed)
  }, [title, content, tags, lastSavedTitle, lastSavedContent, lastSavedTags])

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

    // Get content directly from the editor to ensure we have the latest
    const currentContent = editor?.getHTML() || content
    
    const now = new Date().toISOString()
    
    // Get the latest note from database to preserve canvas position
    const latestNote = await db.notes.get(note.id)
    
    const updatedNote: Note = {
      ...latestNote, // Use latest version with current canvas position
      id: note.id,
      title: title.trim() || 'Untitled',
      content: currentContent,
      updatedAt: now,
      createdAt: note.createdAt, // Preserve creation date
    }
    
    if (tags.length > 0) {
      updatedNote.tags = tags
    } else {
      delete updatedNote.tags
    }

    try {
      await db.notes.put(updatedNote)
      
      // Scan and sync wikilinks
      await scanAndSyncWikilinks(note.id, currentContent)
      
      // Update the content state to match what we saved
      setContent(currentContent)
      // Update last saved values to match current state
      setLastSavedTitle(updatedNote.title)
      setLastSavedContent(currentContent)
      setLastSavedTags(updatedNote.tags || [])
      setHasUnsavedChanges(false)
      setLastSaved(new Date())
      
      if (!silent) {
        showToast('Note saved successfully', 'success', 2000)
      }
    } catch (error) {
      console.error('Failed to save note:', error)
      showToast('Failed to save note. Please try again.', 'error', 4000)
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
      
      showToast('Text expanded successfully', 'success', 2000)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to expand text', 'error', 4000)
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
      
      showToast('Text summarized successfully', 'success', 2000)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to summarize', 'error', 4000)
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
      
      showToast('Text improved successfully', 'success', 2000)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to improve text', 'error', 4000)
    } finally {
      setAiLoading(false)
    }
  }

  // Formatting functions for Tiptap
  const handleBold = () => editor?.chain().focus().toggleBold().run()
  const handleItalic = () => editor?.chain().focus().toggleItalic().run()
  const handleUnderline = () => editor?.chain().focus().toggleUnderline().run()
  const handleStrikethrough = () => editor?.chain().focus().toggleStrike().run()
  const handleBulletList = () => editor?.chain().focus().toggleBulletList().run()
  const handleNumberedList = () => editor?.chain().focus().toggleOrderedList().run()
  
  const handleInsertImage = () => {
    const url = prompt('Enter image URL:')
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  // AI Chat handlers with undo support
  const handleReplaceContent = (newContent: string) => {
    if (!editor) return
    
    // Save current content to history before replacing
    setContentHistory(prev => [...prev, content])
    
    // Convert markdown to HTML for proper rendering in Tiptap
    const htmlContent = marked(newContent, {
      breaks: true,
      gfm: true
    }) as string
    
    // Update both React state and Tiptap editor
    setContent(htmlContent)
    editor.commands.setContent(htmlContent)
  }

  const handleInsertContent = (contentToInsert: string) => {
    if (!editor) return
    
    // Save current content to history before inserting
    setContentHistory(prev => [...prev, content])
    
    // Convert markdown to HTML for proper rendering in Tiptap
    const htmlToInsert = marked(contentToInsert, {
      breaks: true,
      gfm: true
    }) as string
    
    // Smart insertion: no extra newlines if note is empty
    const newContent = content.trim() === ''
      ? htmlToInsert
      : content + '\n\n' + htmlToInsert
    
    // Update both React state and Tiptap editor
    setContent(newContent)
    editor.commands.setContent(newContent)
  }

  const handleUndo = () => {
    if (contentHistory.length === 0 || !editor) return
    
    // Get the last saved content
    const previousContent = contentHistory[contentHistory.length - 1]
    
    // Remove it from history
    setContentHistory(prev => prev.slice(0, -1))
    
    // Update both React state and Tiptap editor
    setContent(previousContent)
    editor.commands.setContent(previousContent)
    
    showToast('Change undone', 'info', 2000)
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
      <div className="flex min-h-full items-center justify-center p-2 sm:p-4 md:p-6">
        <div
          className="modal w-full max-w-7xl h-[92vh] max-h-[1200px] flex overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Two-column layout when AI Chat is visible */}
          <div className={`flex ${isAIChatVisible ? 'flex-row' : 'flex-col'} w-full h-full overflow-hidden`}>
            {/* Docked AI Chat on the left */}
            {isAIChatVisible && (
              <div className="w-full sm:w-[360px] md:w-[400px] lg:w-[420px] border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
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
          <div className="border-b border-gray-200/60 dark:border-gray-800/60 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Note title"
                  className="w-full text-lg sm:text-xl lg:text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 tracking-tight"
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
            <div className="mt-2 sm:mt-3">
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
          <div className="border-b border-gray-200/60 dark:border-gray-800/60 px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-gray-50/50 to-transparent dark:from-gray-900/50">
            {aiStatus.available ? (
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
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

                <div className="hidden md:flex flex-1 items-center justify-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    Right-click selected text for AI tools
                  </p>
                </div>
                
                {/* Voice Button */}
                {voiceStatus.supported && (
                  <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200 dark:border-gray-700">
                    <button
                      onClick={handleToggleRecording}
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

          {/* Focus Mode Toggle */}
          {!isFocusMode && (
          <div className="flex items-center justify-end px-6 py-3">
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

          {/* Formatting Toolbar - Always visible */}
          {!isFocusMode && (
            <div className="border-b border-gray-200/60 dark:border-gray-800/60 px-4 sm:px-6 py-2 bg-gray-50/50 dark:bg-gray-900/50">
              <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
                <button
                  onClick={handleBold}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="Bold (Ctrl+B)"
                  aria-label="Bold"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  onClick={handleItalic}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="Italic (Ctrl+I)"
                  aria-label="Italic"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  onClick={handleUnderline}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="Underline (Ctrl+U)"
                  aria-label="Underline"
                >
                  <Underline className="w-4 h-4" />
                </button>
                <button
                  onClick={handleStrikethrough}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="Strikethrough"
                  aria-label="Strikethrough"
                >
                  <Strikethrough className="w-4 h-4" />
                </button>
                
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1" />
                
                <button
                  onClick={handleBulletList}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="Bullet List"
                  aria-label="Bullet List"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNumberedList}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="Numbered List"
                  aria-label="Numbered List"
                >
                  <ListOrdered className="w-4 h-4" />
                </button>
                
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1" />
                
                <button
                  onClick={handleInsertImage}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="Insert Image"
                  aria-label="Insert Image"
                >
                  <Image className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Formatting Toolbar in Focus Mode */}
          {isFocusMode && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-xl border border-gray-200/60 dark:border-gray-800/60 shadow-lg z-10 bg-white dark:bg-gray-900 px-4 py-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={handleBold}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="Bold"
                  aria-label="Bold"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  onClick={handleItalic}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="Italic"
                  aria-label="Italic"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  onClick={handleUnderline}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="Underline"
                  aria-label="Underline"
                >
                  <Underline className="w-4 h-4" />
                </button>
                <button
                  onClick={handleStrikethrough}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="Strikethrough"
                  aria-label="Strikethrough"
                >
                  <Strikethrough className="w-4 h-4" />
                </button>
                
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1" />
                
                <button
                  onClick={handleBulletList}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="Bullet List"
                  aria-label="Bullet List"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNumberedList}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="Numbered List"
                  aria-label="Numbered List"
                >
                  <ListOrdered className="w-4 h-4" />
                </button>
                
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1" />
                
                <button
                  onClick={handleInsertImage}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="Insert Image"
                  aria-label="Insert Image"
                >
                  <Image className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* WYSIWYG Editor Content with Sidebar */}
          <div className="flex flex-1 overflow-hidden">
            {/* Editor (left side) */}
            <div className={`flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 custom-scrollbar ${isFocusMode ? 'pt-24 sm:pt-28' : ''}`}>
              <EditorContent editor={editor} className="editor-content-enhanced" />
              
              {/* Wikilink Autocomplete */}
              {autocompleteState?.active && (
                <WikilinkAutocomplete
                  query={autocompleteState.query}
                  position={autocompleteState.position}
                  onSelect={handleAutocompleteSelect}
                  onClose={() => setAutocompleteState(null)}
                  excludeNoteId={note.id}
                />
              )}
            </div>
            
            {/* Sidebar (right side) - Hidden in focus mode */}
            {!isFocusMode && (
              <div className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
                <BacklinksPanel
                  currentNoteId={note.id}
                  currentNoteTitle={title}
                  onNavigateToNote={handleNavigateToNote}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          {!isFocusMode && (
          <div className="flex items-center justify-between border-t border-gray-200/60 dark:border-gray-800/60 px-4 sm:px-6 py-3 bg-gradient-to-r from-transparent to-gray-50/50 dark:to-gray-900/50 flex-wrap gap-2">
            <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium flex-wrap">
              <span className="flex items-center gap-1 sm:gap-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{wordCount}</span>
                <span>words</span>
              </span>
              <span className="hidden sm:inline text-gray-300 dark:text-gray-700">•</span>
              <span className="flex items-center gap-1 sm:gap-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{charCount}</span>
                <span>characters</span>
              </span>
              {lastSaved && (
                <>
                  <span className="hidden sm:inline text-gray-300 dark:text-gray-700">•</span>
                  <span className="text-success-600 dark:text-success-400">
                    Saved {lastSaved.toLocaleTimeString()}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
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

        {/* Focus Mode UI */}
        {isFocusMode && (
          <>
            <div className="absolute top-6 right-6 bg-gray-900/80 dark:bg-gray-100/80 text-white dark:text-gray-900 px-4 py-2 rounded-full text-xs font-medium opacity-50 hover:opacity-100 transition-opacity pointer-events-none z-20">
              Press ESC to exit Focus Mode
            </div>
            {contentHistory.length > 0 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                <button
                  onClick={handleUndo}
                  className="btn bg-gray-900/80 dark:bg-gray-100/80 text-white dark:text-gray-900 hover:bg-gray-900 dark:hover:bg-white text-sm shadow-lg"
                >
                  Undo
                </button>
              </div>
            )}
          </>
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