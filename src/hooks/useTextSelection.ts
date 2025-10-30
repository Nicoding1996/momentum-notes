import { useState, useCallback, RefObject } from 'react'

interface SelectionRange {
  start: number
  end: number
}

interface ContextMenuState {
  isOpen: boolean
  x: number
  y: number
}

interface UseTextSelectionOptions {
  elementRef: RefObject<HTMLTextAreaElement>
  onSelectionChange?: (text: string) => void
}

interface UseTextSelectionReturn {
  selectedText: string
  selectionRange: SelectionRange | null
  isTextSelected: boolean
  contextMenuState: ContextMenuState
  handleContextMenu: (e: React.MouseEvent<HTMLTextAreaElement>) => void
  closeContextMenu: () => void
  replaceSelection: (newText: string, updateContent: (newValue: string) => void) => void
}

export function useTextSelection({
  elementRef,
  onSelectionChange
}: UseTextSelectionOptions): UseTextSelectionReturn {
  const [selectedText, setSelectedText] = useState('')
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null)
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0
  })

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    e.preventDefault() // Prevent default browser context menu

    const textarea = elementRef.current
    if (!textarea) return

    // Get current selection
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value.substring(start, end).trim()

    // Only show menu if text is actually selected
    if (text.length === 0) {
      setContextMenuState({ isOpen: false, x: 0, y: 0 })
      return
    }

    // Store selection state
    setSelectedText(text)
    setSelectionRange({ start, end })

    // Calculate menu position
    const x = e.clientX
    const y = e.clientY

    // Open context menu
    setContextMenuState({ isOpen: true, x, y })

    // Restore focus to textarea to keep selection
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start, end)
    }, 0)

    // Call optional callback
    if (onSelectionChange) {
      onSelectionChange(text)
    }
  }, [elementRef, onSelectionChange])

  const closeContextMenu = useCallback(() => {
    setContextMenuState({ isOpen: false, x: 0, y: 0 })
  }, [])

  const replaceSelection = useCallback((newText: string, updateContent: (newValue: string) => void) => {
    const textarea = elementRef.current
    if (!textarea || !selectionRange) return

    const { start, end } = selectionRange
    const currentValue = textarea.value
    
    // Replace the selected text with new text
    const newValue = currentValue.substring(0, start) + newText + currentValue.substring(end)
    
    // Update React state directly
    updateContent(newValue)
    
    // Set cursor position at the end of replaced text after state update
    setTimeout(() => {
      const newCursorPos = start + newText.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
      textarea.focus()
    }, 0)
    
    // Clear selection state
    setSelectedText('')
    setSelectionRange(null)
  }, [elementRef, selectionRange])

  return {
    selectedText,
    selectionRange,
    isTextSelected: selectedText.length > 0,
    contextMenuState,
    handleContextMenu,
    closeContextMenu,
    replaceSelection
  }
}