import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, ChatPoll } from '@/types'
import { MOCK_CHAT } from '@/data/mock'

interface ChatState {
  messages: ChatMessage[]
  pinnedId: string | null

  addMessage: (msg: ChatMessage) => void
  setPinned: (id: string | null) => void
  voteOnPoll: (msgId: string, userId: string, optionId: string) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: MOCK_CHAT,
      pinnedId: 'c4',

      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

      setPinned: (id) => set({ pinnedId: id }),

      voteOnPoll: (msgId, userId, optionId) =>
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.id !== msgId || !m.poll) return m
            return {
              ...m,
              poll: { ...m.poll, votes: { ...m.poll.votes, [userId]: optionId } } as ChatMessage['poll'],
            }
          }),
        })),
    }),
    { name: 'bolao-chat' }
  )
)
