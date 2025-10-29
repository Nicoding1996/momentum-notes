// Chrome Built-in AI API Type Definitions
// Based on https://developer.chrome.com/docs/ai/built-in

export interface AICapabilities {
  available: 'readily' | 'after-download' | 'no'
}

// Prompt API (Gemini Nano)
export interface AILanguageModel {
  prompt(input: string): Promise<string>
  promptStreaming(input: string): ReadableStream
  destroy(): void
}

export interface AILanguageModelFactory {
  capabilities(): Promise<AICapabilities>
  create(options?: {
    systemPrompt?: string
    temperature?: number
    topK?: number
  }): Promise<AILanguageModel>
}

// Writer API
export interface AIWriter {
  write(input: string, options?: {
    context?: string
  }): Promise<string>
  writeStreaming(input: string, options?: {
    context?: string
  }): ReadableStream
  destroy(): void
}

export interface AIWriterFactory {
  capabilities(): Promise<AICapabilities>
  create(options?: {
    sharedContext?: string
    tone?: 'formal' | 'neutral' | 'casual'
    format?: 'plain-text' | 'markdown'
    length?: 'short' | 'medium' | 'long'
  }): Promise<AIWriter>
}

// Rewriter API
export interface AIRewriter {
  rewrite(input: string, options?: {
    context?: string
  }): Promise<string>
  rewriteStreaming(input: string, options?: {
    context?: string
  }): ReadableStream
  destroy(): void
}

export interface AIRewriterFactory {
  capabilities(): Promise<AICapabilities>
  create(options?: {
    sharedContext?: string
    tone?: 'as-is' | 'more-formal' | 'more-casual'
    format?: 'as-is' | 'plain-text' | 'markdown'
    length?: 'as-is' | 'shorter' | 'longer'
  }): Promise<AIRewriter>
}

// Summarizer API
export interface AISummarizer {
  summarize(input: string, options?: {
    context?: string
  }): Promise<string>
  summarizeStreaming(input: string, options?: {
    context?: string
  }): ReadableStream
  destroy(): void
}

export interface AISummarizerFactory {
  capabilities(): Promise<AICapabilities>
  create(options?: {
    sharedContext?: string
    type?: 'tl;dr' | 'key-points' | 'teaser' | 'headline'
    format?: 'plain-text' | 'markdown'
    length?: 'short' | 'medium' | 'long'
  }): Promise<AISummarizer>
}

// Extend Window interface
declare global {
  interface Window {
    ai?: {
      languageModel?: AILanguageModelFactory
      writer?: AIWriterFactory
      rewriter?: AIRewriterFactory
      summarizer?: AISummarizerFactory
    }
  }
}

export {}