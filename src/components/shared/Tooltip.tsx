import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactElement
  side?: 'top' | 'bottom'
  maxWidth?: number
}

// Space reserved above/below the element (includes the 6px arrow)
const GAP = 18

export function Tooltip({ content, children, side = 'top', maxWidth = 300 }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0, arrowX: 0, actualSide: side as 'top' | 'bottom' })
  const wrapperRef = useRef<HTMLSpanElement>(null)

  const handleEnter = useCallback((e: React.MouseEvent) => {
    if (!wrapperRef.current) return
    const r = wrapperRef.current.getBoundingClientRect()
    const mx = e.clientX

    // Flip only when there is genuinely not enough room above (rough tooltip height: 76px + gap)
    const spaceAbove = r.top
    const spaceBelow = window.innerHeight - r.bottom
    const needsSpace = 76 + GAP
    const actualSide: 'top' | 'bottom' =
      side === 'top'    && spaceAbove < needsSpace ? 'bottom' :
      side === 'bottom' && spaceBelow < needsSpace ? 'top'    :
      side

    // Y is anchored to the element edge — tooltip never touches the trigger
    const y = actualSide === 'top' ? r.top - GAP : r.bottom + GAP

    const tooltipLeft = Math.max(8, Math.min(window.innerWidth - maxWidth - 8, mx - maxWidth / 2))
    const arrowX = Math.min(maxWidth - 16, Math.max(10, mx - tooltipLeft - 6))

    setCoords({ x: tooltipLeft, y, arrowX, actualSide })
    setOpen(true)
  }, [side, maxWidth])

  // Arrow X tracks cursor; Y stays frozen so tooltip never drifts onto the element
  const handleMove = useCallback((e: React.MouseEvent) => {
    if (!open) return
    const mx = e.clientX
    const tooltipLeft = Math.max(8, Math.min(window.innerWidth - maxWidth - 8, mx - maxWidth / 2))
    const arrowX = Math.min(maxWidth - 16, Math.max(10, mx - tooltipLeft - 6))
    setCoords(c => ({ ...c, arrowX }))
  }, [open, maxWidth])

  const handleLeave = useCallback(() => setOpen(false), [])

  if (!content) return children

  const yOffset = coords.actualSide === 'top' ? 6 : -6

  return (
    <>
      <span
        ref={wrapperRef}
        onMouseEnter={handleEnter}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        className="inline-flex"
      >
        {children}
      </span>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: yOffset, scale: 0.93 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: yOffset / 2, scale: 0.96 }}
              transition={{ type: 'spring', damping: 22, stiffness: 500, mass: 0.5 }}
              style={{
                position: 'fixed',
                left: coords.x,
                top: coords.y,
                // 'top' side: the value is the element's top edge minus GAP,
                // translateY(-100%) shifts the tooltip UP so its BOTTOM sits at that point.
                transform: coords.actualSide === 'top' ? 'translateY(-100%)' : 'translateY(0)',
                width: maxWidth,
                zIndex: 9999,
                pointerEvents: 'none',
              }}
            >
              <div className="relative border border-line-strong bg-inverse px-3.5 py-2.5 text-inverse-text shadow-[0_18px_50px_rgba(0,0,0,0.34),4px_4px_0_#FFCB05]">
                {typeof content === 'string' ? (
                  <p className="font-mono text-[11.5px] leading-[1.45] text-inverse-text">{content}</p>
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
