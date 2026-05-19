import { useState, useRef, useCallback, useEffect } from 'react'

export interface AudioRecorderResult {
  recording: boolean
  seconds: number
  uploading: boolean
  setUploading: (v: boolean) => void
  start: () => Promise<boolean>
  stop: () => Promise<{ blob: Blob; duration: number } | null>
  cancel: () => void
}

export function useAudioRecorder(): AudioRecorderResult {
  const [recording, setRecording]   = useState(false)
  const [seconds, setSeconds]       = useState(0)
  const [uploading, setUploading]   = useState(false)
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef  = useRef<ReturnType<typeof setInterval>>(undefined)

  const start = useCallback(async (): Promise<boolean> => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find(m => MediaRecorder.isTypeSupported(m)) ?? ''
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(200)
      mediaRef.current = mr
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
      return true
    } catch {
      return false
    }
  }, [])

  const stop = useCallback((): Promise<{ blob: Blob; duration: number } | null> => {
    return new Promise(resolve => {
      clearInterval(timerRef.current)
      const mr = mediaRef.current
      if (!mr) { resolve(null); return }
      const dur = seconds
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        mr.stream.getTracks().forEach(t => t.stop())
        mediaRef.current = null
        setRecording(false)
        setSeconds(0)
        resolve(blob.size > 0 ? { blob, duration: dur } : null)
      }
      mr.stop()
    })
  }, [seconds])

  const cancel = useCallback(() => {
    clearInterval(timerRef.current)
    if (mediaRef.current) {
      mediaRef.current.stream.getTracks().forEach(t => t.stop())
      mediaRef.current = null
    }
    setRecording(false)
    setSeconds(0)
  }, [])

  useEffect(() => () => { clearInterval(timerRef.current) }, [])

  return { recording, seconds, uploading, setUploading, start, stop, cancel }
}
