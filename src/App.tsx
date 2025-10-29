import { useEffect, useState } from 'react'
import { Plus, Menu, Search, Settings, Trash2, Grid, List } from 'lucide-react'
import { nanoid } from 'nanoid'
import { db, seedIfEmpty } from '@/lib/db'
import type { Note } from '@/types/note'
import { useLiveQuery } from 'dexie-react-hooks'
import { NoteEditor } from '@/components/NoteEditor'
import { CanvasView } from '@/components/CanvasView'
import { SearchPanel } from '@/components/SearchPanel'
import { TagDisplay } from '@/components/ui/TagDisplay'

type ViewMode = 'list' | 'canvas'

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showSearch, setShowSearch] = useState(false)

  // Seed demo note on first load (dev)
  useEffect(() => {
    seedIfEmpty().catch(console.error)
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

  const handleMenu = () => console.log('Menu clicked')
  const handleSearch = () => setShowSearch(true)
  const handleSettings = () => alert('Settings are coming soon')

  const handleNewNote = async () => {
    const title = prompt('Note title', 'Untitled note')
    if (title === null) return
    const id = nanoid()
    const now = new Date().toISOString()
    const note: Note = {
      id,
      title: (title || 'Untitled note').trim(),
      content: '',
      createdAt: now,
      updatedAt: now,
    }
    await db.notes.add(note)
  }

  const deleteNote = async (id: string) => {
    const ok = confirm('Delete this note?')
    if (!ok) return
    await db.notes.delete(id)
  }

  const handleGetStarted = () => {
    const el = document.getElementById('notes-section')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const openEditor = (note: Note) => {
    setEditingNote(note)
  }

  const closeEditor = () => {
    setEditingNote(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="glass border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <button onClick={handleMenu} aria-label="Open menu" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible-ring">
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="ml-4 text-2xl font-bold text-gradient">
                Momentum Notes
              </h1>
            </div>

            {/* Status & Actions */}
            <div className="flex items-center gap-4">
              {/* Online/Offline Indicator */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              <button onClick={handleSearch} aria-label="Search" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible-ring">
                <Search className="w-5 h-5" />
              </button>
              <button onClick={handleSettings} aria-label="Settings" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible-ring">
                <Settings className="w-5 h-5" />
              </button>
              <button onClick={handleNewNote} aria-label="Create new note" className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 focus-visible-ring flex items-center gap-2">
                <Plus className="w-5 h-5" />
                <span>New Note</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-20">
          <h2 className="text-4xl font-bold mb-4">
            Welcome to Momentum Notes
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            The Frictionless AI Notebook. Capture Your Cognitive Momentum.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
            {/* Feature Cards */}
            <div className="note-block p-6">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-lg font-semibold mb-2">Offline First</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Works completely offline. Your data stays on your device.
              </p>
            </div>

            <div className="note-block p-6">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-lg font-semibold mb-2">AI-Powered</h3>
              <p className="text-gray-600 dark:text-gray-400">
                On-device AI with Gemini Nano. Fast, private, free.
              </p>
            </div>

            <div className="note-block p-6">
              <div className="text-4xl mb-4">🎨</div>
              <h3 className="text-lg font-semibold mb-2">Visual Canvas</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Organize notes like sticky notes on an infinite canvas.
              </p>
            </div>
          </div>

          <div className="mt-12">
            <button onClick={handleGetStarted} aria-label="Get started" className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 focus-visible-ring text-lg font-semibold">
              Get Started
            </button>
          </div>
        </div>

        {/* Notes Section */}
        <section id="notes-section" className="max-w-7xl mx-auto mt-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Your Notes</h3>
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-gray-700 shadow'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                  } focus-visible-ring`}
                  aria-label="List view"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('canvas')}
                  className={`p-2 rounded ${
                    viewMode === 'canvas'
                      ? 'bg-white dark:bg-gray-700 shadow'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                  } focus-visible-ring`}
                  aria-label="Canvas view"
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
              <button onClick={handleNewNote} className="px-3 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 focus-visible-ring flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New Note
              </button>
            </div>
          </div>

          {/* Empty state */}
          {!notes?.length && (
            <div className="note-block p-6 text-center text-gray-600 dark:text-gray-400">
              No notes yet. Click "New Note" to create your first note.
            </div>
          )}

          {/* Notes content based on view mode */}
          {!!notes?.length && (
            <>
              {viewMode === 'list' ? (
                /* List View */
                <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {notes.map((n) => (
                    <li
                      key={n.id}
                      className="note-block p-4 cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => openEditor(n)}
                    >
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold">{n.title || 'Untitled'}</h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteNote(n.id)
                          }}
                          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible-ring"
                          aria-label="Delete note"
                        >
                          <Trash2 className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(n.updatedAt).toLocaleString()}
                      </p>
                      {n.tags && n.tags.length > 0 && (
                        <div className="mt-2">
                          <TagDisplay tagIds={n.tags} maxDisplay={3} />
                        </div>
                      )}
                      {n.content && (
                        <p className="text-gray-700 dark:text-gray-300 mt-2 line-clamp-3">
                          {n.content}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                /* Canvas View */
                <CanvasView
                  notes={notes}
                  onEditNote={openEditor}
                  onDeleteNote={deleteNote}
                />
              )}
            </>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600 dark:text-gray-400">
            <p>Built with ❤️ by the Momentum team</p>
            <p className="mt-2 text-sm">
              Powered by Chrome Built-in AI • 100% Offline • Privacy First
            </p>
          </div>
        </div>
      </footer>

      {/* Note Editor Modal */}
      {editingNote && (
        <NoteEditor note={editingNote} onClose={closeEditor} />
      )}

      {/* Search Panel */}
      {showSearch && (
        <SearchPanel
          onClose={() => setShowSearch(false)}
          onSelectNote={(note) => {
            setEditingNote(note)
          }}
        />
      )}
    </div>
  )
}

export default App