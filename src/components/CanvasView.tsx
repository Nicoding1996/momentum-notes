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

interface CanvasViewProps {
  notes: Note[]
  onEditNote: (note: Note) => void
  onDeleteNote: (id: string) => void
}

// Custom Note Node Component with connection handles
function NoteNode({ data }: { data: any }) {
  return (
    <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 min-w-[200px] max-w-[300px] relative group">
      {/* Connection handles - only visible on hover, more subtle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 !bg-gray-400 dark:!bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity !border-2 !border-white dark:!border-gray-800"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 !bg-gray-400 dark:!bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity !border-2 !border-white dark:!border-gray-800"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2 !bg-gray-400 dark:!bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity !border-2 !border-white dark:!border-gray-800"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 !bg-gray-400 dark:!bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity !border-2 !border-white dark:!border-gray-800"
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
        animated: true,
        style: { stroke: '#94a3b8' },
      })),
    [noteEdges]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges)

  // Update nodes and edges when data changes
  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

  useEffect(() => {
    setEdges(initialEdges)
  }, [initialEdges, setEdges])

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
              animated: true,
              style: { stroke: '#94a3b8' },
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
      // Get all notes content
      const notesContext = notes.map((n, idx) => ({
        index: idx,
        id: n.id,
        title: n.title,
        content: n.content.slice(0, 300),
      }))

      // Use AI to find semantic relationships
      const prompt = `Analyze these notes and identify semantic relationships between them.

Notes:
${notesContext.map((n) => `[${n.index}] ID: ${n.id}\nTitle: ${n.title}\nContent: ${n.content}`).join('\n\n')}

Return a JSON array of connections. Each connection should have:
- source: the ID of the first note
- target: the ID of the second note
- reason: a very brief reason (max 5 words)

Only suggest strong, clear semantic connections. Be selective.

Example format:
[{"source":"abc123","target":"def456","reason":"Both about coding"}]

Return ONLY the JSON array, nothing else:`

      const result = await generateText(
        prompt,
        'You are a helpful assistant that analyzes notes and finds semantic relationships. You always return valid JSON arrays.'
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

      // Create edges for new connections
      for (const conn of connections) {
        if (!conn.source || !conn.target) continue

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
      {/* AI Auto-Link Button */}
      {status.available && notes.length >= 2 && (
        <div className="flex justify-end">
          <button
            onClick={handleAutoLink}
            disabled={isAutoLinking}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Sparkles className={`w-4 h-4 ${isAutoLinking ? 'animate-spin' : ''}`} />
            {isAutoLinking ? 'Finding Connections...' : 'AI Auto-Link Notes'}
          </button>
        </div>
      )}
      <div className="w-full h-[600px] border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onConnect={handleConnect}
          onEdgesDelete={handleEdgeDelete}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          deleteKeyCode="Delete"
          selectNodesOnDrag={false}
          connectionMode={ConnectionMode.Loose}
          snapToGrid={true}
          snapGrid={[15, 15]}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: '#94a3b8', strokeWidth: 2 },
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