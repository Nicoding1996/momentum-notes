import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  SpeechRecognition,
  SpeechRecognitionEvent,
  SpeechRecognitionErrorEvent
} from '@/types/speech-recognition'

export interface TranscriptionStatus {
  supported: boolean
  isRecording: boolean
  error: string | null
}

interface UseVoiceTranscriptionOptions {
  onTranscript?: (text: string, isFinal: boolean) => void
  continuous?: boolean
  interimResults?: boolean
  language?: string
}

export function useVoiceTranscription({
  onTranscript,
  continuous = true,
  interimResults = true,
  language = 'en-US',
}: UseVoiceTranscriptionOptions = {}) {
  const [status, setStatus] = useState<TranscriptionStatus>({
    supported: false,
    isRecording: false,
    error: null,
  })

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const interimTranscriptRef = useRef<string>('')

  // Check browser support on mount
  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      setStatus({
        supported: false,
        isRecording: false,
        error: 'Speech Recognition is not supported in this browser. Please use Chrome, Edge, or Safari.',
      })
      return
    }

    setStatus((prev) => ({
      ...prev,
      supported: true,
      error: null,
    }))
  }, [])

  // Initialize recognition instance
  const initializeRecognition = useCallback(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionAPI) return null

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = language
    recognition.maxAlternatives = 1

    // Handle results
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }

      if (finalTranscript) {
        onTranscript?.(finalTranscript.trim(), true)
        interimTranscriptRef.current = ''
      } else if (interimTranscript) {
        interimTranscriptRef.current = interimTranscript
        onTranscript?.(interimTranscript, false)
      }
    }

    // Handle errors
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[VoiceTranscription] Error:', event.error)
      
      // Handle "no-speech" error differently - it's not critical, just restart
      if (event.error === 'no-speech') {
        console.log('[VoiceTranscription] No speech detected, continuing to listen...')
        // Don't stop recording, the recognition will restart automatically
        return
      }

      let errorMessage = 'An error occurred during speech recognition.'

      switch (event.error) {
        case 'audio-capture':
          errorMessage = 'Microphone not found or not working.'
          break
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please allow microphone access.'
          break
        case 'network':
          errorMessage = 'Network error occurred during speech recognition.'
          break
        case 'aborted':
          // User manually stopped, don't show as error
          console.log('[VoiceTranscription] Recognition aborted by user')
          return
        case 'service-not-allowed':
          errorMessage = 'Speech recognition service is not allowed.'
          break
      }

      setStatus((prev) => ({
        ...prev,
        isRecording: false,
        error: errorMessage,
      }))

      recognitionRef.current = null
    }

    // Handle end
    recognition.onend = () => {
      console.log('[VoiceTranscription] Recognition ended')
      
      // If we're still supposed to be recording, restart automatically
      // This handles cases where recognition stops due to silence
      if (recognitionRef.current) {
        console.log('[VoiceTranscription] Auto-restarting recognition...')
        try {
          recognition.start()
        } catch (error) {
          console.error('[VoiceTranscription] Failed to restart:', error)
          setStatus((prev) => ({
            ...prev,
            isRecording: false,
          }))
          recognitionRef.current = null
        }
      } else {
        setStatus((prev) => ({
          ...prev,
          isRecording: false,
        }))
      }
    }

    // Handle start
    recognition.onstart = () => {
      console.log('[VoiceTranscription] Recognition started')
      setStatus((prev) => ({
        ...prev,
        isRecording: true,
        error: null,
      }))
    }

    return recognition
  }, [continuous, interimResults, language, onTranscript])

  // Start recording
  const startRecording = useCallback(async () => {
    if (!status.supported) {
      setStatus((prev) => ({
        ...prev,
        error: 'Speech Recognition is not supported in this browser.',
      }))
      return
    }

    if (recognitionRef.current) {
      console.warn('[VoiceTranscription] Already recording')
      return
    }

    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true })

      const recognition = initializeRecognition()
      if (!recognition) {
        throw new Error('Failed to initialize speech recognition')
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (error) {
      console.error('[VoiceTranscription] Failed to start recording:', error)
      let errorMessage = 'Failed to start recording.'

      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Microphone permission denied. Please allow microphone access.'
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone.'
        }
      }

      setStatus((prev) => ({
        ...prev,
        isRecording: false,
        error: errorMessage,
      }))
    }
  }, [status.supported, initializeRecognition])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
      interimTranscriptRef.current = ''
    }
  }, [])

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (status.isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [status.isRecording, startRecording, stopRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
    }
  }, [])

  return {
    status,
    startRecording,
    stopRecording,
    toggleRecording,
  }
}