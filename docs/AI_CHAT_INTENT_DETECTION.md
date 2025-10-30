# AI Chat Intent Detection & Undo Feature

## Overview
This document describes the advanced intent detection system and undo functionality implemented in the AI Chat to make it context-aware and safer to use.

## Problem Solved

### Original Issue
When users asked questions like "what else can I add?" or "give me notes on hydration", the system would show a "Replace Content" button, which was confusing since the user wanted to *add* content, not replace it.

### Solution
Implemented AI-powered intent detection that analyzes the user's request contextually and determines whether they want to:
- **REPLACE**: Modify/rewrite existing content
- **ADD**: Add new information
- **INFO**: Get information (no content changes)

## How It Works

### 1. AI Intent Analysis

When a user submits a request, the system sends a specially formatted prompt to the AI model:

```
Note Content: [user's note]
User request: [user's question]

TASK: Analyze the user's request and respond with:
1. First line: INTENT:REPLACE or INTENT:ADD or INTENT:INFO
2. Following lines: The content to fulfill the request
```

**Example:**
- User: "what else can I add about whales?"
- AI Response:
  ```
  INTENT:ADD
  * **Migration Patterns**: Gray whales travel 14,000 miles annually
  * **Social Behavior**: Whales live in pods like families
  ```

### 2. Response Parsing

The system parses the AI's response:
```typescript
const lines = response.trim().split('\n')
let intent: 'REPLACE' | 'ADD' | 'INFO' = 'INFO'
let content = response.trim()

if (lines[0] && lines[0].startsWith('INTENT:')) {
  const intentLine = lines[0].replace('INTENT:', '').trim()
  if (intentLine === 'REPLACE' || intentLine === 'ADD' || intentLine === 'INFO') {
    intent = intentLine
    content = lines.slice(1).join('\n').trim()
  }
}
```

### 3. Conditional Action Buttons

Based on the detected intent, different action buttons are displayed:

#### REPLACE Intent (Modify existing content)
- ✅ **Replace Content** - Replaces all note content
- ✅ **Copy** - Copy to clipboard
- ✅ **Insert Below** - Add to end of note

#### ADD Intent (Add new content)
- ❌ **Replace Content** - Hidden (doesn't make sense)
- ✅ **Copy** - Copy to clipboard
- ✅ **Insert Below** - Add to end of note

#### INFO Intent (Just information)
- ❌ No action buttons shown

## Undo Functionality

### Implementation

The system maintains a content history stack:

```typescript
const [contentHistory, setContentHistory] = useState<string[]>([])
```

**Before any change:**
```typescript
setContentHistory(prev => [...prev, content])  // Save current state
setContent(newContent)                          // Apply new content
```

**On Undo:**
```typescript
const previousContent = contentHistory[contentHistory.length - 1]
setContentHistory(prev => prev.slice(0, -1))
setContent(previousContent)
```

### User Experience

1. **Undo Button Visibility**: Appears in chat header only when history exists
2. **State Restoration**: Clicking Undo restores the previous content
3. **Multiple Undos**: Users can undo multiple times up to their history stack

## Example Workflows

### Workflow 1: Adding Content
```
User: "what other whale facts can i add?"
AI Intent: ADD
Buttons Shown: [Copy] [Insert Below]
User clicks: Insert Below ✓
Undo button appears
```

### Workflow 2: Modifying Content
```
User: "make this more professional"
AI Intent: REPLACE
Buttons Shown: [Replace Content] [Copy] [Insert Below]
User clicks: Replace Content ✓
Undo button appears
User clicks: Undo ✓ (content restored)
```

### Workflow 3: Information Query
```
User: "what's the main idea of this note?"
AI Intent: INFO
Buttons Shown: None (conversational response only)
```

## Technical Details

### Modified Components

1. **AIChatPanel.tsx**
   - Added `intent` field to Message interface
   - Implemented AI-powered intent detection in handleSubmit
   - Conditional rendering of action buttons based on intent
   - Added Undo button in header

2. **NoteEditor.tsx**
   - Added `contentHistory` state
   - Modified `handleReplaceContent` to save history
   - Modified `handleInsertContent` to save history
   - Implemented `handleUndo` function
   - Passed `onUndo` and `canUndo` props to AIChatPanel

### Props Interface

```typescript
interface AIChatPanelProps {
  note: Note
  onReplaceContent: (newContent: string) => void
  onInsertContent: (contentToInsert: string) => void
  onUndo?: () => void        // New: Undo callback
  canUndo?: boolean          // New: Whether undo is available
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isActionable?: boolean
  intent?: 'REPLACE' | 'ADD' | 'INFO'  // New: AI-detected intent
}
```

## Performance Considerations

**Question:** Does intent detection slow down responses?

**Answer:** No. The intent classification is done in the same AI call that generates the content. The AI simply adds one word (`INTENT:REPLACE/ADD/INFO`) to the beginning of its response. The additional processing time is negligible (milliseconds).

**Before:** One AI call → Get content
**After:** One AI call → Get intent + content (same speed)

## Benefits

1. **Contextual Awareness**: AI understands user intent, not just keywords
2. **Intuitive UI**: Only relevant actions are shown
3. **Safety Net**: Undo button provides confidence to experiment
4. **Better UX**: No more confusing "Replace Content" on add requests
5. **Flexible**: Works with natural language, not rigid command syntax

## Future Enhancements

1. **Multi-level Undo**: Support undo/redo stack with forward navigation
2. **Smart Suggestions**: "This will replace X lines. Continue?"
3. **Diff Preview**: Show what will change before applying
4. **Intent Confidence**: Display AI's confidence in its classification
5. **Custom Intents**: Support more specific intents (summarize, expand, format, etc.)

## Testing Scenarios

To verify the system works correctly:

### Test 1: Add Intent
- Query: "give me notes on hydration"
- Expected: Only Copy and Insert Below buttons
- Verify: No Replace Content button

### Test 2: Replace Intent  
- Query: "make this more professional"
- Expected: All three buttons (Replace, Copy, Insert)
- Verify: Replace Content button is present

### Test 3: Info Intent
- Query: "what is this note about?"
- Expected: No action buttons
- Verify: Conversational response only

### Test 4: Undo
- Perform Replace Content action
- Expected: Undo button appears
- Click Undo
- Verify: Content restored to previous state

## Conclusion

The AI-powered intent detection system transforms the chat from a simple keyword-matching interface into an intelligent, context-aware assistant that truly understands what users want to accomplish. Combined with the undo feature, users can confidently experiment with AI suggestions knowing they can always revert changes.