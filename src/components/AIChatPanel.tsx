import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Loader2, Check, Copy, Undo2 } from 'lucide-react'
import { useChromeAI } from '@/hooks/useChromeAI'
import type { Note } from '@/types/note'

interface AIChatPanelProps {
  note: Note
  onReplaceContent: (newContent: string) => void
  onInsertContent: (contentToInsert: string) => void
  onUndo?: () => void
  canUndo?: boolean
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isActionable?: boolean
  intent?: 'REPLACE' | 'ADD' | 'INFO'
}

export function AIChatPanel({ note, onReplaceContent, onInsertContent, onUndo, canUndo }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>([])
  const { generateText, status } = useChromeAI()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [hasAnalyzed, setHasAnalyzed] = useState(false)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Proactive content analysis when chat opens
  useEffect(() => {
    if (!hasAnalyzed && status.available && note.content.trim()) {
      analyzeNoteContent()
      setHasAnalyzed(true)
    }
  }, [status.available, note.content, hasAnalyzed])

  const analyzeNoteContent = async () => {
    const wordCount = note.content.split(/\s+/).filter(w => w.length > 0).length
    const hasListItems = note.content.includes('*') || note.content.includes('-') || /^\d+\./.test(note.content)
    
    // Generate smart suggestions based on content analysis
    const suggestions: string[] = []
    
    if (wordCount < 50) {
      suggestions.push('Expand on this topic')
    }
    if (wordCount > 200) {
      suggestions.push('Summarize this note')
    }
    if (!hasListItems && wordCount > 100) {
      suggestions.push('Convert to bullet points')
    }
    
    // Always offer these common actions
    suggestions.push('What else can I add?', 'Make this more professional')
    
    setQuickSuggestions(suggestions.slice(0, 4))

    // Send initial greeting with context
    const greeting: Message = {
      role: 'assistant',
      content: `I'm analyzing your note about "${note.title}". ${
        wordCount < 30
          ? "It's quite brief - would you like to expand it?"
          : wordCount > 300
          ? "You have a detailed note here. I can help summarize or reorganize it."
          : "How can I help improve this note?"
      }`,
      timestamp: new Date(),
      isActionable: false,
    }
    setMessages([greeting])
  }

  const handleQuickSuggestion = (suggestion: string) => {
    setInput(suggestion)
    inputRef.current?.focus()
  }

  // Strip conversational filler and conversation history from content before adding to note
  const stripFillerText = (content: string): string => {
    // First, remove the entire conversation history block if it exists
    // This pattern looks for "Recent Conversation:" and removes everything up to the actual content
    const historyPattern = /^\s*\*\*?Recent Conversation:\*\*?\s*[\s\S]*?(USER:|ASSISTANT:)[\s\S]*?(\n\n|\r\n\r\n)/i
    let cleanedContent = content.replace(historyPattern, '')

    // Then, remove common conversational filler phrases from the beginning of the text
    const fillerPatterns = [
      /^Here are some .+?:\s*/i,
      /^Here's .+?:\s*/i,
      /^Here is .+?:\s*/i,
      /^I've .+?:\s*/i,
      /^I have .+?:\s*/i,
      /^Below .+?:\s*/i,
      /^The following .+?:\s*/i,
      /^This is .+?:\s*/i,
      /^These are .+?:\s*/i,
      /^Of course, .+?:\s*/i,
      /^Certainly, .+?:\s*/i,
    ]
    
    fillerPatterns.forEach(pattern => {
      cleanedContent = cleanedContent.replace(pattern, '')
    })
    
    return cleanedContent.trim()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      isActionable: false,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsProcessing(true)

    try {
      const context = `Note Title: "${note.title}"\n\nNote Content:\n${note.content}`
      
      // Build conversation history (last 3 messages for context)
      const recentMessages = messages.slice(-3)
      let conversationHistory = ''
      if (recentMessages.length > 0) {
        conversationHistory = '\n\nRecent Conversation:\n'
        recentMessages.forEach(msg => {
          const role = msg.role === 'user' ? 'USER' : 'ASSISTANT'
          conversationHistory += `${role}: ${msg.content}\n`
        })
      }
      
      // Use AI to determine intent with conversation context
      const prompt = `${context}${conversationHistory}

Current User Request: ${userMessage.content}

---
TASK: Analyze the user's request (considering the conversation history if present) and respond with:
1. First line MUST be exactly one of: INTENT:REPLACE or INTENT:ADD or INTENT:INFO
   - REPLACE: User wants to modify/rewrite/change existing content
   - ADD: User wants to add new information/facts/content
   - INFO: User is asking a question or needs explanation (no content changes)
2. Following lines: Provide the content to fulfill the request

CRITICAL FORMATTING RULES:
- For REPLACE: Provide ONLY the modified note content. NO explanations, NO "Here's the...", NO preambles.
- For ADD: Provide ONLY the new content to add. NO explanations, NO "Here's the content...", NO introductions.
- Start immediately with the actual content the user requested.
- For INFO: You may be conversational and friendly.

CONTEXT RULES:
- If user says "add it" or "insert that" or uses pronouns referring to previous content, use the content from the recent conversation
- If user asks for new content, generate new content
- If referring to previous conversation content, provide that content directly without any wrapper text

Begin your response now:`

      const systemPrompt = 'You are a helpful AI assistant that helps users work with their notes. Always start your response with INTENT:REPLACE, INTENT:ADD, or INTENT:INFO on the first line, then provide the requested content.'

      const response = await generateText(prompt, systemPrompt)

      // Parse the response
      const lines = response.trim().split('\n')
      let intent: 'REPLACE' | 'ADD' | 'INFO' = 'INFO'
      let content = response.trim()

      // Check if first line contains intent marker
      if (lines[0] && lines[0].startsWith('INTENT:')) {
        const intentLine = lines[0].replace('INTENT:', '').trim()
        if (intentLine === 'REPLACE' || intentLine === 'ADD' || intentLine === 'INFO') {
          intent = intentLine
          content = lines.slice(1).join('\n').trim()
        }
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: content,
        timestamp: new Date(),
        isActionable: intent === 'REPLACE' || intent === 'ADD',
        intent: intent,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('AI chat error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        isActionable: false,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCopy = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  if (!status.available) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Sparkles className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          AI features are not available in this browser.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Please use Chrome 128+ with AI features enabled.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-accent-50/30 to-white dark:from-accent-900/10 dark:to-gray-900">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-400 via-accent-500 to-accent-600 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-gray-900" />
        </div>
        <div className="flex-1">
          <h3 className="font-display font-semibold text-sm text-gray-900 dark:text-gray-100">
            AI Co-Pilot
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ask me to modify or improve your note
          </p>
        </div>
        {/* Undo Button */}
        {canUndo && onUndo && (
          <button
            onClick={onUndo}
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95 flex items-center gap-1.5"
            title="Undo last change"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-accent-400 via-accent-500 to-accent-600 text-gray-900'
                  : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.content}
              </p>
              <p
                className={`text-xs mt-1 ${
                  message.role === 'user'
                    ? 'text-gray-800'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              
              {/* Action Buttons for Actionable AI Messages */}
              {message.role === 'assistant' && message.isActionable && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                  {/* Replace Content - Only for REPLACE intent */}
                  {message.intent === 'REPLACE' && (
                    <button
                      onClick={() => onReplaceContent(stripFillerText(message.content))}
                      className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-gradient-to-br from-accent-400 via-accent-500 to-accent-600 text-gray-900 text-xs font-semibold hover:shadow-glow-accent transition-all active:scale-95"
                    >
                      Replace Content
                    </button>
                  )}
                  
                  {/* Copy - Always available for actionable messages */}
                  <button
                    onClick={() => handleCopy(stripFillerText(message.content), index)}
                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95 flex items-center gap-1"
                    title="Copy to clipboard"
                  >
                    {copiedIndex === index ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  
                  {/* Add to Note - Always available for actionable messages */}
                  <button
                    onClick={() => onInsertContent(stripFillerText(message.content))}
                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95"
                    title="Add content to your note"
                  >
                    Add to Note
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2.5">
              <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions */}
      {quickSuggestions.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick actions:</p>
          <div className="flex flex-wrap gap-2">
            {quickSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleQuickSuggestion(suggestion)}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 hover:border-accent-400 hover:text-accent-600 dark:hover:text-accent-400 transition-all active:scale-95 disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your command..."
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500 dark:focus:ring-accent-400 transition-all disabled:opacity-50 text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-accent-400 via-accent-500 to-accent-600 text-gray-900 font-medium transition-all hover:shadow-glow-accent active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Try: "Make this more professional" or "Expand on this idea"
        </p>
      </form>
    </div>
  )
}