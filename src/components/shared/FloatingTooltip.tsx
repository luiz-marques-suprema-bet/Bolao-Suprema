import { ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface FloatingTooltipProps {
  label: ReactNode
  children: ReactNode
  className?: string
}

export function FloatingTooltip({ label, children, className }: FloatingTooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [open, setOpen]     = useState(false)
  // Start off-screen so first render is invisible while we measure
  const [pos, setPos]       = useState({ top: -9999, left: -9999 })

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return

    const calculate = () => {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect    = trigger.getBoundingClientRect()
      const tw      = tooltipRef.current?.offsetWidth  ?? 340
      const th      = tooltipRef.current?.offsetHeight ?? 66
      const gap     = 14
      const pad     = 8

      // Horizontal: center over the trigger element, clamped to viewport
      const rawLeft = rect.left + rect.width / 2 - tw / 2
      const left    = Math.max(
        pad + window.scrollX,
        Math.min(rawLeft + window.scrollX, window.scrollX + window.innerWidth - tw - pad),
      )

      // Vertical: above by default; fall back to below if not enough space
      const top = rect.top - th - gap >= pad
        ? rect.top - th - gap + window.scrollY
        : rect.bottom + gap + window.scrollY

      setPos({ top, left })
    }

    calculate()
    window.addEventListener('scroll',  calculate, true)
    window.addEventListener('resize',  calculate)
    return () => {
      window.removeEventListener('scroll',  calculate, true)
      window.removeEventListener('resize',  calculate)
    }
  }, [open])

  if (!label) return <>{children}</>

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() =>  setOpen(true)}
        onBlur={() =>   setOpen(false)}
        className={cn('inline-flex cursor-help', className)}
      >
        {children}
      </span>

      {open && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{ position: 'absolute', top: pos.top, left: pos.left }}
          className="z-[9999] max-w-[340px] border border-line-strong bg-inverse px-4 py-3 font-mono text-[13px] leading-[1.45] text-inverse-text shadow-[0_14px_34px_rgba(0,0,0,0.24)] pointer-events-none"
        >
          {label}
        </div>,
        document.body,
      )}
    </>
  )
}
