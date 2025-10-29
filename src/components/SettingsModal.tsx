import { useState, useRef, useEffect } from 'react'
import { X, Download, Upload, Trash2, Database, AlertTriangle, Check } from 'lucide-react'
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

  // Load stats on mount
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

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImport = async () => {
    if (!importFile) return

    // Confirmation for replace mode
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
        
        // Reload the page after 2 seconds to show fresh data
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-2xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible-ring"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 px-6">
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'data'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Data Management
            </div>
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'about'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            About
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Message Display */}
          {message && (
            <div
              className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
                message.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
              }`}
            >
              {message.type === 'success' ? (
                <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-sm">{message.text}</p>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-8">
              {/* Statistics */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Database Statistics</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 text-center">
                    <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                      {stats.noteCount}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Notes</div>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 text-center">
                    <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                      {stats.edgeCount}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Connections</div>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 text-center">
                    <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                      {stats.tagCount}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Tags</div>
                  </div>
                </div>
              </section>

              {/* Export Section */}
              <section>
                <h3 className="text-lg font-semibold mb-2">Export Data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Download all your notes, connections, and tags as a JSON file. Use this to backup your
                  data or transfer it to another device.
                </p>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? 'Exporting...' : 'Export All Data'}
                </button>
              </section>

              {/* Import Section */}
              <section>
                <h3 className="text-lg font-semibold mb-2">Import Data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
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
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Select File
                </button>

                {/* Import Preview */}
                {importFile && importPreviewData && (
                  <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold mb-3 text-blue-900 dark:text-blue-100">
                      Import Preview
                    </h4>
                    <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                      <div>
                        <div className="text-gray-600 dark:text-gray-400">Notes</div>
                        <div className="font-medium">
                          <span className="text-green-600 dark:text-green-400">
                            +{importPreviewData.new_notes}
                          </span>
                          {importPreviewData.existing_notes > 0 && (
                            <span className="text-gray-500 ml-1">
                              ({importPreviewData.existing_notes} existing)
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600 dark:text-gray-400">Connections</div>
                        <div className="font-medium">
                          <span className="text-green-600 dark:text-green-400">
                            +{importPreviewData.new_edges}
                          </span>
                          {importPreviewData.existing_edges > 0 && (
                            <span className="text-gray-500 ml-1">
                              ({importPreviewData.existing_edges} existing)
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600 dark:text-gray-400">Tags</div>
                        <div className="font-medium">
                          <span className="text-green-600 dark:text-green-400">
                            +{importPreviewData.new_tags}
                          </span>
                          {importPreviewData.existing_tags > 0 && (
                            <span className="text-gray-500 ml-1">
                              ({importPreviewData.existing_tags} existing)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Import Mode Selector */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                        Import Mode
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors hover:bg-blue-100/50 dark:hover:bg-blue-900/30 has-[:checked]:border-primary-500 has-[:checked]:bg-blue-100 dark:has-[:checked]:bg-blue-900/40">
                          <input
                            type="radio"
                            name="importMode"
                            value="merge"
                            checked={importMode === 'merge'}
                            onChange={() => setImportMode('merge')}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              Merge (Recommended)
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              Add new items, skip existing ones. Your current data stays safe.
                            </div>
                          </div>
                        </label>
                        <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors hover:bg-red-100/50 dark:hover:bg-red-900/30 has-[:checked]:border-red-500 has-[:checked]:bg-red-100 dark:has-[:checked]:bg-red-900/40">
                          <input
                            type="radio"
                            name="importMode"
                            value="replace"
                            checked={importMode === 'replace'}
                            onChange={() => setImportMode('replace')}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-red-900 dark:text-red-100">
                              Replace (Dangerous)
                            </div>
                            <div className="text-xs text-red-600 dark:text-red-400">
                              Delete all existing data and replace with imported data. Cannot be undone!
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleImport}
                        disabled={isImporting}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                          importMode === 'replace'
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-primary-500 hover:bg-primary-600 text-white'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <Upload className="w-4 h-4" />
                        {isImporting ? 'Importing...' : `Confirm ${importMode === 'merge' ? 'Merge' : 'Replace'}`}
                      </button>
                      <button
                        onClick={() => {
                          setImportFile(null)
                          setImportPreviewData(null)
                        }}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Danger Zone */}
              <section className="border-t border-gray-200 dark:border-gray-800 pt-6">
                <h3 className="text-lg font-semibold mb-2 text-red-600 dark:text-red-400">
                  Danger Zone
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Permanently delete all your data. This action cannot be undone.
                </p>
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All Data
                </button>
              </section>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-semibold mb-4">About Momentum Notes</h3>
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  <p>
                    <strong className="text-gray-900 dark:text-gray-100">Version:</strong> 1.0.0
                  </p>
                  <p>
                    Momentum Notes is an innovative Progressive Web App that leverages Chrome's built-in
                    Gemini Nano AI to provide a seamless, offline-first note-taking experience.
                  </p>
                  <p className="pt-4 border-t border-gray-200 dark:border-gray-800">
                    <strong className="text-gray-900 dark:text-gray-100">Features:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>100% Offline Operation</li>
                    <li>AI-Powered Intelligence (Gemini Nano)</li>
                    <li>Visual Canvas Interface</li>
                    <li>Privacy First - All data stays on your device</li>
                    <li>Cross-platform PWA</li>
                  </ul>
                </div>
              </section>

              <section className="pt-6 border-t border-gray-200 dark:border-gray-800">
                <h4 className="font-semibold mb-2">Open Source</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Momentum Notes is open source and available on GitHub.
                </p>
                <a
                  href="https://github.com/Nicoding1996/momentum-notes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 hover:underline text-sm"
                >
                  View on GitHub →
                </a>
              </section>

              <section className="pt-6 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400">
                <p>Built with ❤️ by the Momentum team</p>
                <p className="mt-2">Powered by Chrome Built-in AI • 100% Offline • Privacy First</p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}