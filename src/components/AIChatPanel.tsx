import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Loader2, Check, Copy, Undo2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useChromeAI } from '@/hooks/useChromeAI'
import { useToast } from '@/contexts/ToastContext'
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
  const { showToast } = useToast()
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

  // Convert HTML to plain text by removing HTML tags
  const stripHtmlTags = (html: string): string => {
    // Create a temporary div element to parse HTML
    const temp = document.createElement('div')
    temp.innerHTML = html
    
    // Get text content (this automatically strips all HTML tags)
    let text = temp.textContent || temp.innerText || ''
    
    // Clean up extra whitespace
    text = text.replace(/\s+/g, ' ').trim()
    
    return text
  }

  // Strip conversational filler, intent markers, and conversation history from content before adding to note
  const stripFillerText = (content: string): string => {
    // First, remove INTENT: markers if present
    let cleanedContent = content.replace(/^INTENT:(REPLACE|ADD|INFO)\s*/i, '')
    
    // Remove the entire conversation history block if it exists
    // This pattern looks for "Recent Conversation:" and removes everything up to the actual content
    const historyPattern = /^\s*\*\*?Recent Conversation:\*\*?\s*[\s\S]*?(USER:|ASSISTANT:)[\s\S]*?(\n\n|\r\n\r\n)/i
    cleanedContent = cleanedContent.replace(historyPattern, '')

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
      // Convert HTML content to plain text for AI context
      const plainTextContent = stripHtmlTags(note.content)
      const context = `Note Title: "${note.title}"\n\nNote Content:\n${plainTextContent}`
      
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
IMPORTANT: You MUST start your response with EXACTLY one of these on the first line:
- INTENT:REPLACE
- INTENT:ADD
- INTENT:INFO

WHEN TO USE EACH INTENT:

INTENT:REPLACE - Use when user wants to CHANGE/MODIFY/REWRITE the existing note:
  - summarize, summary, make shorter, condense
  - improve, make better, enhance, refine
  - rewrite, rephrase
  - simplify, make simpler, make easier
  - make it [professional/casual/formal]
  - fix, correct, edit
  
INTENT:ADD - Use when user wants to ADD NEW content to existing note:
  - what else can I add
  - give me more ideas/facts
  - expand (meaning add more content, not rewrite)
  
INTENT:INFO - Use only for pure questions with NO content changes:
  - what does this mean
  - explain this concept
  - how does X work

After the INTENT line, provide ONLY the content requested.

CRITICAL FORMATTING RULES:
- For REPLACE: Provide ONLY the modified note content. NO explanations, NO "Here's the...", NO preambles.
- For ADD: Provide ONLY the new content to add. NO explanations, NO "Here's the content...", NO introductions.
- Start immediately with the actual content the user requested.
- For INFO: You may be conversational and friendly.
- NEVER use HTML tags in your response. Use plain text or markdown formatting only.
- Do NOT include tags like <p>, <br>, <div>, etc. Just provide clean, readable text.

CONTEXT RULES:
- If user says "add it", "insert that", or similar, referring to the previous response, you MUST provide the content from the ASSISTANT's last message verbatim. DO NOT summarize or change it.
- If user asks for new content, generate new content.

Begin your response now:`

      const systemPrompt = 'You are a helpful AI assistant that helps users work with their notes. CRITICAL: Always start your response with INTENT:REPLACE, INTENT:ADD, or INTENT:INFO on the first line, then provide the requested content. NEVER use HTML tags - only use plain text or markdown formatting.'

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
          console.log('[AI Chat] AI provided intent:', intent)
        }
      }
      
      // ALWAYS check user's request for keywords to validate/override AI's intent
      const userRequest = userMessage.content.toLowerCase().trim()
      console.log('[AI Chat] User request:', userRequest)
      
      // Keywords that indicate REPLACE intent
      const replaceKeywords = [
        'summar', 'shorten', 'condense', 'trim',
        'improve', 'better', 'enhance', 'refine', 'polish',
        'rewrite', 'rephrase', 'reformulate', 'restructure',
        'simplif', 'simpler', 'easier', 'less complicated',
        'make it', 'make this',
        'fix', 'correct', 'edit', 'proofread',
        'convert', 'change to', 'turn into',
        'clarif', 'clearer',
        'professional', 'casual', 'formal'
      ]
      
      // Keywords that indicate ADD intent
      const addKeywords = [
        'add', 'what else', 'give me more', 'expand',
        'what other', 'additional', 'more ideas', 'more facts'
      ]
      
      // Check for keywords in user's request
      const hasReplaceKeyword = replaceKeywords.some(keyword => userRequest.includes(keyword))
      const hasAddKeyword = addKeywords.some(keyword => userRequest.includes(keyword))
      
      console.log('[AI Chat] Has REPLACE keyword:', hasReplaceKeyword)
      console.log('[AI Chat] Has ADD keyword:', hasAddKeyword)
      
      // Override AI's intent if user's request clearly indicates REPLACE or ADD
      if (hasReplaceKeyword && intent === 'INFO') {
        console.log('[AI Chat] Overriding INFO to REPLACE based on keywords')
        intent = 'REPLACE'
      } else if (hasAddKeyword && intent === 'INFO') {
        console.log('[AI Chat] Overriding INFO to ADD based on keywords')
        intent = 'ADD'
      } else if (hasReplaceKeyword && !intent) {
        intent = 'REPLACE'
      } else if (hasAddKeyword && !intent) {
        intent = 'ADD'
      }
      
      console.log('[AI Chat] Final intent:', intent)

      // Store the cleaned content without INTENT marker for display
      const displayContent = content.replace(/^INTENT:(REPLACE|ADD|INFO)\s*/i, '').trim()
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: displayContent,
        timestamp: new Date(),
        isActionable: intent === 'REPLACE' || intent === 'ADD',
        intent: intent,
      }
      
      console.log('[AI Chat] Assistant message created:', {
        intent: assistantMessage.intent,
        isActionable: assistantMessage.isActionable,
        contentPreview: content.substring(0, 50) + '...'
      })

      setMessages((prev) => [...prev, assistantMessage])
      
      // Show success toast
      showToast('AI response generated successfully', 'success', 2000)
    } catch (error) {
      console.error('AI chat error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        isActionable: false,
      }
      setMessages((prev) => [...prev, errorMessage])
      
      // Show error toast
      showToast(
        error instanceof Error ? error.message : 'Failed to process AI request',
        'error',
        4000
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCopy = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
      showToast('Copied to clipboard', 'success', 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      showToast('Failed to copy to clipboard', 'error', 3000)
    }
  }

  const handleReplaceWithToast = (content: string) => {
    onReplaceContent(content)
    showToast('Content replaced successfully', 'success', 2000)
  }

  const handleInsertWithToast = (content: string) => {
    onInsertContent(content)
    showToast('Content added to note', 'success', 2000)
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
      <div className="flex items-center gap-2 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-accent-400 via-accent-500 to-accent-600 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-900" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate">
            AI Co-Pilot
          </h3>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
            Ask me to modify or improve your note
          </p>
        </div>
        {/* Undo Button */}
        {canUndo && onUndo && (
          <button
            onClick={onUndo}
            className="px-2 sm:px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-[10px] sm:text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95 flex items-center gap-1 sm:gap-1.5 flex-shrink-0"
            title="Undo last change"
          >
            <Undo2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Undo</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 custom-scrollbar">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[90%] sm:max-w-[85%] rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-accent-400 via-accent-500 to-accent-600 text-gray-900'
                  : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {message.role === 'assistant' ? (
                <div className="text-xs sm:text-sm leading-relaxed markdown-content prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-bold text-gray-900 dark:text-gray-100">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              )}
              <p
                className={`text-[10px] sm:text-xs mt-1 ${
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
              
              {/* Action Buttons for Assistant Messages */}
              {message.role === 'assistant' && (
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 dark:border-gray-600">
                  {/* Replace Content - Only for REPLACE intent */}
                  {message.isActionable && message.intent === 'REPLACE' && (
                    <button
                      onClick={() => handleReplaceWithToast(stripFillerText(message.content))}
                      className="flex-1 min-w-[100px] sm:min-w-[140px] px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-gradient-to-br from-accent-400 via-accent-500 to-accent-600 text-gray-900 text-[10px] sm:text-xs font-semibold hover:shadow-glow-accent transition-all active:scale-95"
                    >
                      Replace
                    </button>
                  )}
                  
                  {/* Copy - Always available for ALL assistant messages */}
                  <button
                    onClick={() => handleCopy(stripFillerText(message.content), index)}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-[10px] sm:text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95 flex items-center gap-1"
                    title="Copy to clipboard"
                  >
                    {copiedIndex === index ? (
                      <>
                        <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span className="hidden sm:inline">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span className="hidden sm:inline">Copy</span>
                      </>
                    )}
                  </button>
                  
                  {/* Add to Note - Always available for ALL assistant messages */}
                  <button
                    onClick={() => handleInsertWithToast(stripFillerText(message.content))}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-[10px] sm:text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95 whitespace-nowrap"
                    title="Add content to your note"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5">
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions */}
      {quickSuggestions.length > 0 && (
        <div className="px-3 sm:px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 flex-shrink-0">
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-2">Quick actions:</p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {quickSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleQuickSuggestion(suggestion)}
                disabled={isProcessing}
                className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 hover:border-accent-400 hover:text-accent-600 dark:hover:text-accent-400 transition-all active:scale-95 disabled:opacity-50"
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
        className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0"
      >
        <div className="flex gap-1.5 sm:gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type command..."
            disabled={isProcessing}
            className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500 dark:focus:ring-accent-400 transition-all disabled:opacity-50 text-xs sm:text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-accent-400 via-accent-500 to-accent-600 text-gray-900 font-medium transition-all hover:shadow-glow-accent active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex-shrink-0"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-2 hidden sm:block">
          Try: "Make this more professional" or "Expand on this idea"
        </p>
      </form>
    </div>
  )
}