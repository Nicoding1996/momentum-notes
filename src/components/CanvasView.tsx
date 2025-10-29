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
  addEdge,
  Handle,
  Position,
  ConnectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Trash2, Edit, Sparkles } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Note } from '@/types/note'
import type { NoteEdge } from '@/types/edge'
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

  // Fetch edges from database
  const noteEdges: NoteEdge[] = useLiveQuery(() => db.edges.toArray(), []) ?? []

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

  // Convert database edges to React Flow edges
  const initialEdges: Edge[] = useMemo(
    () =>
      noteEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        animated: false, // Static for minimalist design
        style: {
          stroke: '#94a3b8',
          strokeWidth: 1.5,
        },
        type: 'smoothstep',
      })),
    [noteEdges]
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
  }, [noteEdges, setEdges, initialEdges])

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

  // Handle new connection created by user
  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return

      const edgeId = nanoid()
      const now = new Date().toISOString()

      try {
        // Save to database
        await db.edges.add({
          id: edgeId,
          source: connection.source,
          target: connection.target,
          createdAt: now,
        })

        // Update UI
        setEdges((eds) =>
          addEdge(
            {
              ...connection,
              id: edgeId,
              animated: false,
              style: { stroke: '#94a3b8', strokeWidth: 1.5 },
              type: 'smoothstep',
            },
            eds
          )
        )
      } catch (error) {
        console.error('Failed to save edge:', error)
      }
    },
    [setEdges]
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
      // Get all notes content - use actual IDs, not indices
      const notesContext = notes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content.slice(0, 300),
      }))

      // Use AI to find semantic relationships
      const prompt = `Analyze these notes and identify semantic relationships between them.

Notes:
${notesContext.map((n) => `Note ID: "${n.id}"\nTitle: "${n.title}"\nContent: ${n.content}`).join('\n\n---\n\n')}

IMPORTANT: In your response, use the EXACT Note ID values shown above (the strings in quotes after "Note ID:").

Return a JSON array of connections. Each connection must have:
- source: EXACT Note ID string from above (e.g., "${notes[0]?.id}")
- target: EXACT Note ID string from above (e.g., "${notes[1]?.id}")
- reason: very brief reason (max 5 words)

Only suggest 2-3 strong, clear semantic connections. Be selective.

Example with REAL IDs:
[{"source":"${notes[0]?.id}","target":"${notes[1]?.id}","reason":"Related topics"}]

Return ONLY the JSON array, no other text:`

      const result = await generateText(
        prompt,
        'You are a helpful assistant that analyzes notes and finds semantic relationships. You MUST use the exact Note ID strings provided. Always return valid JSON arrays.'
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
          await db.edges.add({
            id: edgeId,
            source: conn.source,
            target: conn.target,
            createdAt: now,
            label: conn.reason || undefined,
          })
          addedCount++
          console.log('Created connection:', conn.source, '->', conn.target)
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
      <div className="flex justify-between items-center">
        {/* Instructions */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p>💡 Hover over notes to see connection points • {selectedEdge ? <strong className="text-red-500">Press DELETE to remove selected line</strong> : 'Click a line to select it'}</p>
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
    </div>
  )
}