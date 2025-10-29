import { useCallback, useMemo, useState, useEffect } from 'react'
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
import { Trash2, Edit, Sparkles, Filter, X } from 'lucide-react'
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

// Custom Note Node Component with connection handles
function NoteNode({ data }: { data: any }) {
  return (
    <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 min-w-[200px] max-w-[300px] relative group">
      {/* Connection handles - only visible on hover, more subtle with unique IDs */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="w-3 h-3 !bg-blue-400 dark:!bg-blue-500 opacity-0 group-hover:opacity-80 transition-opacity !border-2 !border-white dark:!border-gray-800"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-3 h-3 !bg-blue-400 dark:!bg-blue-500 opacity-0 group-hover:opacity-80 transition-opacity !border-2 !border-white dark:!border-gray-800"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="w-3 h-3 !bg-blue-400 dark:!bg-blue-500 opacity-0 group-hover:opacity-80 transition-opacity !border-2 !border-white dark:!border-gray-800"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 !bg-blue-400 dark:!bg-blue-500 opacity-0 group-hover:opacity-80 transition-opacity !border-2 !border-white dark:!border-gray-800"
      />
      
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-sm line-clamp-2">{data.title || 'Untitled'}</h4>
        <div className="flex gap-1 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              data.onEdit()
            }}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Edit note"
          >
            <Edit className="w-3 h-3 text-gray-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              data.onDelete()
            }}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Delete note"
          >
            <Trash2 className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      </div>
      {data.tags && data.tags.length > 0 && (
        <div className="mb-2">
          <TagDisplay tagIds={data.tags} maxDisplay={2} />
        </div>
      )}
      {data.content && (
        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 mt-2">
          {data.content}
        </p>
      )}
      <p className="text-xs text-gray-400 mt-2">
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
          x: note.x ?? (index % 4) * 320 + 50,
          y: note.y ?? Math.floor(index / 4) * 220 + 50,
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

  // Convert database edges to React Flow edges with relationship type styling
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
            stroke: relationshipType?.color || '#94a3b8',
            strokeWidth: 1.5,
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

  // Update edges when database changes - CRITICAL for AI auto-link
  useEffect(() => {
    setEdges(initialEdges)
  }, [filteredNoteEdges, setEdges, initialEdges])

  // Handle edge selection
  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge.id)
  }, [])

  // Clear selection when clicking canvas
  const handlePaneClick = useCallback(() => {
    setSelectedEdge(null)
  }, [])

  // Save node position to database
  const handleNodeDragStop: NodeMouseHandler = useCallback(
    async (_event, node) => {
      try {
        await db.notes.update(node.id, {
          x: node.position.x,
          y: node.position.y,
        })
      } catch (error) {
        console.error('Failed to save note position:', error)
      }
    },
    []
  )

  // Handle new connection created by user - show relationship type modal
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      setPendingConnection(connection)
    },
    []
  )

  // Save connection with selected relationship type
  const saveConnectionWithType = useCallback(
    async (relationshipType: string) => {
      if (!pendingConnection) return

      const edgeId = nanoid()
      const now = new Date().toISOString()

      try {
        const relType = RELATIONSHIP_TYPES[relationshipType as keyof typeof RELATIONSHIP_TYPES]
        
        // Save to database
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

  // Delete an edge
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
      // Get all notes content with tags - use actual IDs, not indices
      const allTags = await db.tags.toArray()
      const tagMap = new Map(allTags.map(tag => [tag.id, tag.name]))
      
      const notesContext = notes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content.slice(0, 300),
        tags: n.tags?.map(tagId => tagMap.get(tagId)).filter(Boolean) || [],
      }))

      // Use AI to find semantic relationships with relationship types, considering tags
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

      // Try to extract JSON from response
      let connections = []
      try {
        // First try direct parse
        connections = JSON.parse(result.trim())
      } catch {
        // Try to find JSON array in the response
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

      // Validate and create edges for new connections
      const validNoteIds = new Set(notes.map(n => n.id))
      
      for (const conn of connections) {
        if (!conn.source || !conn.target) {
          console.warn('Skipping connection with missing source or target:', conn)
          continue
        }

        // Validate that both IDs exist in our notes
        if (!validNoteIds.has(conn.source) || !validNoteIds.has(conn.target)) {
          console.warn('Skipping connection with invalid IDs:', conn, 'Valid IDs:', Array.from(validNoteIds))
          continue
        }

        // Check if edge already exists (in either direction)
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
        alert(`Successfully created ${addedCount} connection${addedCount > 1 ? 's' : ''}!`)
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
    <div className="space-y-2">
      <div className="flex justify-between items-center gap-2">
        {/* Instructions */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p>💡 Hover over notes to see connection points • {selectedEdge ? <strong className="text-red-500">Press DELETE to remove selected line</strong> : 'Click a line to select it'}</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              title="Filter by relationship type"
            >
              <Filter className="w-4 h-4" />
              <span className="text-sm">
                {selectedRelationshipFilter === 'all'
                  ? 'All Types'
                  : RELATIONSHIP_TYPES[selectedRelationshipFilter as keyof typeof RELATIONSHIP_TYPES]?.label || 'All Types'}
              </span>
            </button>
            
            {showFilterDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                <div className="p-2">
                  <button
                    onClick={() => {
                      setSelectedRelationshipFilter('all')
                      setShowFilterDropdown(false)
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                      selectedRelationshipFilter === 'all'
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="font-medium">All Types</div>
                    <div className="text-xs text-gray-500">Show all connections</div>
                  </button>
                  
                  {Object.values(RELATIONSHIP_TYPES).map((type) => (
                    <button
                      key={type.id}
                      onClick={() => {
                        setSelectedRelationshipFilter(type.id)
                        setShowFilterDropdown(false)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                        selectedRelationshipFilter === type.id
                          ? 'bg-blue-100 dark:bg-blue-900'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: type.color }}
                        />
                        <span className="font-medium">{type.label}</span>
                      </div>
                      <div className="text-xs text-gray-500 ml-5">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* AI Auto-Link Button */}
          {status.available && notes.length >= 2 && (
            <button
              onClick={handleAutoLink}
              disabled={isAutoLinking}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Sparkles className={`w-4 h-4 ${isAutoLinking ? 'animate-spin' : ''}`} />
              {isAutoLinking ? 'Finding Connections...' : 'AI Auto-Link Notes'}
            </button>
          )}
        </div>
      </div>
      
      <div className="w-full h-[600px] border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges.map(edge => ({
            ...edge,
            selected: edge.id === selectedEdge,
            animated: edge.id === selectedEdge, // Subtle animation only on selection
            style: {
              ...edge.style,
              stroke: edge.id === selectedEdge ? '#ef4444' : '#94a3b8',
              strokeWidth: edge.id === selectedEdge ? 2.5 : 1.5,
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
          defaultEdgeOptions={{
            animated: false,
            type: 'smoothstep',
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
          />
        </ReactFlow>
      </div>

      {/* Relationship Type Selection Modal */}
      {pendingConnection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Select Relationship Type</h3>
              <button
                onClick={() => setPendingConnection(null)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Choose how these notes relate to each other:
            </p>
            
            <div className="space-y-2">
              {Object.values(RELATIONSHIP_TYPES).map((type) => (
                <button
                  key={type.id}
                  onClick={() => saveConnectionWithType(type.id)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: type.color }}
                    />
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-sm text-gray-500">{type.description}</div>
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