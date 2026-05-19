import { useRef, useState, useCallback, useEffect } from 'react'
import type { ChatMessage } from '@/types'

export function useAutoScroll(messages: ChatMessage[], isLoaded: boolean) {
  const scrollRef        = useRef<HTMLDivElement>(null)
  const bottomRef        = useRef<HTMLDivElement>(null)
  const didInitRef       = useRef(false)
  const [atBottom, setAtBottom] = useState(true)

  useEffect(() => {
    if (!isLoaded) return
    const el = scrollRef.current
    if (!el) return
    if (!didInitRef.current) {
      el.scrollTop = el.scrollHeight
      didInitRef.current = true
      setAtBottom(true)
      return
    }
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, atBottom, isLoaded])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120)
  }, [])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setAtBottom(true)
  }, [])

  return { scrollRef, bottomRef, atBottom, handleScroll, scrollToBottom }
}
