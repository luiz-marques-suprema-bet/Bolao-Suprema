import { useState } from 'react'
import { motion } from 'framer-motion'
import type { ChatPoll } from '@/types'

interface PollModalProps {
  onCreate: (poll: ChatPoll) => void
  onClose: () => void
}

export function PollModal({ onCreate, onClose }: PollModalProps) {
  const [question, setQuestion] = useState('')
  const [options, setOptions]   = useState(['', ''])
  const valid = question.trim().length > 0 && options.filter(o => o.trim()).length >= 2

  const handleCreate = () => {
    if (!valid) return
    onCreate({
      question: question.trim(),
      options: options.filter(o => o.trim()).map((text, i) => ({ id: `o${i + 1}`, text: text.trim() })),
      votes: {},
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-ink/60 px-0 md:px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="w-full md:max-w-md bg-paper border-2 border-ink p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <p className="font-display text-2xl">CRIAR ENQUETE</p>
          <button onClick={onClose} className="font-mono text-[10px] text-ink-3 hover:text-ink">FECHAR</button>
        </div>
        <div className="space-y-3">
          <input
            value={question} onChange={e => setQuestion(e.target.value)}
            placeholder="Qual é a pergunta?"
            className="w-full bg-paper-deep border border-line px-3 py-2.5 font-sans text-[14px] outline-none focus:border-ink placeholder:text-ink-4"
          />
          <p className="font-mono text-[9px] text-ink-4 tracking-eyebrow">OPÇÕES (mín. 2, máx. 4)</p>
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="font-mono text-[10px] text-ink-4 w-4 text-right flex-shrink-0">{i + 1}</span>
              <input
                value={opt}
                onChange={e => setOptions(prev => prev.map((o, idx) => idx === i ? e.target.value : o))}
                placeholder={`Opção ${i + 1}`}
                className="flex-1 bg-paper-deep border border-line px-3 py-2 font-sans text-[13px] outline-none focus:border-ink placeholder:text-ink-4"
              />
              {options.length > 2 && (
                <button
                  onClick={() => setOptions(prev => prev.filter((_, idx) => idx !== i))}
                  className="font-mono text-[12px] text-ink-4 hover:text-red w-5 flex-shrink-0"
                >×</button>
              )}
            </div>
          ))}
          {options.length < 4 && (
            <button onClick={() => setOptions(prev => [...prev, ''])} className="font-mono text-[10px] text-ink-3 hover:text-ink">
              + ADICIONAR OPÇÃO
            </button>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-line font-mono text-[11px] py-2.5 hover:border-ink transition-colors">
            CANCELAR
          </button>
          <button onClick={handleCreate} disabled={!valid} className="flex-1 btn-yellow py-2.5 text-[11px] disabled:opacity-40">
            CRIAR ENQUETE
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
