import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactElement
  side?: 'top' | 'bottom'
  maxWidth?: number
}

const GAP = 16
const VIEWPORT_PAD = 12

export function Tooltip({ content, children, side = 'top', maxWidth = 340 }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({
    x: 0,
    y: 0,
    width: maxWidth,
    arrowX: 0,
    actualSide: side as 'top' | 'bottom',
  })
  const wrapperRef = useRef<HTMLSpanElement>(null)

  const handleEnter = useCallback(() => {
    if (!wrapperRef.current) return

    const rect = wrapperRef.current.getBoundingClientRect()
    const width = Math.min(maxWidth, window.innerWidth - VIEWPORT_PAD * 2)
    const anchorX = rect.left + rect.width / 2
    const spaceAbove = rect.top
    const spaceBelow = window.innerHeight - rect.bottom
    const needsSpace = 84 + GAP
    const actualSide: 'top' | 'bottom' =
      side === 'top' && spaceAbove < needsSpace ? 'bottom' :
      side === 'bottom' && spaceBelow < needsSpace ? 'top' :
      side
    const x = Math.max(VIEWPORT_PAD, Math.min(window.innerWidth - width - VIEWPORT_PAD, anchorX - width / 2))
    const y = actualSide === 'top' ? rect.top - GAP : rect.bottom + GAP
    const arrowX = Math.min(width - 16, Math.max(10, anchorX - x - 6))

    setCoords({ x, y, width, arrowX, actualSide })
    setOpen(true)
  }, [side, maxWidth])

  const handleLeave = useCallback(() => setOpen(false), [])

  if (!content) return children

  const yOffset = coords.actualSide === 'top' ? 6 : -6

  return (
    <>
      <span
        ref={wrapperRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="inline-flex"
      >
        {children}
      </span>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: yOffset, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: yOffset / 2, scale: 0.98 }}
              transition={{ type: 'spring', damping: 24, stiffness: 520, mass: 0.45 }}
              style={{
                position: 'fixed',
                left: coords.x,
                top: coords.y,
                transform: coords.actualSide === 'top' ? 'translateY(-100%)' : 'translateY(0)',
                width: coords.width,
                zIndex: 9999,
                pointerEvents: 'none',
              }}
            >
              <div className="relative border border-line-strong bg-inverse px-4 py-3 text-inverse-text shadow-[0_14px_34px_rgba(0,0,0,0.24)]">
                {typeof content === 'string' ? (
                  <p className="font-mono text-[13px] leading-[1.45] text-inverse-text">{content}</p>
                ) : content}

                {coords.actualSide === 'top' && (
                  <div style={{
                    position: 'absolute', bottom: -6, left: coords.arrowX,
                    width: 0, height: 0,
                    borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
                    borderTop: '6px solid rgb(var(--color-inverse-bg))',
                  }} />
                )}
                {coords.actualSide === 'bottom' && (
                  <div style={{
                    position: 'absolute', top: -6, left: coords.arrowX,
                    width: 0, height: 0,
                    borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
                    borderBottom: '6px solid rgb(var(--color-inverse-bg))',
                  }} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
