import { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Trash2, Edit, Sparkles, Filter, X, Zap } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Note } from '@/types/note'
import type { NoteEdge } from '@/types/edge'
import { RELATIONSHIP_TYPES } from '@/types/edge'
import { db } from '@/lib/db'
import { useChromeAI } from '@/hooks/useChromeAI'
import { TagDisplay } from '@/components/ui/TagDisplay'

interface CanvasViewProps {
  notes: Note[]
  onEditNote: (note: Note) => void
  onDeleteNote: (id: string) => void
}

// Custom Note Node Component with "Light from Sky" design principle
function NoteNode({ data }: { data: any }) {
  return (
    <div
      className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-700/80 rounded-2xl p-6 min-w-[240px] max-w-[340px] relative group transition-all duration-300 ease-out"
      style={{
        willChange: 'transform, box-shadow',
        transform: 'translate3d(0, 0, 0)',
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
    >
      {/* Connection handles - Accent color for visibility */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="w-3 h-3 !bg-accent-500 dark:!bg-accent-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 !border-2 !border-white dark:!border-gray-800"
        style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-3 h-3 !bg-accent-500 dark:!bg-accent-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 !border-2 !border-white dark:!border-gray-800"
        style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="w-3 h-3 !bg-accent-500 dark:!bg-accent-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 !border-2 !border-white dark:!border-gray-800"
        style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 !bg-accent-500 dark:!bg-accent-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 !border-2 !border-white dark:!border-gray-800"
        style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}
      />
      
      <div className="flex items-start justify-between mb-4">
        <h4 className="font-display font-semibold text-base line-clamp-2 flex-1 text-gray-900 dark:text-gray-100 tracking-tight">{data.title || 'Untitled'}</h4>
        <div className="flex gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
        <div className="mb-4">
          <TagDisplay tagIds={data.tags} maxDisplay={2} />
        </div>
      )}
      {data.content && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
          {data.content}
        </p>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 font-medium">
        {new Date(data.updatedAt).toLocaleDateString()}
      </p>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  noteNode: NoteNode,
}

export function CanvasView({ notes, onEditNote, onDeleteNote }: CanvasViewProps) {
  const [isAutoLinking, setIsAutoLinking] = useState(false)
  const { generateText, status } = useChromeAI()
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null)
  const [selectedRelationshipFilter, setSelectedRelationshipFilter] = useState<string>('all')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  
  // Debounced save for performance - save positions after user stops dragging
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingSavesRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  // Fetch edges from database
  const noteEdges: NoteEdge[] = useLiveQuery(() => db.edges.toArray(), []) ?? []
  
  // Filter edges based on selected relationship type
  const filteredNoteEdges = useMemo(() => {
    if (selectedRelationshipFilter === 'all') return noteEdges
    return noteEdges.filter(edge => edge.relationshipType === selectedRelationshipFilter)
  }, [noteEdges, selectedRelationshipFilter])

  // Convert notes to React Flow nodes
  const initialNodes: Node[] = useMemo(
    () =>
      notes.map((note, index) => ({
        id: note.id,
        type: 'noteNode',
        position: {
          x: note.x ?? (index % 4) * 350 + 50,
          y: note.y ?? Math.floor(index / 4) * 250 + 50,
        },
        data: {
          title: note.title,
          content: note.content,
          tags: note.tags,
          updatedAt: note.updatedAt,
          onEdit: () => onEditNote(note),
          onDelete: () => onDeleteNote(note.id),
        },
      })),
    [notes, onEditNote, onDeleteNote]
  )

  // Convert database edges to React Flow edges with softer, organic styling
  const initialEdges: Edge[] = useMemo(
    () =>
      filteredNoteEdges.map((edge) => {
        const relationshipType = edge.relationshipType
          ? RELATIONSHIP_TYPES[edge.relationshipType as keyof typeof RELATIONSHIP_TYPES]
          : null
        
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: relationshipType?.label || edge.label,
          animated: false,
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
    [filteredNoteEdges]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)

  // Update nodes when data changes
  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

  // Update edges when database changes
  useEffect(() => {
    setEdges(initialEdges)
  }, [filteredNoteEdges, setEdges, initialEdges])

  // Handle edge selection
  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge.id)
  }, [])

  // Clear selection
  const handlePaneClick = useCallback(() => {
    setSelectedEdge(null)
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
        // Batch update all positions at once
        await Promise.all(
          saves.map(([id, position]) =>
            db.notes.update(id, { x: position.x, y: position.y })
          )
        )
        pendingSavesRef.current.clear()
      } catch (error) {
        console.error('Failed to save note positions:', error)
      }
    }, 500) // Save 500ms after user stops dragging
  }, [])

  // Optimistic UI update - update immediately, save later
  const handleNodeDragStop: NodeMouseHandler = useCallback(
    (_event, node) => {
      // Store position for batch save
      pendingSavesRef.current.set(node.id, {
        x: node.position.x,
        y: node.position.y,
      })
      
      // Trigger debounced save
      debouncedSavePositions()
    },
    [debouncedSavePositions]
  )
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Handle new connection
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      setPendingConnection(connection)
    },
    []
  )

  // Save connection with type
  const saveConnectionWithType = useCallback(
    async (relationshipType: string) => {
      if (!pendingConnection) return

      const edgeId = nanoid()
      const now = new Date().toISOString()

      try {
        const relType = RELATIONSHIP_TYPES[relationshipType as keyof typeof RELATIONSHIP_TYPES]
        
        await db.edges.add({
          id: edgeId,
          source: pendingConnection.source!,
          target: pendingConnection.target!,
          createdAt: now,
          relationshipType: relationshipType,
          label: relType?.label,
        })

        setPendingConnection(null)
      } catch (error) {
        console.error('Failed to save edge:', error)
      }
    },
    [pendingConnection]
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
        alert('AI found no strong semantic connections between these notes.')
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
        alert(`✨ Successfully created ${addedCount} connection${addedCount > 1 ? 's' : ''}!`)
      } else {
        alert('All suggested connections already exist.')
      }
    } catch (error) {
      console.error('Auto-link failed:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to auto-link notes: ${errorMsg}\n\nPlease try again.`)
    } finally {
      setIsAutoLinking(false)
    }
  }, [notes, isAutoLinking, generateText])

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-shrink-0 px-4 sm:px-6 lg:px-8 py-4 border-b border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl">
        <div className="flex justify-between items-center gap-3 max-w-[1920px] mx-auto">
          {/* Instructions */}
          <div className="text-sm text-gray-600 dark:text-gray-400 hidden lg:flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            <span className="font-medium">
              Hover over notes to connect •{' '}
              {selectedEdge ? (
                <strong className="text-red-500">Press DELETE to remove connection</strong>
              ) : (
                'Click a connection to select it'
              )}
            </span>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="btn btn-secondary text-sm"
                title="Filter by relationship type"
              >
                <Filter className="w-4 h-4" />
                <span>
                  {selectedRelationshipFilter === 'all'
                    ? 'All Types'
                    : RELATIONSHIP_TYPES[selectedRelationshipFilter as keyof typeof RELATIONSHIP_TYPES]?.label || 'All Types'}
                </span>
              </button>
              
              {showFilterDropdown && (
                <div className="absolute right-0 mt-2 w-72 modal z-50 p-2">
                  <button
                    onClick={() => {
                      setSelectedRelationshipFilter('all')
                      setShowFilterDropdown(false)
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all mb-1 ${
                      selectedRelationshipFilter === 'all'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="font-semibold">All Types</div>
                    <div className="text-xs text-gray-500 mt-1">Show all connections</div>
                  </button>
                  
                  {Object.values(RELATIONSHIP_TYPES).map((type) => (
                    <button
                      key={type.id}
                      onClick={() => {
                        setSelectedRelationshipFilter(type.id)
                        setShowFilterDropdown(false)
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all mb-1 ${
                        selectedRelationshipFilter === type.id
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: type.color }}
                        />
                        <span className="font-semibold">{type.label}</span>
                      </div>
                      <div className="text-xs text-gray-500 ml-6 mt-1">{type.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* AI Auto-Link Button - Special & Unique Design */}
            {status.available && notes.length >= 2 && (
              <button
                onClick={handleAutoLink}
                disabled={isAutoLinking}
                className="relative inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-display font-semibold text-sm bg-gradient-to-br from-accent-400 via-accent-500 to-accent-600 text-gray-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-glow-accent active:scale-95"
                style={{
                  boxShadow: '0 -1px 2px 0 rgba(255, 255, 255, 0.3) inset, 0 4px 12px -2px rgba(255, 215, 0, 0.4), 0 2px 6px -1px rgba(0, 0, 0, 0.1)',
                  willChange: 'transform, box-shadow',
                }}
              >
                <Sparkles className={`w-5 h-5 ${isAutoLinking ? 'animate-spin' : 'animate-pulse-slow'}`} />
                <span>{isAutoLinking ? 'Finding Connections...' : 'AI Auto-Link'}</span>
                {!isAutoLinking && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
                    style={{ backgroundSize: '200% 100%' }}
                  />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="w-full bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" style={{ height: 'calc(100vh - 140px)' }}>
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
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onConnect={handleConnect}
          onEdgesDelete={handleEdgeDelete}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          deleteKeyCode="Delete"
          selectNodesOnDrag={false}
          connectionMode={ConnectionMode.Loose}
          panOnScroll={true}
          panOnScrollSpeed={0.5}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={false}
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
          <Controls
            className="!shadow-lg !border-gray-200/60 dark:!border-gray-800/60 !rounded-xl"
            showInteractive={false}
          />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-white/95 dark:!bg-gray-900/95 !border-gray-200/60 dark:!border-gray-800/60 !shadow-lg !rounded-xl"
            nodeColor={() => '#e7e5e4'}
            maskColor="rgba(0, 0, 0, 0.05)"
          />
        </ReactFlow>
      </div>

      {/* Relationship Type Selection Modal */}
      {pendingConnection && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="modal max-w-md w-full p-6 animate-scale-in">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Select Relationship Type</h3>
              <button
                onClick={() => setPendingConnection(null)}
                className="btn-icon"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">
              Choose how these notes relate to each other:
            </p>
            
            <div className="space-y-2">
              {Object.values(RELATIONSHIP_TYPES).map((type) => (
                <button
                  key={type.id}
                  onClick={() => saveConnectionWithType(type.id)}
                  className="card-hover w-full text-left p-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: type.color }}
                    />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{type.label}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{type.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}