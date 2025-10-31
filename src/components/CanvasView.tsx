import { useCallback, useMemo, useState, useEffect, useRef, memo } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  NodeMouseHandler,
  NodeTypes,
  Connection,
  Handle,
  Position,
  ConnectionMode,
  ReactFlowProvider,
  useReactFlow,
  NodeResizer,
  NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Trash2, Edit, Sparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Note, NoteColorId } from '@/types/note'
import { NOTE_COLORS } from '@/types/note'
import type { NoteEdge } from '@/types/edge'
import { RELATIONSHIP_TYPES } from '@/types/edge'
import { db } from '@/lib/db'
import { useChromeAI } from '@/hooks/useChromeAI'
import { TagDisplay } from '@/components/ui/TagDisplay'
import { NoteColorPicker } from '@/components/ui/NoteColorPicker'
import { CanvasFormattingToolbar, type FormatType } from '@/components/ui/CanvasFormattingToolbar'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { EdgeContextMenu } from '@/components/ui/EdgeContextMenu'
import { NodeContextMenu } from '@/components/ui/NodeContextMenu'
import { CanvasContextMenu } from '@/components/ui/CanvasContextMenu'
import { CanvasFindDialog } from '@/components/ui/CanvasFindDialog'
import { useToast } from '@/contexts/ToastContext'
import { useCanvasHistory } from '@/hooks/useCanvasHistory'

interface CanvasViewProps {
  notes: Note[]
  onEditNote: (note: Note) => void
  onDeleteNote: (id: string) => void
  onViewportCenterChange?: (center: { x: number; y: number }) => void
}

// Helper function to strip HTML tags for preview
function stripHtmlTags(html: string): string {
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// Custom Note Node Component with inline editing capability
const NoteNode = memo(({ data }: { data: any }) => {
  const [title, setTitle] = useState(data.title || 'Untitled')
  const [content, setContent] = useState(() => {
    return data.content ? stripHtmlTags(data.content) : ''
  })
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isEditingContent, setIsEditingContent] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout>()
  const isEditingRef = useRef(false)
  const [nodeSize, setNodeSize] = useState({ width: data.width || 320, height: data.height || 280 })

  // Get color configuration
  const noteColor = data.color || 'default'
  const colorConfig = NOTE_COLORS[noteColor as NoteColorId]
  const isEditing = isEditingTitle || isEditingContent
  
  // Show toolbar when editing content AND note is large enough
  const showToolbar = isEditingContent && nodeSize.width > 350 && nodeSize.height > 300

  // Track editing state
  useEffect(() => {
    isEditingRef.current = isEditingTitle || isEditingContent
  }, [isEditingTitle, isEditingContent])

  // Sync with props only when not editing
  useEffect(() => {
    if (!isEditingRef.current) {
      setTitle(data.title || 'Untitled')
      setContent(data.content ? stripHtmlTags(data.content) : '')
    }
  }, [data.title, data.content])

  // Auto-save with debounce
  useEffect(() => {
    // Skip auto-save if we're not editing
    if (!isEditingRef.current) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (data.onUpdate) {
        data.onUpdate({ title, content })
      }
    }, 1000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [title, content, data])

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingTitle(true)
    setTimeout(() => titleRef.current?.focus(), 0)
  }

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingContent(true)
    setTimeout(() => contentRef.current?.focus(), 0)
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMod = e.metaKey || e.ctrlKey

    if (e.key === 'Escape') {
      e.preventDefault()
      handleDoneEditing()
    } else if (isMod && e.key === 'b') {
      e.preventDefault()
      handleFormat('bold')
    } else if (isMod && e.key === 'i') {
      e.preventDefault()
      handleFormat('italic')
    } else if (isMod && e.key === 'u') {
      e.preventDefault()
      handleFormat('underline')
    }
  }

  const handleTitleBlur = () => {
    setIsEditingTitle(false)
    if (data.onUpdate) {
      data.onUpdate({ title, content })
    }
  }

  const handleContentBlur = () => {
    setIsEditingContent(false)
    if (data.onUpdate) {
      data.onUpdate({ title, content })
    }
  }

  const handleColorChange = (newColor: NoteColorId) => {
    if (data.onColorChange) {
      data.onColorChange(newColor)
    }
  }

  // Handle text formatting
  const handleFormat = (format: FormatType) => {
    const textarea = contentRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)
    let newContent = content
    let newCursorPos = start

    switch (format) {
      case 'bold':
        if (selectedText) {
          newContent = content.substring(0, start) + `**${selectedText}**` + content.substring(end)
          newCursorPos = start + selectedText.length + 4
        } else {
          newContent = content.substring(0, start) + '****' + content.substring(end)
          newCursorPos = start + 2
        }
        break
      case 'italic':
        if (selectedText) {
          newContent = content.substring(0, start) + `*${selectedText}*` + content.substring(end)
          newCursorPos = start + selectedText.length + 2
        } else {
          newContent = content.substring(0, start) + '**' + content.substring(end)
          newCursorPos = start + 1
        }
        break
      case 'underline':
        if (selectedText) {
          newContent = content.substring(0, start) + `__${selectedText}__` + content.substring(end)
          newCursorPos = start + selectedText.length + 4
        } else {
          newContent = content.substring(0, start) + '____' + content.substring(end)
          newCursorPos = start + 2
        }
        break
      case 'strikethrough':
        if (selectedText) {
          newContent = content.substring(0, start) + `~~${selectedText}~~` + content.substring(end)
          newCursorPos = start + selectedText.length + 4
        } else {
          newContent = content.substring(0, start) + '~~~~' + content.substring(end)
          newCursorPos = start + 2
        }
        break
      case 'h1':
        newContent = content.substring(0, start) + '# ' + content.substring(start)
        newCursorPos = start + 2
        break
      case 'h2':
        newContent = content.substring(0, start) + '## ' + content.substring(start)
        newCursorPos = start + 3
        break
      case 'h3':
        newContent = content.substring(0, start) + '### ' + content.substring(start)
        newCursorPos = start + 4
        break
      case 'bullet':
        newContent = content.substring(0, start) + '• ' + content.substring(start)
        newCursorPos = start + 2
        break
      case 'numbered':
        newContent = content.substring(0, start) + '1. ' + content.substring(start)
        newCursorPos = start + 3
        break
    }

    setContent(newContent)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const handleDoneEditing = () => {
    setIsEditingContent(false)
    if (data.onUpdate) {
      data.onUpdate({ title, content })
    }
  }

  // Track node size for toolbar visibility
  useEffect(() => {
    const updateSize = () => {
      const element = contentRef.current?.closest('.react-flow__node')
      if (element) {
        const rect = element.getBoundingClientRect()
        setNodeSize({ width: rect.width, height: rect.height })
      }
    }
    
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  return (
    <>
      {/* Enhanced Resize handles - Larger, always-visible corners */}
      <NodeResizer
        minWidth={280}
        minHeight={240}
        maxWidth={700}
        maxHeight={900}
        isVisible={true}
        lineClassName="!border !border-accent-400/30 dark:!border-accent-500/30"
        handleClassName="!w-5 !h-5 !bg-white dark:!bg-gray-800 !border-2 !border-accent-500 dark:!border-accent-400 !rounded-full !opacity-100 !transition-all !duration-200 hover:!scale-125 hover:!border-accent-600 dark:hover:!border-accent-300"
        handleStyle={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: 'white',
          border: '2px solid #fbbf24',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 4px rgba(251, 191, 36, 0.1)',
          cursor: 'nwse-resize',
        }}
      />
      <div
        className={`
          ${colorConfig.background}
          border-2
          ${isEditing ? 'border-accent-500 dark:border-accent-400' : colorConfig.border}
          ${!isEditing && colorConfig.hover}
          rounded-2xl p-8 w-full h-full relative group transition-all duration-200 ease-out overflow-hidden flex flex-col
        `}
        style={{
          willChange: 'transform, box-shadow',
          transform: 'translate3d(0, 0, 0)',
          boxShadow: isEditing
            ? '0 0 0 3px rgba(251, 191, 36, 0.1), 0 -1px 2px 0 rgba(255, 255, 255, 0.15) inset, 0 8px 20px -4px rgba(0, 0, 0, 0.15)'
            : '0 -1px 1px 0 rgba(255, 255, 255, 0.1) inset, 0 4px 8px -2px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
        }}
        onMouseEnter={(e) => {
          if (!isEditing) {
            e.currentTarget.style.transform = 'translate3d(0, -2px, 0)'
            e.currentTarget.style.boxShadow = '0 -1px 2px 0 rgba(255, 255, 255, 0.15) inset, 0 8px 16px -4px rgba(0, 0, 0, 0.12), 0 4px 8px -2px rgba(0, 0, 0, 0.06)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isEditing) {
            e.currentTarget.style.transform = 'translate3d(0, 0, 0)'
            e.currentTarget.style.boxShadow = '0 -1px 1px 0 rgba(255, 255, 255, 0.1) inset, 0 4px 8px -2px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)'
          }
        }}
      >
      {/* Connection handles - Using single handles that work as both source and target */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        isConnectable={true}
        className="w-4 h-4 !bg-accent-500 dark:!bg-accent-400 opacity-0 group-hover:opacity-100 transition-all duration-200 !border-2 !border-white dark:!border-gray-800 hover:scale-125"
        style={{ boxShadow: '0 2px 6px rgba(251, 191, 36, 0.4)' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        isConnectable={true}
        className="w-4 h-4 !bg-accent-500 dark:!bg-accent-400 opacity-0 group-hover:opacity-100 transition-all duration-200 !border-2 !border-white dark:!border-gray-800 hover:scale-125"
        style={{ boxShadow: '0 2px 6px rgba(251, 191, 36, 0.4)', pointerEvents: 'none' }}
      />
      
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        isConnectable={true}
        className="w-4 h-4 !bg-accent-500 dark:!bg-accent-400 opacity-0 group-hover:opacity-100 transition-all duration-200 !border-2 !border-white dark:!border-gray-800 hover:scale-125"
        style={{ boxShadow: '0 2px 6px rgba(251, 191, 36, 0.4)' }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom"
        isConnectable={true}
        className="w-4 h-4 !bg-accent-500 dark:!bg-accent-400 opacity-0 group-hover:opacity-100 transition-all duration-200 !border-2 !border-white dark:!border-gray-800 hover:scale-125"
        style={{ boxShadow: '0 2px 6px rgba(251, 191, 36, 0.4)', pointerEvents: 'none' }}
      />
      
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        isConnectable={true}
        className="w-4 h-4 !bg-accent-500 dark:!bg-accent-400 opacity-0 group-hover:opacity-100 transition-all duration-200 !border-2 !border-white dark:!border-gray-800 hover:scale-125"
        style={{ boxShadow: '0 2px 6px rgba(251, 191, 36, 0.4)' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        isConnectable={true}
        className="w-4 h-4 !bg-accent-500 dark:!bg-accent-400 opacity-0 group-hover:opacity-100 transition-all duration-200 !border-2 !border-white dark:!border-gray-800 hover:scale-125"
        style={{ boxShadow: '0 2px 6px rgba(251, 191, 36, 0.4)', pointerEvents: 'none' }}
      />
      
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        isConnectable={true}
        className="w-4 h-4 !bg-accent-500 dark:!bg-accent-400 opacity-0 group-hover:opacity-100 transition-all duration-200 !border-2 !border-white dark:!border-gray-800 hover:scale-125"
        style={{ boxShadow: '0 2px 6px rgba(251, 191, 36, 0.4)' }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        isConnectable={true}
        className="w-4 h-4 !bg-accent-500 dark:!bg-accent-400 opacity-0 group-hover:opacity-100 transition-all duration-200 !border-2 !border-white dark:!border-gray-800 hover:scale-125"
        style={{ boxShadow: '0 2px 6px rgba(251, 191, 36, 0.4)', pointerEvents: 'none' }}
      />
      
      <div className="flex items-start justify-between mb-4 flex-shrink-0">
        {isEditingTitle ? (
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleTitleBlur()
              }
            }}
            className="font-display font-semibold text-xl flex-1 text-gray-900 dark:text-gray-100 tracking-tight bg-transparent border-none outline-none focus:outline-none px-1"
          />
        ) : (
          <h4
            className="font-display font-semibold text-xl line-clamp-3 flex-1 text-gray-900 dark:text-gray-100 tracking-tight cursor-text px-1 py-0.5"
            onClick={handleTitleClick}
          >
            {title || 'Untitled'}
          </h4>
        )}
        <div className="flex gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
          <NoteColorPicker
            currentColor={noteColor as NoteColorId}
            onChange={handleColorChange}
          />
          <button
            onClick={(e) => {
              e.stopPropagation()
              data.onEdit()
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150"
            aria-label="Edit note"
          >
            <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              data.onDelete()
            }}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-150"
            aria-label="Delete note"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>
      {data.tags && data.tags.length > 0 && (
        <div className="mb-4 flex-shrink-0">
          <TagDisplay tagIds={data.tags} maxDisplay={2} />
        </div>
      )}
      
      {/* Formatting Toolbar - Only show when editing content and note is large enough */}
      {showToolbar && (
        <CanvasFormattingToolbar
          onFormat={handleFormat}
          onDone={handleDoneEditing}
        />
      )}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {isEditingContent ? (
          <textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleContentBlur}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            className="text-base text-gray-600 dark:text-gray-300 leading-relaxed flex-1 bg-transparent border-none outline-none focus:outline-none px-1 resize-none"
            placeholder="Click to add content..."
          />
        ) : (
          <p
            className="text-base text-gray-600 dark:text-gray-300 line-clamp-5 leading-relaxed flex-1 cursor-text px-1 py-0.5 relative"
            style={{
              maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)'
            }}
            onClick={handleContentClick}
          >
            {content || 'Click to add content...'}
          </p>
        )}
      </div>
      <p className="text-sm text-gray-400 dark:text-gray-500 mt-auto pt-4 font-medium flex-shrink-0">
        {new Date(data.updatedAt).toLocaleDateString()}
      </p>
      </div>
    </>
  )
})

const nodeTypes: NodeTypes = {
  noteNode: NoteNode,
}

function CanvasViewInner({ notes, onEditNote, onDeleteNote, onViewportCenterChange }: CanvasViewProps) {
  const [isAutoLinking, setIsAutoLinking] = useState(false)
  const { generateText, status } = useChromeAI()
  const [showAutoLinkAlert, setShowAutoLinkAlert] = useState(false)
  const [autoLinkMessage, setAutoLinkMessage] = useState('')
  const [autoLinkVariant, setAutoLinkVariant] = useState<'info' | 'success' | 'warning'>('info')
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { setViewport, getViewport } = useReactFlow()
  const [currentZoom, setCurrentZoom] = useState(100)
  const { showToast } = useToast()
  
  // Canvas Find state
  const [showFindDialog, setShowFindDialog] = useState(false)
  const [matchingNoteIds, setMatchingNoteIds] = useState<string[]>([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null)
  
  // Context menu state - unified for all context menu types
  const [contextMenu, setContextMenu] = useState<{
    type: 'edge' | 'node' | 'canvas'
    edgeId?: string
    nodeId?: string
    x: number
    y: number
    currentType?: string
  } | null>(null)
  
  // Clipboard state for copy/paste
  const [copiedNode, setCopiedNode] = useState<Node | null>(null)
  
  // Selected node for keyboard shortcuts
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  
  // Canvas history for undo/redo
  const { canUndo, canRedo, undo, redo, pushHistory } = useCanvasHistory()
  
  // Debounced save for performance - save positions after user stops dragging/resizing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingSavesRef = useRef<Map<string, { x?: number; y?: number; width?: number; height?: number }>>(new Map())
  
  // Custom zoom handling for enhanced responsiveness
  const touchStartRef = useRef<{ dist: number; x: number; y: number } | null>(null)
  
  // Track zoom changes and report viewport center
  useEffect(() => {
    const interval = setInterval(() => {
      const viewport = getViewport()
      setCurrentZoom(Math.round(viewport.zoom * 100))
      
      // Calculate and report viewport center for new note placement
      if (onViewportCenterChange && reactFlowWrapper.current) {
        const rect = reactFlowWrapper.current.getBoundingClientRect()
        const centerX = (-viewport.x + rect.width / 2) / viewport.zoom
        const centerY = (-viewport.y + rect.height / 2) / viewport.zoom
        onViewportCenterChange({ x: centerX, y: centerY })
      }
    }, 100)
    return () => clearInterval(interval)
  }, [getViewport, onViewportCenterChange])

  // Fetch edges from database
  const noteEdges: NoteEdge[] = useLiveQuery(() => db.edges.toArray(), []) ?? []
  
  // Handle inline note updates
  const handleNoteUpdate = useCallback(async (noteId: string, updates: { title?: string; content?: string }) => {
    try {
      const note = notes.find(n => n.id === noteId)
      if (!note) return

      const now = new Date().toISOString()
      await db.notes.update(noteId, {
        title: updates.title !== undefined ? updates.title : note.title,
        content: updates.content !== undefined ? updates.content : note.content,
        updatedAt: now,
      })
    } catch (error) {
      console.error('Failed to update note:', error)
    }
  }, [notes])

  // Handle note color change
  const handleNoteColorChange = useCallback(async (noteId: string, color: NoteColorId) => {
    try {
      await db.notes.update(noteId, {
        color: color,
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Failed to update note color:', error)
    }
  }, [])

  // Convert notes to React Flow nodes with proper validation
  const initialNodes: Node[] = useMemo(
    () =>
      notes.map((note, index) => {
        // Ensure position values are valid numbers - improved spacing
        const x = typeof note.x === 'number' && !isNaN(note.x) ? note.x : (index % 4) * 400 + 50
        const y = typeof note.y === 'number' && !isNaN(note.y) ? note.y : Math.floor(index / 4) * 300 + 50
        const width = typeof note.width === 'number' && !isNaN(note.width) ? note.width : 320
        const height = typeof note.height === 'number' && !isNaN(note.height) ? note.height : 280
        
        // Check if this note is highlighted in find results
        const isHighlighted = highlightedNoteId === note.id
        
        return {
          id: note.id,
          type: 'noteNode',
          position: { x, y },
          style: {
            width,
            height,
            ...(isHighlighted && {
              boxShadow: '0 0 0 4px rgba(251, 191, 36, 0.6), 0 0 20px rgba(251, 191, 36, 0.4)',
              zIndex: 1000,
            })
          },
          draggable: true,
          data: {
            title: note.title,
            content: note.content,
            tags: note.tags,
            updatedAt: note.updatedAt,
            color: note.color || 'default',
            onEdit: () => onEditNote(note),
            onDelete: () => onDeleteNote(note.id),
            onUpdate: (updates: { title?: string; content?: string }) => handleNoteUpdate(note.id, updates),
            onColorChange: (color: NoteColorId) => handleNoteColorChange(note.id, color),
          },
        }
      }),
    [notes, onEditNote, onDeleteNote, handleNoteUpdate, handleNoteColorChange, highlightedNoteId]
  )

  // Convert database edges to React Flow edges with softer, organic styling
  const initialEdges: Edge[] = useMemo(
    () =>
      noteEdges.map((edge) => {
        const relationshipType = edge.relationshipType
          ? RELATIONSHIP_TYPES[edge.relationshipType as keyof typeof RELATIONSHIP_TYPES]
          : null
        
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle || undefined,
          targetHandle: edge.targetHandle || undefined,
          label: relationshipType?.label || edge.label,
          animated: false,
          reconnectable: 'target', // Allow dragging endpoints to different handles
          style: {
            stroke: relationshipType?.color || '#a3a3a3',
            strokeWidth: 1.5,
            opacity: 0.6,
          },
          type: 'smoothstep',
          data: {
            relationshipType: edge.relationshipType,
          },
        }
      }),
    [noteEdges]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)

  // Helper function to strip HTML tags for searching
  const stripHtmlForSearch = useCallback((html: string): string => {
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }, [])

  // Search for matching notes
  const handleFindSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setMatchingNoteIds([])
      setCurrentMatchIndex(0)
      setHighlightedNoteId(null)
      return
    }

    const searchLower = query.toLowerCase()
    const matches = notes.filter(note => {
      const titleMatch = note.title.toLowerCase().includes(searchLower)
      const contentMatch = stripHtmlForSearch(note.content).toLowerCase().includes(searchLower)
      return titleMatch || contentMatch
    })

    const matchIds = matches.map(n => n.id)
    setMatchingNoteIds(matchIds)
    
    if (matchIds.length > 0) {
      setCurrentMatchIndex(0)
      setHighlightedNoteId(matchIds[0])
      // Navigate to first match
      navigateToNote(matchIds[0])
    } else {
      setCurrentMatchIndex(0)
      setHighlightedNoteId(null)
    }
  }, [notes, stripHtmlForSearch])

  // Navigate to a specific note with smooth animation
  const navigateToNote = useCallback((noteId: string) => {
    const node = nodes.find(n => n.id === noteId)
    if (!node) return

    const { zoom } = getViewport()
    const targetZoom = Math.max(zoom, 0.75) // Zoom in if needed
    
    // Get wrapper dimensions for centering
    const wrapper = reactFlowWrapper.current
    if (!wrapper) return
    
    const rect = wrapper.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    // Calculate position to center the note
    const x = centerX - node.position.x * targetZoom - (node.style?.width as number || 320) * targetZoom / 2
    const y = centerY - node.position.y * targetZoom - (node.style?.height as number || 280) * targetZoom / 2
    
    setViewport({ x, y, zoom: targetZoom }, { duration: 400 })
  }, [nodes, getViewport, setViewport])

  // Navigate to next match
  const handleFindNext = useCallback(() => {
    if (matchingNoteIds.length === 0) return
    
    const nextIndex = (currentMatchIndex + 1) % matchingNoteIds.length
    setCurrentMatchIndex(nextIndex)
    setHighlightedNoteId(matchingNoteIds[nextIndex])
    navigateToNote(matchingNoteIds[nextIndex])
  }, [matchingNoteIds, currentMatchIndex, navigateToNote])

  // Navigate to previous match
  const handleFindPrevious = useCallback(() => {
    if (matchingNoteIds.length === 0) return
    
    const prevIndex = currentMatchIndex === 0 ? matchingNoteIds.length - 1 : currentMatchIndex - 1
    setCurrentMatchIndex(prevIndex)
    setHighlightedNoteId(matchingNoteIds[prevIndex])
    navigateToNote(matchingNoteIds[prevIndex])
  }, [matchingNoteIds, currentMatchIndex, navigateToNote])

  // Close find dialog
  const handleFindClose = useCallback(() => {
    setShowFindDialog(false)
    setMatchingNoteIds([])
    setCurrentMatchIndex(0)
    setHighlightedNoteId(null)
  }, [])

  // Global keyboard shortcut for Ctrl+F / Cmd+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+F or Cmd+F
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setShowFindDialog(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Update nodes when notes change (added, removed, or content updated)
  const prevNoteCountRef = useRef(0)
  const prevNoteIdsRef = useRef(new Set<string>())
  const prevNoteDataRef = useRef(new Map<string, { title: string; content: string; updatedAt: string }>())
  
  useEffect(() => {
    const currentIds = new Set(notes.map(n => n.id))
    const prevIds = prevNoteIdsRef.current
    
    // Check if any notes were added or removed
    const hasNewNotes = notes.some(n => !prevIds.has(n.id))
    const hasRemovedNotes = Array.from(prevIds).some(id => !currentIds.has(id))
    
    // Check if any note content has changed
    const hasContentChanges = notes.some(note => {
      const prevData = prevNoteDataRef.current.get(note.id)
      if (!prevData) return true
      return prevData.title !== note.title ||
             prevData.content !== note.content ||
             prevData.updatedAt !== note.updatedAt
    })
    
    if (hasNewNotes || hasRemovedNotes || hasContentChanges || prevNoteCountRef.current === 0) {
      setNodes(initialNodes)
      prevNoteCountRef.current = notes.length
      prevNoteIdsRef.current = currentIds
      
      // Update tracked data
      const newDataMap = new Map<string, { title: string; content: string; updatedAt: string }>()
      notes.forEach(note => {
        newDataMap.set(note.id, {
          title: note.title,
          content: note.content,
          updatedAt: note.updatedAt
        })
      })
      prevNoteDataRef.current = newDataMap
    }
  }, [notes, initialNodes, setNodes])

  // Update edges when database changes
  useEffect(() => {
    setEdges(initialEdges)
  }, [noteEdges, setEdges, initialEdges])

  // Handle node click for selection (enables keyboard shortcuts)
  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id)
  }, [])

  // Handle edge selection and right-click
  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge.id)
  }, [])

  // Handle edge right-click for context menu
  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault()
    setContextMenu({
      type: 'edge',
      edgeId: edge.id,
      x: event.clientX,
      y: event.clientY,
      currentType: edge.data?.relationshipType as string | undefined,
    })
  }, [])

  // Handle node right-click for context menu
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    setSelectedNodeId(node.id)
    setContextMenu({
      type: 'node',
      nodeId: node.id,
      x: event.clientX,
      y: event.clientY,
    })
  }, [])

  // Handle canvas background right-click
  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({
      type: 'canvas',
      x: event.clientX,
      y: event.clientY,
    })
  }, [])

  // Clear selection and context menu
  const handlePaneClick = useCallback(() => {
    setSelectedEdge(null)
    setSelectedNodeId(null)
    setContextMenu(null)
  }, [])

  // Debounced save function - batch database writes for better performance
  const debouncedSavePositions = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      const saves = Array.from(pendingSavesRef.current.entries())
      if (saves.length === 0) return
      
      try {
        // Batch update all positions and dimensions at once
        await Promise.all(
          saves.map(([id, data]) => {
            const updates: any = {}
            if (data.x !== undefined) updates.x = data.x
            if (data.y !== undefined) updates.y = data.y
            if (data.width !== undefined) updates.width = data.width
            if (data.height !== undefined) updates.height = data.height
            return db.notes.update(id, updates)
          })
        )
        pendingSavesRef.current.clear()
      } catch (error) {
        console.error('Failed to save note positions/dimensions:', error)
      }
    }, 500) // Save 500ms after user stops dragging/resizing
  }, [])

  // Optimistic UI update - update immediately, save later
  const handleNodeDragStop: NodeMouseHandler = useCallback(
    (_event, node) => {
      // Store position for batch save
      const currentSave = pendingSavesRef.current.get(node.id) || {}
      pendingSavesRef.current.set(node.id, {
        ...currentSave,
        x: node.position.x,
        y: node.position.y,
      })
      
      // Trigger debounced save
      debouncedSavePositions()
    },
    [debouncedSavePositions]
  )

  // Custom onNodesChange handler to capture dimension changes from resizing
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Apply changes to nodes state
      onNodesChange(changes)
      
      // Check for dimension changes (from resizing)
      changes.forEach((change) => {
        if (change.type === 'dimensions' && change.dimensions) {
          const currentSave = pendingSavesRef.current.get(change.id) || {}
          pendingSavesRef.current.set(change.id, {
            ...currentSave,
            width: change.dimensions.width,
            height: change.dimensions.height,
          })
          
          // Trigger debounced save
          debouncedSavePositions()
        }
      })
    },
    [onNodesChange, debouncedSavePositions]
  )
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Handle new connection - use default "related-to" type
  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return

      const edgeId = nanoid()
      const now = new Date().toISOString()

      try {
        const relType = RELATIONSHIP_TYPES.RELATED_TO
        
        // Log the connection details to debug
        console.log('Connection details:', {
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle
        })
        
        await db.edges.add({
          id: edgeId,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle || undefined,
          targetHandle: connection.targetHandle || undefined,
          createdAt: now,
          relationshipType: 'related-to',
          label: relType.label,
        })

        // Show toast with hint about right-click
        showToast('Connection created! Right-click to change relationship type.', 'success')
      } catch (error) {
        console.error('Failed to save edge:', error)
        showToast('Failed to create connection', 'error')
      }
    },
    [showToast]
  )

  // Handle edge reconnection - when user drags an edge endpoint to a different handle
  const handleReconnect = useCallback(
    async (oldEdge: Edge, newConnection: Connection) => {
      try {
        console.log('Reconnecting edge:', {
          oldEdge: oldEdge.id,
          newSource: newConnection.source,
          newTarget: newConnection.target,
          newSourceHandle: newConnection.sourceHandle,
          newTargetHandle: newConnection.targetHandle
        })

        // Update the edge in the database with new handle information
        await db.edges.update(oldEdge.id, {
          source: newConnection.source || oldEdge.source,
          target: newConnection.target || oldEdge.target,
          sourceHandle: newConnection.sourceHandle || undefined,
          targetHandle: newConnection.targetHandle || undefined,
        })

        showToast('Connection updated!', 'success')
      } catch (error) {
        console.error('Failed to reconnect edge:', error)
        showToast('Failed to update connection', 'error')
      }
    },
    [showToast]
  )

  // Delete edge
  const handleEdgeDelete = useCallback(
    async (edgesToDelete: Edge[]) => {
      try {
        const edgeIds = edgesToDelete.map((e) => e.id)
        await db.edges.bulkDelete(edgeIds)
      } catch (error) {
        console.error('Failed to delete edges:', error)
      }
    },
    []
  )

  // AI-powered auto-linking
  const handleAutoLink = useCallback(async () => {
    if (notes.length < 2 || isAutoLinking) return

    setIsAutoLinking(true)
    try {
      const allTags = await db.tags.toArray()
      const tagMap = new Map(allTags.map(tag => [tag.id, tag.name]))
      
      const notesContext = notes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content.slice(0, 300),
        tags: n.tags?.map(tagId => tagMap.get(tagId)).filter(Boolean) || [],
      }))

      const prompt = `Analyze these notes and identify semantic relationships between them.

Notes:
${notesContext.map((n) => `Note ID: "${n.id}"\nTitle: "${n.title}"${n.tags.length > 0 ? `\nTags: ${n.tags.join(', ')}` : ''}\nContent: ${n.content}`).join('\n\n---\n\n')}

IMPORTANT: In your response, use the EXACT Note ID values shown above (the strings in quotes after "Note ID:").

Return a JSON array of connections. Each connection must have:
- source: EXACT Note ID string from above (e.g., "${notes[0]?.id}")
- target: EXACT Note ID string from above (e.g., "${notes[1]?.id}")
- relationshipType: one of ["related-to", "depends-on", "part-of", "supports", "contradicts", "references"]
- reason: very brief reason (max 5 words)

Relationship types explained:
- "related-to": General semantic relationship
- "depends-on": Source depends on target
- "part-of": Source is part of target
- "supports": Source supports target's argument
- "contradicts": Source contradicts target
- "references": Source references target

IMPORTANT: When analyzing relationships:
1. Prioritize the content as the primary source of semantic meaning
2. Use tags as strong signals to confirm or refine relationships
3. Notes sharing the same tags are more likely to be related
4. Consider tag overlap as a high-confidence indicator of connection

Only suggest 2-3 strong, clear semantic connections. Be selective.

Example with REAL IDs:
[{"source":"${notes[0]?.id}","target":"${notes[1]?.id}","relationshipType":"related-to","reason":"Similar topics"}]

Return ONLY the JSON array, no other text:`

      const result = await generateText(
        prompt,
        'You are a helpful assistant that analyzes notes and finds semantic relationships with specific relationship types. You MUST use the exact Note ID strings provided. Always return valid JSON arrays with relationshipType field. Pay special attention to tags as they provide strong signals about note relationships.'
      )

      console.log('AI Response:', result)

      let connections = []
      try {
        connections = JSON.parse(result.trim())
      } catch {
        const jsonMatch = result.match(/\[\s*{[\s\S]*}\s*\]/)
        if (jsonMatch) {
          connections = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No valid JSON array found in response')
        }
      }

      if (!Array.isArray(connections) || connections.length === 0) {
        console.log('No connections suggested by AI')
        setAutoLinkMessage('AI found no strong semantic connections between these notes.')
        setAutoLinkVariant('info')
        setShowAutoLinkAlert(true)
        return
      }

      const now = new Date().toISOString()
      let addedCount = 0

      const validNoteIds = new Set(notes.map(n => n.id))
      
      for (const conn of connections) {
        if (!conn.source || !conn.target) {
          console.warn('Skipping connection with missing source or target:', conn)
          continue
        }

        if (!validNoteIds.has(conn.source) || !validNoteIds.has(conn.target)) {
          console.warn('Skipping connection with invalid IDs:', conn, 'Valid IDs:', Array.from(validNoteIds))
          continue
        }

        const existingEdge = await db.edges
          .where('source')
          .equals(conn.source)
          .and(e => e.target === conn.target)
          .first()

        const reverseEdge = await db.edges
          .where('source')
          .equals(conn.target)
          .and(e => e.target === conn.source)
          .first()

        if (!existingEdge && !reverseEdge) {
          const edgeId = nanoid()
          const relType = conn.relationshipType
            ? RELATIONSHIP_TYPES[conn.relationshipType as keyof typeof RELATIONSHIP_TYPES]
            : null
            
          await db.edges.add({
            id: edgeId,
            source: conn.source,
            target: conn.target,
            createdAt: now,
            relationshipType: conn.relationshipType || 'related-to',
            label: relType?.label || conn.reason || undefined,
          })
          addedCount++
          console.log('Created connection:', conn.source, '->', conn.target, 'Type:', conn.relationshipType)
        }
      }

      if (addedCount > 0) {
        setAutoLinkMessage(`✨ Successfully created ${addedCount} connection${addedCount > 1 ? 's' : ''}!`)
        setAutoLinkVariant('success')
        setShowAutoLinkAlert(true)
      } else {
        setAutoLinkMessage('All suggested connections already exist.')
        setAutoLinkVariant('info')
        setShowAutoLinkAlert(true)
      }
    } catch (error) {
      console.error('Auto-link failed:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setAutoLinkMessage(`Failed to auto-link notes: ${errorMsg}\n\nPlease try again.`)
      setAutoLinkVariant('warning')
      setShowAutoLinkAlert(true)
    } finally {
      setIsAutoLinking(false)
    }
  }, [notes, isAutoLinking, generateText])

  // Copy node handler
  const handleCopyNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (node) {
      setCopiedNode(node)
      showToast('Note copied to clipboard', 'success')
    }
  }, [nodes, showToast])

  // Paste node handler
  const handlePasteNode = useCallback(async (position?: { x: number; y: number }) => {
    if (!copiedNode) return

    try {
      // Get the original note from database
      const originalNote = await db.notes.get(copiedNode.id)
      if (!originalNote) return

      // Create new note with copied content
      const newNote = {
        id: nanoid(),
        title: `${originalNote.title} (Copy)`,
        content: originalNote.content,
        tags: originalNote.tags || [],
        color: originalNote.color,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        x: position ? position.x : (copiedNode.position.x + 50),
        y: position ? position.y : (copiedNode.position.y + 50),
        width: copiedNode.style?.width as number || 320,
        height: copiedNode.style?.height as number || 280,
      }

      await db.notes.add(newNote)
      showToast('Note pasted successfully', 'success')
      
      // Push to history
      pushHistory(nodes, edges)
    } catch (error) {
      console.error('Failed to paste note:', error)
      showToast('Failed to paste note', 'error')
    }
  }, [copiedNode, nodes, edges, pushHistory, showToast])

  // Delete node handler
  const handleDeleteNode = useCallback(async (nodeId: string) => {
    try {
      await db.notes.delete(nodeId)
      
      // Also delete any edges connected to this node
      const connectedEdges = await db.edges.filter(
        e => e.source === nodeId || e.target === nodeId
      ).toArray()
      
      if (connectedEdges.length > 0) {
        await db.edges.bulkDelete(connectedEdges.map(e => e.id))
      }
      
      // No toast notification - user can undo if needed
      
      // Push to history
      pushHistory(nodes.filter(n => n.id !== nodeId), edges.filter(e => e.source !== nodeId && e.target !== nodeId))
    } catch (error) {
      console.error('Failed to delete note:', error)
      showToast('Failed to delete note', 'error')
    }
  }, [nodes, edges, pushHistory, showToast])

  // Create note at cursor position
  const handleCreateNoteAtCursor = useCallback(async (x: number, y: number) => {
    try {
      const viewport = getViewport()
      const rect = reactFlowWrapper.current?.getBoundingClientRect()
      
      if (!rect) return

      // Convert screen coordinates to canvas coordinates
      const canvasX = (x - rect.left - viewport.x) / viewport.zoom
      const canvasY = (y - rect.top - viewport.y) / viewport.zoom

      const newNote = {
        id: nanoid(),
        title: 'New Note',
        content: '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        x: canvasX,
        y: canvasY,
        width: 320,
        height: 280,
      }

      await db.notes.add(newNote)
      showToast('Note created', 'success')
      
      // Push to history
      pushHistory(nodes, edges)
    } catch (error) {
      console.error('Failed to create note:', error)
      showToast('Failed to create note', 'error')
    }
  }, [nodes, edges, pushHistory, getViewport, showToast])

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      
      // Ignore if user is typing in an input/textarea OR if any modal/dialog is open
      const activeElement = document.activeElement
      const isTyping = activeElement?.tagName === 'INPUT' ||
                       activeElement?.tagName === 'TEXTAREA' ||
                       activeElement?.getAttribute('contenteditable') === 'true'
      
      // Check if any modal is open by looking for common modal indicators
      const isModalOpen = document.querySelector('[role="dialog"]') !== null ||
                         document.querySelector('.modal') !== null ||
                         // Also check if the active element is inside a note editor
                         activeElement?.closest('[data-note-editor]') !== null
      
      if (isTyping || isModalOpen) {
        return
      }

      // Copy: Ctrl/Cmd + C
      if (isMod && e.key === 'c' && selectedNodeId) {
        e.preventDefault()
        handleCopyNode(selectedNodeId)
      }
      
      // Paste: Ctrl/Cmd + V
      if (isMod && e.key === 'v' && copiedNode) {
        e.preventDefault()
        handlePasteNode()
      }
      
      // Delete: Only Delete key (Backspace is too risky when typing)
      if (e.key === 'Delete' && selectedNodeId) {
        e.preventDefault()
        handleDeleteNode(selectedNodeId)
      }
      
      // Undo: Ctrl/Cmd + Z
      if (isMod && e.key === 'z' && !e.shiftKey && canUndo) {
        e.preventDefault()
        const prevState = undo()
        if (prevState) {
          setNodes(prevState.nodes)
          setEdges(prevState.edges)
        }
      }
      
      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if ((isMod && e.shiftKey && e.key === 'z') || (isMod && e.key === 'y')) {
        if (canRedo) {
          e.preventDefault()
          const nextState = redo()
          if (nextState) {
            setNodes(nextState.nodes)
            setEdges(nextState.edges)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNodeId, copiedNode, canUndo, canRedo, handleCopyNode, handlePasteNode, handleDeleteNode, undo, redo, setNodes, setEdges])

  // Push to history whenever nodes or edges change (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (nodes.length > 0) {
        pushHistory(nodes, edges)
      }
    }, 1000)
    
    return () => clearTimeout(timeout)
  }, [nodes, edges, pushHistory])

  // Enhanced pinch-to-zoom handler - supports both touch devices and trackpad
  useEffect(() => {
    const wrapper = reactFlowWrapper.current
    if (!wrapper) return

    // TRACKPAD PINCH HANDLER (for desktop)
    const handleWheel = (e: WheelEvent) => {
      // Trackpad pinch sends wheel events with ctrlKey
      if (e.ctrlKey) {
        e.preventDefault()
        e.stopPropagation()
        
        const { x, y, zoom } = getViewport()
        
        // Get mouse position for zoom center
        const cx = e.clientX
        const cy = e.clientY
        
        // Trackpad pinch: negative deltaY = zoom in, positive = zoom out
        // Increased from 1.5% to 4% steps for faster zoom
        const scaleFactor = e.deltaY < 0 ? 1.04 : 0.96
        const targetZoom = Math.max(0.05, Math.min(1, zoom * scaleFactor))
        
        // Zoom around mouse cursor
        const contentX = (cx - x) / zoom
        const contentY = (cy - y) / zoom
        const newX = cx - contentX * targetZoom
        const newY = cy - contentY * targetZoom
        
        setViewport({ x: newX, y: newY, zoom: targetZoom }, { duration: 0 })
      }
    }

    // TOUCH PINCH HANDLER (for phones/tablets)
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        const dist = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        )
        const x = (touch1.clientX + touch2.clientX) / 2
        const y = (touch1.clientY + touch2.clientY) / 2
        touchStartRef.current = { dist, x, y }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartRef.current) {
        e.preventDefault()
        e.stopPropagation()
        
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        const newDist = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        )

        const ratio = newDist / touchStartRef.current.dist
        touchStartRef.current.dist = newDist

        const { x, y, zoom } = getViewport()
        const cx = touchStartRef.current.x
        const cy = touchStartRef.current.y

        // High sensitivity exponential zoom for touch
        const sensitivity = 0.08
        const adjusted = Math.pow(ratio, 1 / sensitivity)
        const targetZoom = Math.max(0.05, Math.min(1, zoom * adjusted))

        // Zoom around pinch center
        const contentX = (cx - x) / zoom
        const contentY = (cy - y) / zoom
        const newX = cx - contentX * targetZoom
        const newY = cy - contentY * targetZoom

        setViewport({ x: newX, y: newY, zoom: targetZoom }, { duration: 0 })
      }
    }

    const handleTouchEnd = () => {
      touchStartRef.current = null
    }

    // Attach to wrapper with capture phase
    wrapper.addEventListener('wheel', handleWheel, { capture: true, passive: false })
    wrapper.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false })
    wrapper.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false })
    wrapper.addEventListener('touchend', handleTouchEnd, { capture: true })
    wrapper.addEventListener('touchcancel', handleTouchEnd, { capture: true })

    return () => {
      wrapper.removeEventListener('wheel', handleWheel, { capture: true })
      wrapper.removeEventListener('touchstart', handleTouchStart, { capture: true })
      wrapper.removeEventListener('touchmove', handleTouchMove, { capture: true })
      wrapper.removeEventListener('touchend', handleTouchEnd, { capture: true })
      wrapper.removeEventListener('touchcancel', handleTouchEnd, { capture: true })
    }
  }, [getViewport, setViewport])

  // Helper: zoom around a specific screen point to avoid "bouncing"
  const setZoomAnchored = useCallback((targetZoom: number, cx: number, cy: number, animateMs = 120) => {
    const { x, y, zoom } = getViewport()
    const clamped = Math.max(0.05, Math.min(1, targetZoom))
    const contentX = (cx - x) / zoom
    const contentY = (cy - y) / zoom
    const newX = cx - contentX * clamped
    const newY = cy - contentY * clamped
    setViewport({ x: newX, y: newY, zoom: clamped }, { duration: animateMs })
  }, [getViewport, setViewport])

  const getWrapperCenter = useCallback(() => {
    const el = reactFlowWrapper.current
    if (!el) return { cx: window.innerWidth / 2, cy: window.innerHeight / 2 }
    const rect = el.getBoundingClientRect()
    return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 }
  }, [])

  // Custom zoom controls (anchored to canvas center) with larger increments
  const handleZoomIn = useCallback(() => {
    const { zoom } = getViewport()
    const { cx, cy } = getWrapperCenter()
    setZoomAnchored(zoom + 0.25, cx, cy, 90) // 25% step
  }, [getViewport, getWrapperCenter, setZoomAnchored])

  const handleZoomOut = useCallback(() => {
    const { zoom } = getViewport()
    const { cx, cy } = getWrapperCenter()
    setZoomAnchored(zoom - 0.25, cx, cy, 90) // 25% step
  }, [getViewport, getWrapperCenter, setZoomAnchored])

  const handleZoomChange = useCallback((value: number) => {
    const { cx, cy } = getWrapperCenter()
    setCurrentZoom(value)
    setZoomAnchored(value / 100, cx, cy, 80)
  }, [getWrapperCenter, setZoomAnchored])

  const handleFitView = useCallback(() => {
    const { cx, cy } = getWrapperCenter()
    setZoomAnchored(1, cx, cy, 140)
    setCurrentZoom(100)
  }, [getWrapperCenter, setZoomAnchored])

  return (
    <div className="w-full h-full flex flex-col">
      <div
        ref={reactFlowWrapper}
        className="w-full bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 relative"
        style={{
          height: 'calc(100vh - 64px)',
          touchAction: 'none',
          willChange: 'transform',
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges.map(edge => ({
            ...edge,
            selected: edge.id === selectedEdge,
            animated: edge.id === selectedEdge,
            style: {
              ...edge.style,
              stroke: edge.id === selectedEdge ? '#f96167' : edge.style?.stroke,
              strokeWidth: edge.id === selectedEdge ? 2.5 : 1.5,
              opacity: edge.id === selectedEdge ? 1 : 0.6,
            },
          }))}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onConnect={handleConnect}
          onReconnect={handleReconnect}
          onEdgesDelete={handleEdgeDelete}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onEdgeContextMenu={handleEdgeContextMenu}
          onNodeContextMenu={handleNodeContextMenu}
          onPaneContextMenu={handlePaneContextMenu}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          minZoom={0.05}
          maxZoom={1}
          deleteKeyCode="Delete"
          selectNodesOnDrag={false}
          connectionMode={ConnectionMode.Strict}
          panOnScroll={true}
          panOnScrollSpeed={0.5}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={true}
          preventScrolling={true}
          defaultEdgeOptions={{
            animated: false,
            type: 'smoothstep',
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.5}
            className="bg-gray-50 dark:bg-gray-950"
            color="#d6d3d1"
          />
          
          {/* Custom Zoom Controls - Enhanced Canva Style */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-full px-5 py-3 shadow-xl border border-gray-200 dark:border-gray-700">
            {/* Preset Zoom Buttons */}
            <button
              onClick={() => handleZoomChange(25)}
              className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              title="25% zoom"
            >
              25%
            </button>
            <button
              onClick={() => handleZoomChange(50)}
              className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              title="50% zoom"
            >
              50%
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
            
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="5"
                max="100"
                value={currentZoom}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                className="w-32 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-500"
                style={{
                  background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${((currentZoom - 5) / 95) * 100}%, #e5e7eb ${((currentZoom - 5) / 95) * 100}%, #e5e7eb 100%)`
                }}
              />
              <button
                onClick={handleFitView}
                className="min-w-[52px] px-3 py-1 text-sm font-bold text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                {currentZoom}%
              </button>
            </div>
            
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            position="bottom-right"
            style={{
              width: 180,
              height: 120,
              bottom: 20,
              right: 20,
            }}
            className="!bg-white/98 dark:!bg-gray-900/98 !border-gray-200/80 dark:!border-gray-700/80 !shadow-2xl !rounded-2xl backdrop-blur-sm [&_.react-flow__minimap-description]:!hidden"
            nodeColor={(node) => {
              const noteColor = node.data?.color || 'default'
              const colorMap = {
                'default': '#e7e5e4',
                'blue': '#93c5fd',
                'green': '#86efac',
                'yellow': '#fde047',
                'red': '#fca5a5',
                'purple': '#d8b4fe',
                'pink': '#fbcfe8',
                'orange': '#fdba74',
                'teal': '#5eead4',
                'indigo': '#a5b4fc',
              } as const
              return colorMap[noteColor as keyof typeof colorMap] || '#e7e5e4'
            }}
            maskColor="rgba(0, 0, 0, 0.12)"
            nodeStrokeColor="#9ca3af"
          />
        </ReactFlow>

        {/* Canvas Find Dialog */}
        {showFindDialog && (
          <CanvasFindDialog
            onClose={handleFindClose}
            onSearch={handleFindSearch}
            onNext={handleFindNext}
            onPrevious={handleFindPrevious}
            currentIndex={currentMatchIndex}
            totalMatches={matchingNoteIds.length}
          />
        )}

        {/* Floating Discover Connections Button - Only show with 3+ notes */}
        {status.available && notes.length >= 3 && (
          <button
            onClick={handleAutoLink}
            disabled={isAutoLinking}
            className="absolute top-4 right-4 z-10 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-display font-semibold text-sm bg-gradient-to-br from-accent-400 via-accent-500 to-accent-600 text-gray-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-glow-accent active:scale-95"
            style={{
              boxShadow: '0 -1px 2px 0 rgba(255, 255, 255, 0.3) inset, 0 4px 12px -2px rgba(255, 215, 0, 0.4), 0 2px 6px -1px rgba(0, 0, 0, 0.1)',
              willChange: 'transform, box-shadow',
            }}
            title="AI will analyze your notes and suggest semantic connections"
          >
            <Sparkles className="w-5 h-5" />
            <span>{isAutoLinking ? 'Discovering...' : 'Discover Connections'}</span>
          </button>
        )}
      </div>

      {/* Context Menus */}
      {contextMenu?.type === 'edge' && contextMenu.edgeId && (
        <EdgeContextMenu
          edgeId={contextMenu.edgeId}
          x={contextMenu.x}
          y={contextMenu.y}
          currentType={contextMenu.currentType}
          onClose={() => setContextMenu(null)}
          onTypeChange={() => {
            // Edges will update automatically via live query
          }}
        />
      )}
      
      {contextMenu?.type === 'node' && contextMenu.nodeId && (
        <NodeContextMenu
          nodeId={contextMenu.nodeId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            const note = notes.find(n => n.id === contextMenu.nodeId)
            if (note) onEditNote(note)
          }}
          onDelete={() => {
            if (contextMenu.nodeId) handleDeleteNode(contextMenu.nodeId)
          }}
          onCopy={() => {
            if (contextMenu.nodeId) handleCopyNode(contextMenu.nodeId)
          }}
          currentColor={notes.find(n => n.id === contextMenu.nodeId)?.color as NoteColorId}
          onColorChange={(color) => {
            if (contextMenu.nodeId) handleNoteColorChange(contextMenu.nodeId, color)
          }}
        />
      )}
      
      {contextMenu?.type === 'canvas' && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onCreateNote={() => handleCreateNoteAtCursor(contextMenu.x, contextMenu.y)}
          onPaste={() => handlePasteNode()}
          onZoomToFit={handleFitView}
          hasCopiedNote={copiedNode !== null}
        />
      )}

      {/* AI Auto-Link Result Modal */}
      <ConfirmationModal
        isOpen={showAutoLinkAlert}
        onClose={() => setShowAutoLinkAlert(false)}
        onConfirm={() => setShowAutoLinkAlert(false)}
        title="AI Auto-Link Results"
        message={autoLinkMessage}
        type="alert"
        variant={autoLinkVariant}
      />
    </div>
  )
}

export function CanvasView(props: CanvasViewProps) {
  return (
    <ReactFlowProvider>
      <CanvasViewInner {...props} />
    </ReactFlowProvider>
  )
}