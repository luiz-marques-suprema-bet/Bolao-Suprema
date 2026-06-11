import { useState } from 'react'
import { motion } from 'framer-motion'
import type { ChatPoll } from '@/types'

interface PollModalProps {
  onCreate: (poll: ChatPoll) => void
  onClose: () => void
}

const MAX_OPTIONS = 15

export function PollModal({ onCreate, onClose }: PollModalProps) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])

  const setOpt = (index: number, value: string) => {
    setOptions(items => items.map((item, itemIndex) => itemIndex === index ? value : item))
  }

  const addOpt = () => {
    if (options.length < MAX_OPTIONS) setOptions(items => [...items, ''])
  }

  const submit = () => {
    const q = question.trim()
    const opts = options.map(option => option.trim()).filter(Boolean)
    if (!q || opts.length < 2) return
    onCreate({
      question: q,
      options: opts.map((text, index) => ({ id: `opt-${index}`, text })),
      votes: {},
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
        className="ui-card w-full max-w-sm p-6 flex flex-col gap-4 max-h-[92dvh] overflow-y-auto"
        onClick={event => event.stopPropagation()}
      >
        <div>
          <div className="font-display text-xl text-ink leading-none">NOVA ENQUETE</div>
          <div className="font-mono text-[10px] text-ink-4 mt-1">votacao rapida do grupo</div>
        </div>

        <input
          value={question}
          onChange={event => setQuestion(event.target.value)}
          placeholder="Pergunta da enquete..."
          className="border border-hairline bg-paper-deep px-3 py-2.5 font-sans text-[14px] outline-none focus:border-ink w-full"
        />

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 max-h-[42vh] overflow-y-auto pr-1">
            {options.map((option, index) => (
              <input
                key={index}
                value={option}
                onChange={event => setOpt(index, event.target.value)}
                placeholder={`Opcao ${index + 1}`}
                className="border border-hairline bg-paper-deep px-3 py-2 font-sans text-[13px] outline-none focus:border-ink w-full"
              />
            ))}
          </div>
          {options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={addOpt}
              className="font-mono text-[10px] text-ink-3 hover:text-ink border border-dashed border-hairline py-2 transition-colors"
            >
              + OPCAO ({options.length}/{MAX_OPTIONS})
            </button>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 font-mono text-[11px] tracking-widest py-3 border border-hairline text-ink-3 hover:border-ink hover:text-ink transition-colors"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!question.trim() || options.filter(option => option.trim()).length < 2}
            className="flex-1 font-mono text-[11px] tracking-widest py-3 bg-yellow text-ink border border-ink hover:bg-yellow/80 transition-colors disabled:opacity-40"
          >
            CRIAR
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
