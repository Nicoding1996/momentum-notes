import { useState, useCallback, useRef } from 'react'
import { Node, Edge } from '@xyflow/react'

interface HistoryState {
  nodes: Node[]
  edges: Edge[]
}

interface CanvasHistoryReturn {
  canUndo: boolean
  canRedo: boolean
  undo: () => HistoryState | null
  redo: () => HistoryState | null
  pushHistory: (nodes: Node[], edges: Edge[]) => void
  clearHistory: () => void
}

const MAX_HISTORY_SIZE = 50

export function useCanvasHistory(): CanvasHistoryReturn {
  const [historyStack, setHistoryStack] = useState<HistoryState[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const isUndoRedoAction = useRef(false)

  const canUndo = currentIndex > 0
  const canRedo = currentIndex < historyStack.length - 1

  const pushHistory = useCallback((nodes: Node[], edges: Edge[]) => {
    // Don't push if this is an undo/redo action
    if (isUndoRedoAction.current) {
      return
    }

    setHistoryStack((prev) => {
      // Remove any states after current index (they're invalidated by new action)
      const newStack = prev.slice(0, currentIndex + 1)
      
      // Add new state
      newStack.push({
        nodes: JSON.parse(JSON.stringify(nodes)), // Deep clone
        edges: JSON.parse(JSON.stringify(edges))
      })
      
      // Limit stack size
      if (newStack.length > MAX_HISTORY_SIZE) {
        newStack.shift()
        setCurrentIndex((prev) => prev) // Index stays the same since we removed from front
        return newStack
      }
      
      setCurrentIndex(newStack.length - 1)
      return newStack
    })
  }, [currentIndex])

  const undo = useCallback((): HistoryState | null => {
    if (!canUndo) return null

    isUndoRedoAction.current = true
    const newIndex = currentIndex - 1
    setCurrentIndex(newIndex)
    
    // Reset flag after a tick
    setTimeout(() => {
      isUndoRedoAction.current = false
    }, 0)
    
    return historyStack[newIndex]
  }, [canUndo, currentIndex, historyStack])

  const redo = useCallback((): HistoryState | null => {
    if (!canRedo) return null

    isUndoRedoAction.current = true
    const newIndex = currentIndex + 1
    setCurrentIndex(newIndex)
    
    // Reset flag after a tick
    setTimeout(() => {
      isUndoRedoAction.current = false
    }, 0)
    
    return historyStack[newIndex]
  }, [canRedo, currentIndex, historyStack])

  const clearHistory = useCallback(() => {
    setHistoryStack([])
    setCurrentIndex(-1)
  }, [])

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    pushHistory,
    clearHistory
  }
}