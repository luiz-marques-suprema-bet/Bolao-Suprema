import { useState, useRef } from 'react'

interface RecordResult { blob: Blob; duration: number }

export function useAudioRecorder() {
  const [recording,  setRecording]  = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [seconds,    setSeconds]    = useState(0)
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef  = useRef<ReturnType<typeof setInterval>>(undefined)
  const startTime = useRef<number>(0)

  async function start(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec    = new MediaRecorder(stream)
      mediaRef.current  = rec
      chunksRef.current = []
      startTime.current = Date.now()
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.start(100)
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(Math.floor((Date.now() - startTime.current) / 1000)), 500)
      return true
    } catch { return false }
  }

  function stop(): Promise<RecordResult | null> {
    return new Promise(resolve => {
      const rec = mediaRef.current
      if (!rec) { resolve(null); return }
      const duration = Math.round((Date.now() - startTime.current) / 1000)
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        rec.stream.getTracks().forEach(t => t.stop())
        setRecording(false)
        clearInterval(timerRef.current)
        resolve({ blob, duration })
      }
      rec.stop()
    })
  }

  function cancel() {
    const rec = mediaRef.current
    if (rec) { rec.stream.getTracks().forEach(t => t.stop()); rec.stop() }
    clearInterval(timerRef.current)
    setRecording(false)
    setSeconds(0)
  }

  return { recording, uploading, setUploading, seconds, start, stop, cancel }
}
