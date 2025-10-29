import { useCallback, useMemo } from 'react'
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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Trash2, Edit } from 'lucide-react'
import type { Note } from '@/types/note'
import { db } from '@/lib/db'

interface CanvasViewProps {
  notes: Note[]
  onEditNote: (note: Note) => void
  onDeleteNote: (id: string) => void
}

// Custom Note Node Component
function NoteNode({ data }: { data: any }) {
  return (
    <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 min-w-[200px] max-w-[300px]">
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

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState<Edge>([])

  // Update nodes when notes change
  useMemo(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

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

  return (
    <div className="w-full h-[600px] border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#94a3b8' },
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
  )
}