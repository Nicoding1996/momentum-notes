import { useState, useEffect, useCallback } from 'react'

export interface AIStatus {
  available: boolean
  languageModel: 'readily' | 'after-download' | 'no'
  writer: 'readily' | 'after-download' | 'no'
  summarizer: 'readily' | 'after-download' | 'no'
  loading: boolean
  error: string | null
}

export function useChromeAI() {
  const [status, setStatus] = useState<AIStatus>({
    available: false,
    languageModel: 'no',
    writer: 'no',
    summarizer: 'no',
    loading: true,
    error: null,
  })

  // Check AI availability on mount
  useEffect(() => {
    async function checkAvailability() {
      try {
        if (!window.ai) {
          setStatus({
            available: false,
            languageModel: 'no',
            writer: 'no',
            summarizer: 'no',
            loading: false,
            error: 'Chrome AI is not available. Please use Chrome 128+ with AI features enabled.',
          })
          return
        }

        const [languageModelCaps, writerCaps, summarizerCaps] = await Promise.all([
          window.ai.languageModel?.capabilities().catch(() => ({ available: 'no' as const })),
          window.ai.writer?.capabilities().catch(() => ({ available: 'no' as const })),
          window.ai.summarizer?.capabilities().catch(() => ({ available: 'no' as const })),
        ])

        const available = 
          languageModelCaps?.available !== 'no' ||
          writerCaps?.available !== 'no' ||
          summarizerCaps?.available !== 'no'

        setStatus({
          available,
          languageModel: languageModelCaps?.available || 'no',
          writer: writerCaps?.available || 'no',
          summarizer: summarizerCaps?.available || 'no',
          loading: false,
          error: available ? null : 'No AI features are available',
        })
      } catch (error) {
        setStatus({
          available: false,
          languageModel: 'no',
          writer: 'no',
          summarizer: 'no',
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to check AI availability',
        })
      }
    }

    checkAvailability()
  }, [])

  // Expand text using Writer API
  const expandText = useCallback(async (text: string, context?: string): Promise<string> => {
    if (!window.ai?.writer) {
      throw new Error('Writer API not available')
    }

    try {
      const writer = await window.ai.writer.create({
        tone: 'neutral',
        format: 'plain-text',
        length: 'medium',
      })

      const result = await writer.write(text, { context })
      writer.destroy()
      return result
    } catch (error) {
      throw new Error(`Failed to expand text: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [])

  // Summarize text using Summarizer API
  const summarizeText = useCallback(async (text: string, type: 'tl;dr' | 'key-points' = 'tl;dr'): Promise<string> => {
    if (!window.ai?.summarizer) {
      throw new Error('Summarizer API not available')
    }

    try {
      const summarizer = await window.ai.summarizer.create({
        type,
        format: 'plain-text',
        length: 'short',
      })

      const result = await summarizer.summarize(text)
      summarizer.destroy()
      return result
    } catch (error) {
      throw new Error(`Failed to summarize text: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [])

  // Generate text using Language Model (Prompt API)
  const generateText = useCallback(async (prompt: string, systemPrompt?: string): Promise<string> => {
    if (!window.ai?.languageModel) {
      throw new Error('Language Model API not available')
    }

    try {
      const model = await window.ai.languageModel.create({
        systemPrompt,
        temperature: 0.7,
        topK: 3,
      })

      const result = await model.prompt(prompt)
      model.destroy()
      return result
    } catch (error) {
      throw new Error(`Failed to generate text: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [])

  // Improve writing using Rewriter API (if available)
  const improveWriting = useCallback(async (text: string, tone: 'more-formal' | 'more-casual' = 'more-formal'): Promise<string> => {
    if (!window.ai?.rewriter) {
      // Fallback to language model if rewriter not available
      return generateText(
        `Rewrite the following text in a ${tone === 'more-formal' ? 'formal' : 'casual'} tone:\n\n${text}`,
        'You are a writing assistant that helps improve text.'
      )
    }

    try {
      const rewriter = await window.ai.rewriter.create({
        tone,
        format: 'plain-text',
        length: 'as-is',
      })

      const result = await rewriter.rewrite(text)
      rewriter.destroy()
      return result
    } catch (error) {
      throw new Error(`Failed to improve writing: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [generateText])

  return {
    status,
    expandText,
    summarizeText,
    generateText,
    improveWriting,
  }
}