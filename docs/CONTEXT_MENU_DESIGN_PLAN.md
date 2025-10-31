# Custom Context Menu Design & Implementation Summary

## Problem Statement

Users experienced a frustrating workflow when trying to use AI tools on selected text, as the selection was lost when clicking the "AI Tools" dropdown button.

## Solution: Custom Right-Click Context Menu

A native-feeling context menu was implemented that appears on right-click over selected text, preserving the selection and providing instant access to AI actions.

---

## Design Philosophy

### Visual Design
- **Match Momentum Aesthetic**: Used the existing design system (Montserrat + Karla fonts, charcoal/solar yellow palette).
- **Light from the Sky**: Applied subtle top lighting and depth shadows.
- **Glass Morphism**: Semi-transparent backdrop with blur effects.
- **Smooth Animations**: Fade-in with scale and spring animations.

### Interaction Design
- **Context-Aware**: Only shows when text is selected.
- **Smart Positioning**: Appears near mouse cursor, adjusts to stay in viewport.
- **Keyboard Accessible**: Supports Escape to close.
- **Visual Feedback**: Hover states, loading indicators, success animations.

---

## Component Architecture

### 1. TextContextMenu Component

**Location**: `src/components/ui/TextContextMenu.tsx`

**Props Interface**:
```typescript
interface TextContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  onExpand: () => Promise<void>;
  onSummarize: () => Promise<void>;
  onImprove: () => Promise<void>;
  isLoading?: boolean;
}
```

### 2. Hook: useTextSelection

**Location**: `src/hooks/useTextSelection.ts`

**Purpose**: Manages text selection state and context menu visibility.

```typescript
interface UseTextSelectionReturn {
  selectedText: string;
  selectionRange: { start: number, end: number } | null;
  isTextSelected: boolean;
  contextMenuState: {
    isOpen: boolean;
    x: number;
    y: number;
  };
  handleContextMenu: (e: MouseEvent) => void;
  closeContextMenu: () => void;
  replaceSelection: (newText: string) => void;
}
```

---

## Implementation Summary

### Phase 1: Core Context Menu Component
- Renders at specific x, y coordinates.
- Uses a portal for rendering.
- Closes on click-outside or Escape key.
- Styled with the Momentum theme.

### Phase 2: Smart Positioning Logic
- Calculates menu position relative to the mouse.
- Adjusts to prevent overflowing viewport edges.
- Adds an offset from the cursor for better UX.

### Phase 3: Text Selection Preservation
- Prevents the default browser menu on right-click.
- Stores the text selection before showing the menu.
- Restores focus to the textarea to keep the selection.

### Phase 4: Custom Cursor Styling
- A custom `context-menu` cursor is shown when hovering over selected text.

### Phase 5: Integration with NoteEditor
- The `useTextSelection` hook was added to `NoteEditor.tsx`.
- The `onContextMenu` handler was added to the textarea.
- The `TextContextMenu` component is rendered when the context menu is open.

---

## Styling Specifications

The context menu was styled with a "Momentum Glass Effect," "Light from the Sky" shadows, and smooth animations. Menu items have hover and active states, and there is full support for dark mode.

---

## User Experience Flow

### Scenario 1: Right-Click on Selected Text
The user selects text, right-clicks, and the context menu appears. The user can then select an AI action, which replaces the selected text with the AI-generated result.

### Scenario 2: Click Outside to Dismiss
If the user clicks outside the context menu, it closes, and the text selection remains intact.

### Scenario 3: Keyboard Shortcut
Pressing the Escape key closes the context menu, and the text selection remains intact.

---

## Accessibility Considerations

- **Keyboard Navigation**: The context menu can be navigated with arrow keys.
- **Screen Readers**: ARIA roles and labels were used to ensure the context menu is accessible.
- **Focus Management**: Focus is properly managed when the context menu is opened and closed.