import { useState, useEffect, useCallback } from 'react'

export interface AIStatus {
  available: boolean
  languageModel: 'readily' | 'after-download' | 'no'
  writer: 'readily' | 'after-download' | 'no'
  summarizer: 'readily' | 'after-download' | 'no'
  loading: boolean
  error: string | null
}

// Compatibility layer for different Chrome AI API surfaces
declare global {
  interface Window {
    LanguageModel?: any
  }
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

  // Reusable availability checker (also used to refresh on demand)
  const checkAvailability = useCallback(async () => {
    try {
      // Check for multiple API surfaces (compatibility with different Chrome builds)
      const hasStandardAI = 'ai' in window && window.ai
      const hasLegacyPrompt = hasStandardAI && 'prompt' in (window.ai as any)
      const hasLegacyLanguageModel = 'LanguageModel' in window
      
      console.info('[ChromeAI] API surface check', {
        hasStandardAI,
        hasLegacyPrompt,
        hasLegacyLanguageModel,
        secureContext: window.isSecureContext,
        origin: location.origin,
      })

      if (!hasStandardAI && !hasLegacyPrompt && !hasLegacyLanguageModel) {
        console.warn('[ChromeAI] No AI API surface detected')
        setStatus({
          available: false,
          languageModel: 'no',
          writer: 'no',
          summarizer: 'no',
          loading: false,
          error: 'Chrome AI is not available. Use Chrome 128+ (Dev/Canary), enable flags at chrome://flags/#prompt-api-for-gemini-nano, and relaunch twice.',
        })
        return
      }

      // Try to get capabilities from available surfaces
      const [languageModelCaps, writerCaps, summarizerCaps] = await Promise.all([
        (async () => {
          if (hasStandardAI && window.ai && window.ai.languageModel?.capabilities) {
            return window.ai.languageModel.capabilities().catch(() => ({ available: 'no' as const }))
          }
          if (hasLegacyLanguageModel && window.LanguageModel?.capabilities) {
            return window.LanguageModel.capabilities().catch(() => ({ available: 'no' as const }))
          }
          // If legacy prompt API exists, assume language model is available
          if (hasLegacyPrompt) {
            return { available: 'readily' as const }
          }
          return { available: 'no' as const }
        })(),
        hasStandardAI && window.ai ? window.ai.writer?.capabilities().catch(() => ({ available: 'no' as const })) : Promise.resolve({ available: 'no' as const }),
        hasStandardAI && window.ai ? window.ai.summarizer?.capabilities().catch(() => ({ available: 'no' as const })) : Promise.resolve({ available: 'no' as const }),
      ])

      console.info('[ChromeAI] capabilities', {
        languageModelCaps,
        writerCaps,
        summarizerCaps,
      })

      // Consider AI available if we can create sessions (even if capabilities say no)
      // This handles the case where capabilities() is unreliable but the APIs actually work
      const hasWorkingLM = hasStandardAI || hasLegacyPrompt || hasLegacyLanguageModel
      
      const available = Boolean(
        (languageModelCaps?.available ?? 'no') !== 'no' ||
        (writerCaps?.available ?? 'no') !== 'no' ||
        (summarizerCaps?.available ?? 'no') !== 'no' ||
        hasWorkingLM
      )

      setStatus({
        available,
        languageModel: languageModelCaps?.available || (hasWorkingLM ? 'readily' : 'no'),
        writer: writerCaps?.available || 'no',
        summarizer: summarizerCaps?.available || 'no',
        loading: false,
        error: available ? null : 'AI features reported unavailable by Chrome',
      })
    } catch (error) {
      console.error('[ChromeAI] capability check failed', error)
      setStatus({
        available: false,
        languageModel: 'no',
        writer: 'no',
        summarizer: 'no',
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to check AI availability',
      })
    }
  }, [])

  // Check AI availability on mount
  useEffect(() => {
    checkAvailability()
  }, [checkAvailability])

  // Generate text using Language Model (Prompt API) with compatibility layer
  // This must be defined FIRST as it's used by other functions
  const generateText = useCallback(async (prompt: string, systemPrompt?: string): Promise<string> => {
    try {
      // Try standard API first
      if (window.ai?.languageModel?.create) {
        const model = await window.ai.languageModel.create({
          systemPrompt,
          temperature: 0.7,
          topK: 3,
        })
        const result = await model.prompt(prompt)
        model.destroy()
        return result
      }
      
      // Try legacy window.LanguageModel API
      if (window.LanguageModel?.create) {
        const model = await window.LanguageModel.create({
          systemPrompt,
          temperature: 0.7,
          topK: 3,
        })
        const result = await model.prompt(prompt)
        if (model.destroy) model.destroy()
        return result
      }
      
      // Try legacy window.ai.prompt API
      if (window.ai && 'prompt' in (window.ai as any)) {
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt
        return await (window.ai as any).prompt(fullPrompt)
      }
      
      throw new Error('No compatible Language Model API found')
    } catch (error) {
      throw new Error(`Failed to generate text: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [])

  // Expand text using Writer API (with Language Model fallback)
  const expandText = useCallback(async (text: string, context?: string): Promise<string> => {
    // Try native Writer API first
    if (window.ai?.writer) {
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
        console.warn('[ChromeAI] Writer API failed, falling back to Language Model:', error)
      }
    }

    // Fallback to Language Model with custom prompt
    const contextInfo = context ? `Context: ${context}\n\n` : ''
    const prompt = `${contextInfo}Expand the following brief text into a more detailed, well-written paragraph. Maintain the original meaning and tone, but add more depth, examples, and clarity. Output only the expanded text without any preamble.\n\nText to expand: "${text}"`
    return await generateText(prompt, 'You are a helpful writing assistant that expands brief ideas into full paragraphs.')
  }, [generateText])

  // Summarize text using Summarizer API (with Language Model fallback)
  const summarizeText = useCallback(async (text: string, type: 'tl;dr' | 'key-points' = 'tl;dr'): Promise<string> => {
    // Try native Summarizer API first
    if (window.ai?.summarizer) {
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
        console.warn('[ChromeAI] Summarizer API failed, falling back to Language Model:', error)
      }
    }

    // Fallback to Language Model with custom prompt
    const styleInstruction = type === 'key-points'
      ? 'Provide a bullet-point list of the key points.'
      : 'Provide a concise TL;DR summary in 1-2 sentences.'
    const prompt = `Summarize the following text. ${styleInstruction} Output only the summary without any preamble.\n\nText to summarize:\n${text}`
    return await generateText(prompt, 'You are a helpful assistant that creates clear, concise summaries.')
  }, [generateText])

  // Improve writing using Rewriter API (with Language Model fallback)
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

  // Diagnostic probe - attempts to actually create sessions
  const runDiagnosticProbe = useCallback(async (): Promise<string> => {
    const results: string[] = []
    
    try {
      // Test Language Model / Prompt API
      try {
        if (window.ai?.languageModel?.create) {
          const model = await window.ai.languageModel.create({ systemPrompt: 'test' })
          model.destroy?.()
          results.push('✅ Language Model: session created successfully')
        } else if (window.LanguageModel?.create) {
          const model = await window.LanguageModel.create({ systemPrompt: 'test' })
          model.destroy?.()
          results.push('✅ Legacy Language Model: session created successfully')
        } else if (window.ai && 'prompt' in (window.ai as any)) {
          await (window.ai as any).prompt('test')
          results.push('✅ Legacy Prompt API: test successful')
        } else {
          results.push('❌ Language Model: No API surface found')
        }
      } catch (error) {
        results.push(`❌ Language Model: ${error instanceof Error ? error.message : String(error)}`)
      }

      // Test Writer API
      try {
        if (window.ai?.writer?.create) {
          const writer = await window.ai.writer.create({ tone: 'neutral' })
          writer.destroy?.()
          results.push('✅ Writer API: session created successfully')
        } else {
          results.push('⚠️ Writer API: Not available')
        }
      } catch (error) {
        results.push(`❌ Writer API: ${error instanceof Error ? error.message : String(error)}`)
      }

      // Test Summarizer API
      try {
        if (window.ai?.summarizer?.create) {
          const summarizer = await window.ai.summarizer.create({ type: 'tl;dr' })
          summarizer.destroy?.()
          results.push('✅ Summarizer API: session created successfully')
        } else {
          results.push('⚠️ Summarizer API: Not available')
        }
      } catch (error) {
        results.push(`❌ Summarizer API: ${error instanceof Error ? error.message : String(error)}`)
      }

      return results.join('\n')
    } catch (error) {
      return `Probe failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }, [])

  return {
    status,
    expandText,
    summarizeText,
    generateText,
    improveWriting,
    refresh: checkAvailability,
    runDiagnosticProbe,
  }
}