import { useEffect, useState } from 'react'
import { Plus, Search, Settings, Trash2, Grid, List, Sparkles } from 'lucide-react'
import { nanoid } from 'nanoid'
import { db, seedIfEmpty } from '@/lib/db'
import type { Note } from '@/types/note'
import { useLiveQuery } from 'dexie-react-hooks'
import { NoteEditor } from '@/components/NoteEditor'
import { CanvasView } from '@/components/CanvasView'
import { SearchPanel } from '@/components/SearchPanel'
import { SettingsModal } from '@/components/SettingsModal'
import { TagDisplay } from '@/components/ui/TagDisplay'

type ViewMode = 'list' | 'canvas'

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('canvas')
  const [showSearch, setShowSearch] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [viewportCenter, setViewportCenter] = useState<{ x: number; y: number } | null>(null)

  // Seed demo note on first load (dev)
  useEffect(() => {
    seedIfEmpty().catch(console.error)
  }, [])

  // Handle PWA shortcut for new note
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('action') === 'new-note') {
      handleNewNote()
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])
 
  // Reactive notes list from IndexedDB
  const notes = useLiveQuery(async () => {
    return db.notes.orderBy('updatedAt').reverse().toArray()
  }, []) as Note[] | undefined

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleSearch = () => setShowSearch(true)
  const handleSettings = () => setShowSettings(true)

  const handleNewNote = async () => {
    const id = nanoid()
    const now = new Date().toISOString()
    
    // Calculate position - use viewport center if available, otherwise use default grid position
    const noteCount = notes?.length || 0
    const defaultX = (noteCount % 4) * 350 + 50
    const defaultY = Math.floor(noteCount / 4) * 250 + 50
    
    const newNote: Note = {
      id,
      title: 'Untitled Note',
      content: '',
      createdAt: now,
      updatedAt: now,
      // Place new note at the center of the current viewport if available
      x: viewportCenter ? Math.round(viewportCenter.x - 140) : defaultX,
      y: viewportCenter ? Math.round(viewportCenter.y - 120) : defaultY,
    }
    await db.notes.add(newNote)
  }

  const deleteNote = async (id: string) => {
    const ok = confirm('Delete this note? This action cannot be undone.')
    if (!ok) return
    await db.notes.delete(id)
  }

  const openEditor = (note: Note) => {
    setEditingNote(note)
  }

  const closeEditor = () => {
    setEditingNote(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex flex-col">
      {/* Header - Modern & Refined */}
      <header className="header-glass sticky top-0 z-50 h-16 flex-shrink-0">
        <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between max-w-[1920px] mx-auto">
          {/* Logo & Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gradient tracking-tight">
                Momentum Notes
              </h1>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800/50">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success-500' : 'bg-accent-500'} animate-pulse`} />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle - Enhanced Design */}
            {notes && notes.length > 0 && (
              <div className="hidden sm:flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/60 rounded-xl mr-2 border border-gray-200/50 dark:border-gray-700/50">
                <button
                  onClick={() => setViewMode('canvas')}
                  className={`px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 font-medium text-sm ${
                    viewMode === 'canvas'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                  }`}
                  style={viewMode === 'canvas' ? {
                    boxShadow: '0 -1px 1px 0 rgba(255, 255, 255, 0.1) inset, 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                  } : {}}
                  aria-label="Canvas view"
                  title="Canvas View - Visual connections"
                >
                  <Grid className="w-4 h-4" />
                  <span>Canvas</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 font-medium text-sm ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                  }`}
                  style={viewMode === 'list' ? {
                    boxShadow: '0 -1px 1px 0 rgba(255, 255, 255, 0.1) inset, 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                  } : {}}
                  aria-label="List view"
                  title="Grid View - Browse all notes"
                >
                  <List className="w-4 h-4" />
                  <span>Grid</span>
                </button>
              </div>
            )}

            <button 
              onClick={handleSearch} 
              className="btn-icon"
              aria-label="Search notes"
              title="Search (Ctrl+K)"
            >
              <Search className="w-5 h-5" />
            </button>
            
            <button 
              onClick={handleSettings} 
              className="btn-icon"
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            
            <button 
              onClick={handleNewNote} 
              className="btn-primary"
              aria-label="Create new note"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Note</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen-minus-header">
        {!notes?.length ? (
          /* Empty State - Beautiful & Inviting */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-lg animate-slide-up">
              <div className="relative inline-flex mb-8">
                <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 flex items-center justify-center shadow-xl shadow-primary-500/20">
                  <Sparkles className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-8 h-8 bg-accent-500 rounded-full flex items-center justify-center shadow-lg">
                  <Plus className="w-4 h-4 text-white" />
                </div>
              </div>
              
              <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100 tracking-tight">
                Welcome to Momentum Notes
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                Your intelligent note-taking companion. Create, organize, and connect your thoughts with AI-powered insights on an infinite canvas.
              </p>
              
              <button 
                onClick={handleNewNote}
                className="btn-primary text-base px-8 py-3 shadow-lg shadow-primary-500/20 hover:shadow-xl hover:shadow-primary-500/30"
              >
                <Plus className="w-5 h-5" />
                Create Your First Note
              </button>
              
              <div className="mt-12 pt-12 border-t border-gray-200 dark:border-gray-800">
                <div className="grid grid-cols-3 gap-8">
                  <div className="group">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-success-100 dark:bg-success-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <span className="text-2xl">🔒</span>
                    </div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">100% Private</div>
                    <div className="text-sm text-gray-500 dark:text-gray-500">Offline-first, secure</div>
                  </div>
                  <div className="group">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <span className="text-2xl">✨</span>
                    </div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">AI-Powered</div>
                    <div className="text-sm text-gray-500 dark:text-gray-500">On-device intelligence</div>
                  </div>
                  <div className="group">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-accent-100 dark:bg-accent-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <span className="text-2xl">🎨</span>
                    </div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Visual Canvas</div>
                    <div className="text-sm text-gray-500 dark:text-gray-500">Infinite possibilities</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Notes View */
          <div className="flex-1 flex flex-col overflow-hidden">
            {viewMode === 'canvas' ? (
              /* Canvas View */
              <div className="flex-1">
                <CanvasView
                  notes={notes}
                  onEditNote={openEditor}
                  onDeleteNote={deleteNote}
                  onViewportCenterChange={setViewportCenter}
                />
              </div>
            ) : (
              /* List View */
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  {/* Mobile view toggle */}
                  <div className="mb-6 sm:hidden flex justify-end">
                    <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl">
                      <button
                        onClick={() => setViewMode('canvas')}
                        className="p-2 rounded-lg transition-all hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                        aria-label="Canvas view"
                      >
                        <Grid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className="p-2 rounded-lg transition-all bg-white dark:bg-gray-700 shadow-sm text-primary-600 dark:text-primary-400"
                        aria-label="List view"
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-700/80 rounded-2xl p-6 cursor-pointer group transition-all duration-300 ease-out"
                        style={{
                          willChange: 'transform, box-shadow',
                          boxShadow: '0 -1px 1px 0 rgba(255, 255, 255, 0.1) inset, 0 4px 8px -2px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translate3d(0, -4px, 0)'
                          e.currentTarget.style.boxShadow = '0 -1px 2px 0 rgba(255, 255, 255, 0.15) inset, 0 12px 24px -6px rgba(0, 0, 0, 0.12), 0 8px 16px -4px rgba(0, 0, 0, 0.06)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translate3d(0, 0, 0)'
                          e.currentTarget.style.boxShadow = '0 -1px 1px 0 rgba(255, 255, 255, 0.1) inset, 0 4px 8px -2px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)'
                        }}
                        onClick={() => openEditor(note)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <h3 className="font-display font-semibold text-lg line-clamp-2 flex-1 text-gray-900 dark:text-gray-100 tracking-tight">
                            {note.title || 'Untitled'}
                          </h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteNote(note.id)
                            }}
                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-150 focus-ring ml-2"
                            aria-label="Delete note"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                        
                        {note.tags && note.tags.length > 0 && (
                          <div className="mb-4">
                            <TagDisplay tagIds={note.tags} maxDisplay={3} />
                          </div>
                        )}
                        
                        {note.content && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-4 mb-4 leading-relaxed">
                            {note.content}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between text-xs pt-4 border-t border-gray-100 dark:border-gray-800">
                          <time
                            dateTime={note.updatedAt}
                            className="text-gray-500 dark:text-gray-500 font-medium"
                          >
                            {new Date(note.updatedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </time>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent-600 dark:text-accent-400 font-semibold flex items-center gap-1">
                            Open →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Note Editor Modal */}
      {editingNote && (
        <NoteEditor note={editingNote} onClose={closeEditor} />
      )}

      {/* Search Panel */}
      {showSearch && (
        <SearchPanel
          onClose={() => setShowSearch(false)}
          onSelectNote={(note) => {
            setShowSearch(false)
            setEditingNote(note)
          }}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

export default App