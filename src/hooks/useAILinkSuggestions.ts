import { useState, useEffect, useRef, useCallback } from 'react'
import { useChromeAI } from './useChromeAI'
import { db } from '@/lib/db'
import type { Note } from '@/types/note'

export interface LinkSuggestion {
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
  
  const { status: aiStatus, generateText } = useChromeAI()
  
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
      const response = await generateText(prompt)
      const parsed = parseAIResponse(response, candidates)
      
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
    generateText,
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
    }, 10000) // 10 second pause
    
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
  `${i + 1}. "${note.title}" (ID: ${note.id}, tags: ${note.tags?.join(', ') || 'none'})`
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
function parseAIResponse(response: string, candidates: Note[]): LinkSuggestion[] {
  try {
    // Remove markdown code blocks if present
    let cleaned = response.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```\n?$/g, '')
    }
    
    const parsed = JSON.parse(cleaned)
    
    if (!Array.isArray(parsed)) return []
    
    // Create a map of candidates by ID for validation
    const candidateMap = new Map(candidates.map(n => [n.id, n]))
    
    return parsed
      .filter(item => 
        typeof item.noteId === 'string' &&
        typeof item.noteTitle === 'string' &&
        typeof item.confidence === 'number' &&
        item.confidence >= 0 &&
        item.confidence <= 1 &&
        candidateMap.has(item.noteId) // Validate note ID exists
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