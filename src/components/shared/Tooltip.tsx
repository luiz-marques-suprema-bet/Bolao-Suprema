import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactElement
  side?: 'top' | 'bottom'
  maxWidth?: number
}

export function Tooltip({ content, children, side = 'top', maxWidth = 240 }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0, arrowX: 0, actualSide: side as 'top' | 'bottom' })

  const handleEnter = useCallback((e: React.MouseEvent) => {
    const mx = e.clientX
    const my = e.clientY
    const actualSide: 'top' | 'bottom' =
      side === 'top'    && my < 80                        ? 'bottom' :
      side === 'bottom' && window.innerHeight - my < 80   ? 'top'    :
      side

    const tooltipLeft = Math.max(8, Math.min(window.innerWidth - maxWidth - 8, mx - maxWidth / 2))
    const arrowX = Math.min(maxWidth - 16, Math.max(10, mx - tooltipLeft - 6))

    setCoords({
      x: tooltipLeft,
      y: actualSide === 'top' ? my - 10 : my + 10,
      arrowX,
      actualSide,
    })
    setOpen(true)
  }, [side, maxWidth])

  const handleLeave = useCallback(() => setOpen(false), [])

  if (!content) return children

  const yOffset = coords.actualSide === 'top' ? 6 : -6

  return (
    <>
      <span onMouseEnter={handleEnter} onMouseLeave={handleLeave} className="inline-flex">
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
                transform: coords.actualSide === 'top' ? 'translateY(-100%)' : 'translateY(0)',
                width: maxWidth,
                zIndex: 9999,
                pointerEvents: 'none',
              }}
            >
              <div className="bg-ink text-paper px-3 py-2.5 border border-white/[0.08] shadow-2xl relative">
                {typeof content === 'string' ? (
                  <p className="font-mono text-[10px] leading-relaxed text-paper/90">{content}</p>
                ) : (
                  content
                )}

                {coords.actualSide === 'top' && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -6,
                      left: coords.arrowX,
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '6px solid #0D0D0D',
                    }}
                  />
                )}

                {coords.actualSide === 'bottom' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -6,
                      left: coords.arrowX,
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderBottom: '6px solid #0D0D0D',
                    }}
                  />
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
