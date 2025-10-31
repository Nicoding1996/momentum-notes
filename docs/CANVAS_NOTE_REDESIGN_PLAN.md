# Canvas Note Redesign Plan

**Status:** 🎨 Design Phase  
**Priority:** High  
**Last Updated:** 2025-10-31

## Overview

This document outlines the comprehensive redesign of canvas notes to enhance editability, visual clarity, and user interaction while maintaining the minimalist aesthetic. The redesign focuses on **comfortable editing**, **clean interactions**, and **easy size management**.

---

## 🎯 Design Goals

1. **Comfortable Editing** - Make inline editing feel natural and responsive
2. **Visual Clarity** - Clear distinction between view and edit states
3. **Color Customization** - Allow users to organize notes visually with colors
4. **Easy Resizing** - Intuitive, accessible resize controls
5. **Progressive Enhancement** - Show formatting tools when notes get larger
6. **Minimalist Aesthetic** - Clean, uncluttered design that scales

---

## 🎨 Color System Design

### Predefined Color Palette (10 Colors)

Inspired by Notion's color system, each color will have:
- A light background for the note card
- A subtle border color
- An accent color for hover states

```typescript
export const NOTE_COLORS = {
  default: {
    id: 'default',
    name: 'Default',
    background: 'bg-white dark:bg-gray-900',
    border: 'border-gray-200/80 dark:border-gray-700/80',
    hover: 'hover:border-gray-300 dark:hover:border-gray-600',
    lightBg: '#ffffff',
    darkBg: '#18181b'
  },
  gray: {
    id: 'gray',
    name: 'Gray',
    background: 'bg-gray-50 dark:bg-gray-800',
    border: 'border-gray-300 dark:border-gray-600',
    hover: 'hover:border-gray-400 dark:hover:border-gray-500',
    lightBg: '#f9fafb',
    darkBg: '#1f2937'
  },
  brown: {
    id: 'brown',
    name: 'Brown',
    background: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    hover: 'hover:border-amber-300 dark:hover:border-amber-700',
    lightBg: '#fffbeb',
    darkBg: '#451a03'
  },
  orange: {
    id: 'orange',
    name: 'Orange',
    background: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    hover: 'hover:border-orange-300 dark:hover:border-orange-700',
    lightBg: '#fff7ed',
    darkBg: '#431407'
  },
  yellow: {
    id: 'yellow',
    name: 'Yellow',
    background: 'bg-yellow-50 dark:bg-yellow-950/30',
    border: 'border-yellow-200 dark:border-yellow-800',
    hover: 'hover:border-yellow-300 dark:hover:border-yellow-700',
    lightBg: '#fefce8',
    darkBg: '#422006'
  },
  green: {
    id: 'green',
    name: 'Green',
    background: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    hover: 'hover:border-emerald-300 dark:hover:border-emerald-700',
    lightBg: '#ecfdf5',
    darkBg: '#022c22'
  },
  blue: {
    id: 'blue',
    name: 'Blue',
    background: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    hover: 'hover:border-blue-300 dark:hover:border-blue-700',
    lightBg: '#eff6ff',
    darkBg: '#172554'
  },
  purple: {
    id: 'purple',
    name: 'Purple',
    background: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    hover: 'hover:border-purple-300 dark:hover:border-purple-700',
    lightBg: '#faf5ff',
    darkBg: '#2e1065'
  },
  pink: {
    id: 'pink',
    name: 'Pink',
    background: 'bg-pink-50 dark:bg-pink-950/30',
    border: 'border-pink-200 dark:border-pink-800',
    hover: 'hover:border-pink-300 dark:hover:border-pink-700',
    lightBg: '#fdf2f8',
    darkBg: '#500724'
  },
  red: {
    id: 'red',
    name: 'Red',
    background: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    hover: 'hover:border-red-300 dark:hover:border-red-700',
    lightBg: '#fef2f2',
    darkBg: '#450a0a'
  }
} as const;

export type NoteColorId = keyof typeof NOTE_COLORS;
```

### Color Picker UI

**Location:** Header toolbar (appears next to Edit/Delete buttons on hover)

**Design:**
```
┌─────────────────────────────────────┐
│  [Title]              🎨 ✏️ 🗑️     │
│                                     │
│  Color Picker Dropdown:             │
│  ┌─────────────────────────────┐   │
│  │ ⚪ ⚫ 🟤 🟠 🟡 🟢 🔵 🟣 🩷 🔴 │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Interaction:**
- Click color palette icon to open picker
- Click any color to apply immediately
- Picker closes after selection
- Smooth color transition animation (200ms)

---

## ✏️ Formatting Toolbar Design

### When to Show Toolbar

**Criteria for displaying toolbar:**
1. Note is in edit mode (either title or content)
2. Note width > 350px AND height > 300px (medium size+)

**Toolbar appears:** Floating at top of content area, below title

### Toolbar Composition

```
┌──────────────────────────────────────────┐
│  [B] [I] [U] [S] │ [H1] [H2] [H3] │ [•] [1.] │ [✓]  │
└──────────────────────────────────────────┘
   Text Style        Headings       Lists    Done
```

**Features:**
- **B** - Bold (Cmd/Ctrl + B)
- **I** - Italic (Cmd/Ctrl + I)
- **U** - Underline (Cmd/Ctrl + U)
- **S** - Strikethrough
- **H1/H2/H3** - Heading levels
- **•** - Bullet list
- **1.** - Numbered list
- **✓** - Exit edit mode

**Styling:**
```css
.formatting-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(10px);
  animation: slideDown 200ms ease-out;
}

.toolbar-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 150ms;
  cursor: pointer;
}

.toolbar-button:hover {
  background: rgba(0, 0, 0, 0.05);
}

.toolbar-button.active {
  background: rgb(59, 130, 246);
  color: white;
}
```

### Implementation with TipTap Extensions

The toolbar will integrate with the existing TipTap editor by:
1. Creating a new `CanvasFormattingMenu` component
2. Using TipTap's chain commands for formatting
3. Showing active states based on current selection

```typescript
// Example: Bold button
<button
  onClick={() => editor.chain().focus().toggleBold().run()}
  className={`toolbar-button ${editor.isActive('bold') ? 'active' : ''}`}
>
  <Bold className="w-4 h-4" />
</button>
```

---

## 📐 Resize Handle Redesign

### Current Issues
- Handles are too small (12px)
- Only visible on hover
- Difficult to grab accurately
- Not accessible on touch devices

### New Design

**Corner Handles (Always Visible):**
```css
.resize-handle-corner {
  width: 20px;
  height: 20px;
  background: white;
  border: 2px solid #fbbf24; /* accent color */
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: nwse-resize;
  position: absolute;
  z-index: 10;
  
  /* Always visible */
  opacity: 1;
  
  /* Smooth transitions */
  transition: transform 150ms, box-shadow 150ms;
}

.resize-handle-corner:hover {
  transform: scale(1.2);
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
  border-width: 3px;
}

.resize-handle-corner:active {
  transform: scale(1.1);
}
```

**Edge Handles (Hover Only):**
- Appear on hover for fine-tuning
- 8px wide, full edge length
- Subtle visual indicator

**Visual Design:**
```
┌─────────────────────────────┐
│ ◉                         ◉ │  ← Corner handles (20px, always visible)
│                             │
│                             │
│                             │
│ ◉                         ◉ │
└─────────────────────────────┘
```

**Touch Accessibility:**
- Minimum 44px touch target (invisible padding)
- Haptic feedback on touch devices
- Visual feedback during resize

---

## 🎭 Visual States Design

### State Transitions

**1. Default (View Mode)**
```css
.note-card-view {
  background: var(--note-color-bg);
  border: 1px solid var(--note-color-border);
  box-shadow: 
    0 -1px 1px 0 rgba(255, 255, 255, 0.1) inset,
    0 4px 8px -2px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 200ms ease-out;
}

.note-card-view:hover {
  transform: translate3d(0, -2px, 0);
  border-color: var(--note-color-hover);
  box-shadow: 
    0 -1px 2px 0 rgba(255, 255, 255, 0.15) inset,
    0 8px 16px -4px rgba(0, 0, 0, 0.12);
}
```

**2. Editing Mode (Title or Content)**
```css
.note-card-editing {
  background: var(--note-color-bg);
  border: 2px solid #fbbf24; /* accent border */
  box-shadow: 
    0 0 0 3px rgba(251, 191, 36, 0.1),
    0 -1px 2px 0 rgba(255, 255, 255, 0.15) inset,
    0 8px 20px -4px rgba(0, 0, 0, 0.15);
  cursor: text;
}
```

**3. Selected (for multi-select/operations)**
```css
.note-card-selected {
  border: 2px solid #3b82f6; /* blue border */
  box-shadow: 
    0 0 0 3px rgba(59, 130, 246, 0.1),
    0 8px 20px -4px rgba(59, 130, 246, 0.3);
}
```

**4. Dragging**
```css
.note-card-dragging {
  opacity: 0.8;
  transform: rotate(2deg) scale(1.02);
  box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.25);
  cursor: grabbing;
}
```

### Subtle Indicators

**Edit Mode Indicator:**
- Blinking cursor in active field
- Soft accent glow around border
- Toolbar slides down smoothly

**Hover Affordances:**
- Title: Subtle background tint on hover
- Content: Subtle background tint on hover
- Buttons: Slide in from opacity 0 → 1

---

## 💾 Database Schema Changes

### Updated Note Interface

```typescript
export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  tags?: string[];
  
  // NEW FIELD
  color?: NoteColorId; // defaults to 'default'
}
```

### Migration Strategy

```typescript
// Add color field to existing notes
async function migrateNotesForColors() {
  const allNotes = await db.notes.toArray();
  
  await Promise.all(
    allNotes.map(note => 
      db.notes.update(note.id, { color: 'default' })
    )
  );
}
```

---

## 🎮 Interaction Patterns

### Editing Flow

```
User Interaction Flow:
1. User hovers over note → Action buttons fade in
2. User clicks title/content → Enter edit mode
   - Border changes to accent color
   - Show resize handles (corners)
   - If note is large enough → Show formatting toolbar
3. User types/formats content
4. User clicks outside OR presses Escape → Exit edit mode
   - Border returns to normal
   - Toolbar slides up and fades out
   - Auto-save triggers
```

### Color Change Flow

```
User clicks color palette icon
  ↓
Color picker dropdown appears
  ↓
User selects color
  ↓
Note background smoothly transitions (200ms)
  ↓
Picker closes
  ↓
Change saved to database
```

### Resize Flow

```
User hovers near corner
  ↓
Corner handle scales up slightly (1.2x)
  ↓
User drags handle
  ↓
Note resizes with live preview
  ↓
If size crosses threshold → Show/hide toolbar
  ↓
User releases → Save new dimensions
```

---

## ♿ Accessibility Considerations

### Keyboard Navigation

**Note Focus:**
- `Tab` - Navigate between notes
- `Enter` - Enter edit mode on focused note
- `Escape` - Exit edit mode
- `Cmd/Ctrl + B/I/U` - Text formatting shortcuts

**Color Picker:**
- `Space/Enter` - Open picker
- `Arrow keys` - Navigate colors
- `Enter` - Select color
- `Escape` - Close without changing

### Screen Readers

**Announce States:**
- "Note card, [Title], [Color name]"
- "Editing title" / "Editing content"
- "Color picker, [Color name], button"
- "Resize handle, bottom right corner"

### Touch Accessibility

- Minimum 44x44px touch targets
- Visual feedback on touch
- Prevent accidental activations with delays
- Gesture support (pinch to resize on mobile)

### Color Contrast

All color combinations must meet WCAG AA standards:
- Text on colored backgrounds: 4.5:1 minimum
- Border colors: Sufficient contrast with background
- Preserve readability in dark mode

---

## 🏗️ Component Architecture

### New Components

**1. `NoteColorPicker.tsx`**
```typescript
interface NoteColorPickerProps {
  currentColor: NoteColorId;
  onChange: (color: NoteColorId) => void;
  onClose: () => void;
}
```

**2. `CanvasFormattingToolbar.tsx`**
```typescript
interface CanvasFormattingToolbarProps {
  editor: Editor; // TipTap editor instance
  onDone: () => void;
}
```

**3. `EnhancedResizeHandles.tsx`**
```typescript
interface EnhancedResizeHandlesProps {
  isEditing: boolean;
  onResize: (width: number, height: number) => void;
}
```

### Updated Components

**`NoteNode` (in CanvasView.tsx)**
- Add color state and picker integration
- Conditional toolbar rendering
- Enhanced resize handle component
- Improved state management

---

## 📋 Implementation Roadmap

### Phase 1: Color System (Week 1)
- [ ] Add `color` field to Note type
- [ ] Create NOTE_COLORS constant
- [ ] Build NoteColorPicker component
- [ ] Integrate color picker into NoteNode
- [ ] Update database migration
- [ ] Add color to note card styling
- [ ] Test color persistence

### Phase 2: Enhanced Resize Handles (Week 1)
- [ ] Design new handle component
- [ ] Implement always-visible corner handles
- [ ] Add hover states and animations
- [ ] Improve touch target sizes
- [ ] Test on touch devices
- [ ] Add accessibility attributes

### Phase 3: Formatting Toolbar (Week 2)
- [ ] Create CanvasFormattingToolbar component
- [ ] Integrate with TipTap editor
- [ ] Implement conditional rendering logic
- [ ] Add keyboard shortcuts
- [ ] Style toolbar to match design system
- [ ] Add animations (slide in/out)
- [ ] Test formatting operations

### Phase 4: Visual States (Week 2)
- [ ] Define CSS for all states
- [ ] Implement smooth transitions
- [ ] Add edit mode indicators
- [ ] Test state transitions
- [ ] Ensure animations are smooth (60fps)

### Phase 5: Polish & Testing (Week 3)
- [ ] Accessibility audit
- [ ] Keyboard navigation testing
- [ ] Touch device testing
- [ ] Performance optimization
- [ ] Cross-browser testing
- [ ] Documentation updates
- [ ] User testing feedback

---

## 📊 Success Metrics

**User Experience:**
- ✅ Can change note color in < 2 clicks
- ✅ Resize handles are easily discoverable
- ✅ Formatting toolbar appears when needed
- ✅ No performance degradation with 50+ notes
- ✅ All interactions feel smooth (60fps)

**Accessibility:**
- ✅ WCAG AA compliant color contrast
- ✅ Full keyboard navigation support
- ✅ Screen reader announcements work correctly
- ✅ Touch targets meet 44px minimum

**Technical:**
- ✅ No memory leaks
- ✅ Smooth animations without jank
- ✅ Database operations complete in < 100ms
- ✅ Works on Chrome, Firefox, Safari, Edge

---

## 🎨 Design System Integration

All new components will use existing design tokens:

```css
/* Colors */
--color-accent: #fbbf24 (yellow)
--color-primary: #242424 (charcoal)

/* Shadows (Light from Sky principle) */
--shadow-sm: 0 -1px 1px 0 rgba(255, 255, 255, 0.1) inset, ...
--shadow-md: 0 -1px 2px 0 rgba(255, 255, 255, 0.15) inset, ...

/* Animations */
--transition-fast: 150ms
--transition-normal: 200ms
--easing: cubic-bezier(0.16, 1, 0.3, 1)

/* Typography */
--font-display: 'Montserrat' (for titles)
--font-body: 'Karla' (for content)
```

---

## 🔄 Future Enhancements (Post-MVP)

1. **Note Templates** - Predefined note layouts with colors
2. **Bulk Color Change** - Select multiple notes and change color
3. **Color Themes** - Save custom color palettes
4. **Markdown Preview** - Toggle between edit/preview in larger notes
5. **Note Linking from Toolbar** - Quick wikilink insertion button
6. **Custom Fonts** - Per-note font selection for larger notes
7. **Note Icons** - Optional emoji/icon in note header
8. **Collaborative Cursors** - Show who's editing what (multiplayer)

---

## 📚 References

- **Design Inspiration:** Notion, Apple Notes, Miro
- **Color System:** Material Design 3, Notion's color palette
- **Accessibility:** WCAG 2.1 Guidelines
- **Typography:** Current "Light from Sky" design system
- **Animations:** Native feel, 60fps target

---

**Next Steps:** Review this plan, then proceed to implementation starting with Phase 1 (Color System).