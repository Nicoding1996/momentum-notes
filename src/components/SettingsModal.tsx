import { useState, useRef, useEffect } from 'react'
import { X, Download, Upload, Trash2, Database, AlertTriangle, Check, Info, Heart } from 'lucide-react'
import {
  exportAllData,
  downloadAsJSON,
  parseImportFile,
  previewImport,
  importData,
  getDatabaseStats,
  clearAllData,
} from '@/lib/export-import'
import type { ExportData, ImportPreview, ImportMode } from '@/types/export'

interface SettingsModalProps {
  onClose: () => void
}

type Tab = 'data' | 'about'

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('data')
  const [stats, setStats] = useState({ noteCount: 0, edgeCount: 0, tagCount: 0 })
  const [isExporting, setIsExporting] = useState(false)
  const [importFile, setImportFile] = useState<ExportData | null>(null)
  const [importPreviewData, setImportPreviewData] = useState<ImportPreview | null>(null)
  const [importMode, setImportMode] = useState<ImportMode>('merge')
  const [isImporting, setIsImporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    const data = await getDatabaseStats()
    setStats(data)
  }

  const handleExport = async () => {
    setIsExporting(true)
    setMessage(null)
    try {
      const data = await exportAllData()
      downloadAsJSON(data)
      setMessage({ type: 'success', text: '✓ Data exported successfully!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setMessage(null)
    try {
      const data = await parseImportFile(file)
      setImportFile(data)
      const preview = await previewImport(data)
      setImportPreviewData(preview)
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Invalid file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
      setImportFile(null)
      setImportPreviewData(null)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImport = async () => {
    if (!importFile) return

    if (importMode === 'replace') {
      const confirmed = confirm(
        '⚠️ WARNING: Replace mode will DELETE all your existing data and replace it with the imported data.\n\nThis action cannot be undone.\n\nAre you absolutely sure?'
      )
      if (!confirmed) return
    }

    setIsImporting(true)
    setMessage(null)
    try {
      const result = await importData(importFile, importMode)
      
      if (result.success) {
        setMessage({ type: 'success', text: result.message })
        await loadStats()
        setImportFile(null)
        setImportPreviewData(null)
        
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        setMessage({ type: 'error', text: result.message })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleClearAll = async () => {
    const confirmed = confirm(
      '⚠️ DANGER: This will permanently delete ALL your notes, connections, and tags.\n\nThis action CANNOT be undone.\n\nType "DELETE" in the next prompt to confirm.'
    )
    if (!confirmed) return

    const typed = prompt('Type DELETE to confirm:')
    if (typed !== 'DELETE') {
      alert('Cancellation confirmed. Your data is safe.')
      return
    }

    try {
      await clearAllData()
      setMessage({ type: 'success', text: 'All data cleared successfully' })
      await loadStats()
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Failed to clear data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in">
      <div className="modal-backdrop" onClick={onClose} />
      
      <div className="modal w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center shadow-sm">
              <Database className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="btn-icon"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200/60 dark:border-gray-800/60 px-8 bg-gray-50/50 dark:bg-gray-900/50">
          <button
            onClick={() => setActiveTab('data')}
            className={`px-5 py-4 font-semibold border-b-2 transition-all ${
              activeTab === 'data'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Data Management
            </div>
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`px-5 py-4 font-semibold border-b-2 transition-all ${
              activeTab === 'about'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              About
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {/* Message Display */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${
                message.type === 'success'
                  ? 'bg-success-50 dark:bg-success-900/20 text-success-800 dark:text-success-200 border border-success-200/50 dark:border-success-800/50'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200/50 dark:border-red-800/50'
              }`}
            >
              {message.type === 'success' ? (
                <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-8">
              {/* Statistics */}
              <section>
                <h3 className="text-lg font-semibold mb-5 text-gray-900 dark:text-gray-100 tracking-tight">Database Statistics</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="card p-5 text-center">
                    <div className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">
                      {stats.noteCount}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Notes</div>
                  </div>
                  <div className="card p-5 text-center">
                    <div className="text-4xl font-bold text-accent-600 dark:text-accent-400 mb-2">
                      {stats.edgeCount}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Connections</div>
                  </div>
                  <div className="card p-5 text-center">
                    <div className="text-4xl font-bold text-success-600 dark:text-success-400 mb-2">
                      {stats.tagCount}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Tags</div>
                  </div>
                </div>
              </section>

              {/* Export Section */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 tracking-tight">Export Data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">
                  Download all your notes, connections, and tags as a JSON file. Use this to backup your
                  data or transfer it to another device.
                </p>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="btn-primary"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? 'Exporting...' : 'Export All Data'}
                </button>
              </section>

              {/* Import Section */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 tracking-tight">Import Data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">
                  Import data from a previously exported JSON file.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary"
                >
                  <Upload className="w-4 h-4" />
                  Select File
                </button>

                {/* Import Preview */}
                {importFile && importPreviewData && (
                  <div className="mt-5 p-5 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200/50 dark:border-primary-800/50">
                    <h4 className="font-semibold mb-4 text-primary-900 dark:text-primary-100 flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      Import Preview
                    </h4>
                    <div className="grid grid-cols-3 gap-4 mb-5">
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Notes</div>
                        <div className="font-semibold text-lg">
                          <span className="text-success-600 dark:text-success-400">
                            +{importPreviewData.new_notes}
                          </span>
                          {importPreviewData.existing_notes > 0 && (
                            <span className="text-gray-500 text-sm ml-2">
                              ({importPreviewData.existing_notes} existing)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Connections</div>
                        <div className="font-semibold text-lg">
                          <span className="text-success-600 dark:text-success-400">
                            +{importPreviewData.new_edges}
                          </span>
                          {importPreviewData.existing_edges > 0 && (
                            <span className="text-gray-500 text-sm ml-2">
                              ({importPreviewData.existing_edges} existing)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tags</div>
                        <div className="font-semibold text-lg">
                          <span className="text-success-600 dark:text-success-400">
                            +{importPreviewData.new_tags}
                          </span>
                          {importPreviewData.existing_tags > 0 && (
                            <span className="text-gray-500 text-sm ml-2">
                              ({importPreviewData.existing_tags} existing)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Import Mode Selector */}
                    <div className="mb-5">
                      <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">
                        Import Mode
                      </label>
                      <div className="space-y-3">
                        <label className="card-hover flex items-start gap-3 p-4 cursor-pointer has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50/50 dark:has-[:checked]:bg-primary-900/30">
                          <input
                            type="radio"
                            name="importMode"
                            value="merge"
                            checked={importMode === 'merge'}
                            onChange={() => setImportMode('merge')}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                              Merge (Recommended)
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Add new items, skip existing ones. Your current data stays safe.
                            </div>
                          </div>
                        </label>
                        <label className="card-hover flex items-start gap-3 p-4 cursor-pointer has-[:checked]:border-red-500 has-[:checked]:bg-red-50/50 dark:has-[:checked]:bg-red-900/30">
                          <input
                            type="radio"
                            name="importMode"
                            value="replace"
                            checked={importMode === 'replace'}
                            onChange={() => setImportMode('replace')}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-red-900 dark:text-red-100 mb-1 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" />
                              Replace (Dangerous)
                            </div>
                            <div className="text-sm text-red-600 dark:text-red-400">
                              Delete all existing data and replace with imported data. Cannot be undone!
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleImport}
                        disabled={isImporting}
                        className={`flex-1 btn ${
                          importMode === 'replace'
                            ? 'bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white'
                            : 'btn-primary'
                        }`}
                      >
                        <Upload className="w-4 h-4" />
                        {isImporting ? 'Importing...' : `Confirm ${importMode === 'merge' ? 'Merge' : 'Replace'}`}
                      </button>
                      <button
                        onClick={() => {
                          setImportFile(null)
                          setImportPreviewData(null)
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Danger Zone */}
              <section className="border-t border-red-200 dark:border-red-800/50 pt-8">
                <h3 className="text-lg font-semibold mb-3 text-red-600 dark:text-red-400 tracking-tight flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Danger Zone
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">
                  Permanently delete all your data. This action cannot be undone.
                </p>
                <button
                  onClick={handleClearAll}
                  className="btn bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white focus-visible:ring-red-500/50"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All Data
                </button>
              </section>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-8">
              <section>
                <h3 className="text-lg font-semibold mb-5 text-gray-900 dark:text-gray-100 tracking-tight">About Momentum Notes</h3>
                <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  <div className="card p-5">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Version 1.0.0</div>
                    <p>
                      Momentum Notes is an innovative Progressive Web App that leverages Chrome's built-in
                      Gemini Nano AI to provide a seamless, offline-first note-taking experience.
                    </p>
                  </div>

                  <div className="card p-5">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Key Features</div>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-lg bg-success-100 dark:bg-success-900/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm">🔒</span>
                        </span>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">100% Offline Operation</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">All data stays on your device, completely private</div>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-lg bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm">✨</span>
                        </span>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">AI-Powered Intelligence</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">On-device Gemini Nano for text expansion and improvement</div>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-lg bg-accent-100 dark:bg-accent-900/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm">🎨</span>
                        </span>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">Visual Canvas Interface</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Organize notes spatially on an infinite canvas</div>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="card p-6">
                <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Open Source</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                  Momentum Notes is open source and available on GitHub. Contributions welcome!
                </p>
                <a
                  href="https://github.com/Nicoding1996/momentum-notes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:underline text-sm font-medium"
                >
                  View on GitHub →
                </a>
              </section>

              <section className="text-center pt-6 border-t border-gray-200/60 dark:border-gray-800/60">
                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-center gap-2">
                  Built with <Heart className="w-4 h-4 text-red-500 fill-current" /> by the Momentum team
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  Powered by Chrome Built-in AI • 100% Offline • Privacy First
                </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}