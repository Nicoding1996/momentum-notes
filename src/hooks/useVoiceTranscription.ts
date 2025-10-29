
import { useState, useEffect, useCallback, useRef } from 'react'

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

// Extend the Window interface for Web Speech API
declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition
    webkitSpeechRecognition?: typeof SpeechRecognition
  }
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
