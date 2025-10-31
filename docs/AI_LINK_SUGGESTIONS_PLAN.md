# AI-Powered Link Suggestions Implementation Plan

## Overview
This document outlines the design for implementing real-time, AI-powered link suggestions that proactively help users build their knowledge graph while writing. This feature leverages the built-in Chrome AI to analyze content and suggest relevant connections.

## Purpose & Benefits

### User Value
- **Proactive**: System suggests links instead of user searching
- **Contextual**: Suggestions based on what user is currently writing
- **Smart**: AI understands semantic relationships, not just keywords
- **Frictionless**: One-click to accept, easy to dismiss
- **Learning**: Helps discover forgotten connections

### Examples
```
User writes: "When implementing authentication, consider security best practices..."

AI suggests:
💡 Link to [[Security Checklist]]? (90% confidence)
   ✓ Shared tags: security, development
   ✓ Similar content about authentication
   
💡 Link to [[OAuth Implementation Guide]]? (75% confidence)
   ✓ Mentions authentication patterns
```

---

## Architecture Design

### When to Trigger Suggestions

**Strategy: Balanced Approach**
- Not too frequent (annoying)
- Not too rare (misses opportunities)

**Triggers**:
1. **Paragraph completion** - User types period + Enter
2. **Pause in typing** - 3 seconds of inactivity
3. **Manual trigger** - Keyboard shortcut (Ctrl+Shift+L)
4. **On save** - Batch suggestions when note is saved

**Debouncing**:
- Minimum 5 seconds between auto-suggestions
- Prevent rapid-fire suggestions that interrupt flow

### AI Analysis Pipeline

```
┌─────────────────────────────────────────────────────┐
│ 1. TRIGGER EVENT                                     │
│    (paragraph complete, pause, or manual)            │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ 2. EXTRACT CONTEXT                                   │
│    - Current paragraph (last 200 chars)              │
│    - Note title                                      │
│    - Note tags                                       │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ 3. CANDIDATE FILTERING                               │
│    - Exclude current note                            │
│    - Exclude already linked notes                    │
│    - Get top 20 recent/relevant notes                │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ 4. AI SEMANTIC ANALYSIS                              │
│    Prompt: "Which of these notes are most relevant?" │
│    - Analyze content similarity                      │
│    - Consider tag overlap                            │
│    - Score confidence (0.0 - 1.0)                    │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ 5. RANKING & FILTERING                               │
│    - Only show confidence > 0.7                      │
│    - Limit to top 2-3 suggestions                    │
│    - Sort by confidence descending                   │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ 6. DISPLAY SUGGESTIONS                               │
│    - Ghost text inline OR panel                      │
│    - One-click accept/dismiss                        │
│    - Track acceptance rate for learning              │
└─────────────────────────────────────────────────────┘
```

---

## Component Implementation

### 1. AI Link Suggester Hook

```typescript
// src/hooks/useAILinkSuggestions.ts

import { useState, useEffect, useRef, useCallback } from 'react'
import { useChromeAI } from './useChromeAI'
import { db } from '@/lib/db'
import type { Note } from '@/types/note'

interface LinkSuggestion {
  noteId: string
  noteTitle: string
  confidence: number
  reason: string
  sharedTags: string[]
}

interface UseAILinkSuggestionsOptions {
  currentNoteId: string
  currentContent: string
  currentTags: string[]
  enabled: boolean
  triggerMode: 'auto' | 'manual'
}

export function useAILinkSuggestions({
  currentNoteId,
  currentContent,
  currentTags,
  enabled,
  triggerMode,
}: UseAILinkSuggestionsOptions) {
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const lastAnalysisTime = useRef<number>(0)
  const debounceTimer = useRef<NodeJS.Timeout>()
  
  const { status: aiStatus, analyzeText } = useChromeAI()
  
  // Debounced analysis function
  const analyzeSuggestions = useCallback(async () => {
    if (!enabled || !aiStatus.available) return
    
    // Rate limiting: minimum 5 seconds between analyses
    const now = Date.now()
    if (now - lastAnalysisTime.current < 5000) return
    
    setIsAnalyzing(true)
    lastAnalysisTime.current = now
    
    try {
      // 1. Extract context (last paragraph)
      const context = extractLastParagraph(currentContent, 200)
      if (context.trim().length < 20) {
        // Not enough context
        setSuggestions([])
        return
      }
      
      // 2. Get candidate notes
      const candidates = await getCandidateNotes(currentNoteId, currentTags)
      if (candidates.length === 0) {
        setSuggestions([])
        return
      }
      
      // 3. Build AI prompt
      const prompt = buildSuggestionPrompt(
        context,
        currentTags,
        candidates
      )
      
      // 4. Get AI analysis
      const response = await analyzeText(prompt)
      const parsed = parseAIResponse(response)
      
      // 5. Filter and rank
      const filtered = parsed
        .filter(s => s.confidence > 0.7)
        .slice(0, 3)
        .sort((a, b) => b.confidence - a.confidence)
      
      setSuggestions(filtered)
    } catch (error) {
      console.error('AI link suggestion error:', error)
      setSuggestions([])
    } finally {
      setIsAnalyzing(false)
    }
  }, [
    enabled,
    aiStatus.available,
    currentNoteId,
    currentContent,
    currentTags,
    analyzeText,
  ])
  
  // Auto-trigger on typing pause (debounced)
  useEffect(() => {
    if (triggerMode !== 'auto') return
    
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    
    // Set new timer
    debounceTimer.current = setTimeout(() => {
      analyzeSuggestions()
    }, 3000) // 3 second pause
    
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [currentContent, triggerMode, analyzeSuggestions])
  
  // Manual trigger function
  const triggerManually = useCallback(() => {
    analyzeSuggestions()
  }, [analyzeSuggestions])
  
  // Clear suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestions([])
  }, [])
  
  return {
    suggestions,
    isAnalyzing,
    triggerManually,
    clearSuggestions,
  }
}

// Helper: Extract last paragraph
function extractLastParagraph(html: string, maxChars: number): string {
  // Strip HTML
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  
  // Find last paragraph break
  const paragraphs = text.split(/\n\n|\. /)
  const lastParagraph = paragraphs[paragraphs.length - 1]
  
  // Truncate if too long
  return lastParagraph.slice(-maxChars)
}

// Helper: Get candidate notes for analysis
async function getCandidateNotes(
  currentNoteId: string,
  currentTags: string[]
): Promise<Note[]> {
  // Get existing wikilinks to exclude already-linked notes
  const existingLinks = await db.wikilinks
    .where('sourceNoteId')
    .equals(currentNoteId)
    .toArray()
  
  const linkedNoteIds = new Set(
    existingLinks.map(l => l.targetNoteId).filter(Boolean) as string[]
  )
  
  // Get all notes
  const allNotes = await db.notes.toArray()
  
  // Filter and prioritize
  const candidates = allNotes
    .filter(note => {
      // Exclude current note
      if (note.id === currentNoteId) return false
      
      // Exclude already linked notes
      if (linkedNoteIds.has(note.id)) return false
      
      return true
    })
    .map(note => {
      // Calculate priority score
      let score = 0
      
      // Recency bonus (updated in last 7 days)
      const daysSinceUpdate = 
        (Date.now() - new Date(note.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceUpdate < 7) score += 2
      
      // Tag overlap bonus
      const sharedTags = note.tags?.filter(t => currentTags.includes(t)) || []
      score += sharedTags.length * 3
      
      return { note, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20) // Top 20 candidates
    .map(c => c.note)
  
  return candidates
}

// Helper: Build AI prompt
function buildSuggestionPrompt(
  context: string,
  tags: string[],
  candidates: Note[]
): string {
  return `You are an AI assistant helping a user build connections in their note-taking system.

Current context the user is writing:
"${context}"

Current note tags: ${tags.join(', ') || 'none'}

Available notes to potentially link:
${candidates.map((note, i) => 
  `${i + 1}. "${note.title}" (tags: ${note.tags?.join(', ') || 'none'})`
).join('\n')}

Task: Analyze which notes (if any) are most relevant to link from the current context.

Return a JSON array of suggestions with this exact format:
[
  {
    "noteId": "abc123",
    "noteTitle": "Note Title",
    "confidence": 0.85,
    "reason": "Brief explanation why this is relevant",
    "sharedTags": ["tag1", "tag2"]
  }
]

Rules:
- Only suggest notes with confidence > 0.7
- Maximum 3 suggestions
- confidence must be between 0.0 and 1.0
- Reason should be < 60 characters
- Return empty array [] if no good suggestions
- Response must be valid JSON only, no markdown or explanation`
}

// Helper: Parse AI response
function parseAIResponse(response: string): LinkSuggestion[] {
  try {
    // Remove markdown code blocks if present
    let cleaned = response.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```\n?$/g, '')
    }
    
    const parsed = JSON.parse(cleaned)
    
    if (!Array.isArray(parsed)) return []
    
    return parsed
      .filter(item => 
        typeof item.noteId === 'string' &&
        typeof item.noteTitle === 'string' &&
        typeof item.confidence === 'number' &&
        item.confidence >= 0 &&
        item.confidence <= 1
      )
      .map(item => ({
        noteId: item.noteId,
        noteTitle: item.noteTitle,
        confidence: item.confidence,
        reason: item.reason || 'Relevant content',
        sharedTags: Array.isArray(item.sharedTags) ? item.sharedTags : [],
      }))
  } catch (error) {
    console.error('Failed to parse AI response:', error)
    return []
  }
}
```

### 2. Suggestion Display Component

```typescript
// src/components/LinkSuggestionPanel.tsx

import { Sparkles, X, Check } from 'lucide-react'
import type { Note } from '@/types/note'

interface LinkSuggestion {
  noteId: string
  noteTitle: string
  confidence: number
  reason: string
  sharedTags: string[]
}

interface LinkSuggestionPanelProps {
  suggestions: LinkSuggestion[]
  isAnalyzing: boolean
  onAccept: (noteId: string, noteTitle: string) => void
  onDismiss: () => void
}

export function LinkSuggestionPanel({
  suggestions,
  isAnalyzing,
  onAccept,
  onDismiss,
}: LinkSuggestionPanelProps) {
  if (isAnalyzing) {
    return (
      <div className="link-suggestion-panel analyzing">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span className="text-sm">Analyzing connections...</span>
        </div>
      </div>
    )
  }
  
  if (suggestions.length === 0) return null
  
  return (
    <div className="link-suggestion-panel">
      {/* Header */}
      <div className="suggestion-header">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-500" />
          <span className="text-sm font-medium">Link Suggestions</span>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          aria-label="Dismiss suggestions"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      
      {/* Suggestions */}
      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <SuggestionItem
            key={suggestion.noteId}
            suggestion={suggestion}
            onAccept={() => onAccept(suggestion.noteId, suggestion.noteTitle)}
          />
        ))}
      </div>
    </div>
  )
}

function SuggestionItem({
  suggestion,
  onAccept,
}: {
  suggestion: LinkSuggestion
  onAccept: () => void
}) {
  const confidenceColor = 
    suggestion.confidence >= 0.9 ? 'text-green-600' :
    suggestion.confidence >= 0.8 ? 'text-blue-600' :
    'text-yellow-600'
  
  return (
    <div className="suggestion-item">
      <div className="flex items-start gap-3">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
            [[{suggestion.noteTitle}]]
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {suggestion.reason}
          </div>
          {suggestion.sharedTags.length > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              Tags: {suggestion.sharedTags.join(', ')}
            </div>
          )}
        </div>
        
        {/* Confidence & Action */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-medium ${confidenceColor}`}>
            {Math.round(suggestion.confidence * 100)}%
          </span>
          <button
            onClick={onAccept}
            className="btn-primary text-xs p-2"
            aria-label="Accept suggestion"
          >
            <Check className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Integration with NoteEditor

```typescript
// Updates to NoteEditor.tsx

import { useAILinkSuggestions } from '@/hooks/useAILinkSuggestions'
import { LinkSuggestionPanel } from '@/components/LinkSuggestionPanel'

export function NoteEditor({ note, onClose }: NoteEditorProps) {
  // ... existing code ...
  
  // AI Link Suggestions
  const {
    suggestions,
    isAnalyzing,
    triggerManually,
    clearSuggestions,
  } = useAILinkSuggestions({
    currentNoteId: note.id,
    currentContent: content,
    currentTags: tags,
    enabled: true,
    triggerMode: 'auto',
  })
  
  // Accept suggestion
  const handleAcceptSuggestion = (noteId: string, noteTitle: string) => {
    if (!editor) return
    
    // Insert wikilink at cursor
    editor.chain()
      .focus()
      .insertContent(` [[${noteTitle}]] `)
      .run()
    
    // Clear suggestions
    clearSuggestions()
    
    // Show toast
    showToast(`Linked to ${noteTitle}`, 'success', 2000)
  }
  
  // Keyboard shortcut: Ctrl+Shift+L
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'l') {
        e.preventDefault()
        triggerManually()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [triggerManually])
  
  return (
    <div className="note-editor">
      {/* ... header ... */}
      
      <EditorContent editor={editor} />
      
      {/* Link Suggestions - floating panel */}
      {(suggestions.length > 0 || isAnalyzing) && (
        <div className="fixed bottom-20 right-8 z-50">
          <LinkSuggestionPanel
            suggestions={suggestions}
            isAnalyzing={isAnalyzing}
            onAccept={handleAcceptSuggestion}
            onDismiss={clearSuggestions}
          />
        </div>
      )}
      
      {/* ... footer ... */}
    </div>
  )
}
```

---

## Styling

```css
/* Add to src/index.css */

/* Suggestion Panel */
.link-suggestion-panel {
  background: white;
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  padding: 16px;
  min-width: 320px;
  max-width: 400px;
  animation: slideUp 200ms ease-out;
}

.dark .link-suggestion-panel {
  background: var(--color-gray-800);
  border-color: var(--color-gray-700);
}

.link-suggestion-panel.analyzing {
  padding: 12px 16px;
}

/* Header */
.suggestion-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-gray-200);
}

.dark .suggestion-header {
  border-bottom-color: var(--color-gray-700);
}

/* Suggestion Item */
.suggestion-item {
  padding: 12px;
  border-radius: 8px;
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-200);
  transition: all 150ms;
}

.dark .suggestion-item {
  background: var(--color-gray-900);
  border-color: var(--color-gray-700);
}

.suggestion-item:hover {
  background: var(--color-primary-50);
  border-color: var(--color-primary-200);
}

.dark .suggestion-item:hover {
  background: var(--color-primary-900);
  border-color: var(--color-primary-700);
}

/* Animation */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## User Experience Flow

### Auto-Suggestion Flow
```
User types: "We should implement authentication using JWT tokens..."
    ↓
[3 second pause]
    ↓
AI analyzes in background
    ↓
Panel appears bottom-right:
┌─────────────────────────────────────┐
│ 💡 Link Suggestions                 │
├─────────────────────────────────────┤
│ [[JWT Implementation Guide]] 92%    │
│ Similar authentication patterns  [✓]│
│                                     │
│ [[Security Best Practices]] 85%    │
│ Discusses token security         [✓]│
└─────────────────────────────────────┘
    ↓
User clicks [✓] on first suggestion
    ↓
[[JWT Implementation Guide]] inserted at cursor
    ↓
Panel disappears
```

### Manual Trigger Flow
```
User presses Ctrl+Shift+L
    ↓
"Analyzing connections..." appears
    ↓
Suggestions appear within 1-2 seconds
    ↓
User accepts or dismisses
```

---

## Performance Optimization

### 1. Caching
```typescript
// Cache AI responses for 5 minutes
const responseCache = new Map<string, { 
  suggestions: LinkSuggestion[]
  timestamp: number 
}>()

function getCachedOrAnalyze(context: string) {
  const cached = responseCache.get(context)
  if (cached && Date.now() - cached.timestamp < 300000) {
    return cached.suggestions
  }
  
  // Perform analysis...
  const suggestions = await analyze()
  responseCache.set(context, { suggestions, timestamp: Date.now() })
  return suggestions
}
```

### 2. Debouncing
- 3 second typing pause before auto-trigger
- 5 second cooldown between analyses
- Prevents excessive API calls

### 3. Candidate Filtering
- Limit to 20 candidate notes (not all notes)
- Prioritize by recency + tag overlap
- Reduces AI analysis time

---

## Settings & Preferences

```typescript
// User preferences
interface LinkSuggestionSettings {
  enabled: boolean              // Master toggle
  autoTrigger: boolean          // Auto vs manual only
  minConfidence: number         // 0.7 - 0.95
  maxSuggestions: number        // 1 - 5
  cooldownSeconds: number       // 5 - 30
}

// Default settings
const DEFAULT_SETTINGS: LinkSuggestionSettings = {
  enabled: true,
  autoTrigger: true,
  minConfidence: 0.7,
  maxSuggestions: 3,
  cooldownSeconds: 5,
}
```

---

## Implementation Checklist

- [ ] Create `useAILinkSuggestions` hook
- [ ] Implement helper functions (extract context, get candidates)
- [ ] Build AI prompt template
- [ ] Create `LinkSuggestionPanel` component
- [ ] Add suggestion acceptance handler
- [ ] Integrate with NoteEditor
- [ ] Add keyboard shortcut (Ctrl+Shift+L)
- [ ] Implement caching layer
- [ ] Add user settings
- [ ] Style panel and animations
- [ ] Test with various content types
- [ ] Measure performance and accuracy

---

## Success Metrics

### Adoption
- % of users who accept at least 1 suggestion per session
- Target: 40% acceptance rate

### Quality
- Average confidence score of accepted suggestions
- Target: > 0.85

### Performance
- Suggestion generation time
- Target: < 2 seconds

---

## Timeline Estimate

- **Week 1**: Hook implementation + AI prompting
- **Week 2**: Component development
- **Week 3**: Integration + testing
- **Week 4**: Polish + settings

**Total: 4 weeks**

---

*Document Version: 1.0*  
*Last Updated: 2025-01-31*  
*Author: Kilo Code (Architect Mode)*