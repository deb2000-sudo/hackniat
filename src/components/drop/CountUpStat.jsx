import { useEffect, useRef, useState } from 'react'

const DURATION = 1100
const easeOut = (t) => 1 - (1 - t) ** 3

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Whether we should animate at all — checked at mount, before first paint. */
const canAnimate = () =>
  typeof IntersectionObserver !== 'undefined' && !prefersReducedMotion()

/**
 * Counts up once, the first time it scrolls into view. Never again — a number
 * that re-animates every time you scroll past it is a number nobody trusts.
 *
 * With reduced motion the final value is the initial state, so the number is
 * simply correct on first paint instead of animating and then snapping.
 */
export default function CountUpStat({ value, suffix = '', label, emphasis = false }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(() => (canAnimate() ? 0 : value))

  useEffect(() => {
    const node = ref.current
    if (!node || !canAnimate()) return undefined

    let frame
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return
        observer.disconnect()

        const start = performance.now()
        const step = (timestamp) => {
          const progress = Math.min(1, (timestamp - start) / DURATION)
          setShown(Math.round(easeOut(progress) * value))
          if (progress < 1) frame = requestAnimationFrame(step)
        }
        frame = requestAnimationFrame(step)
      },
      { threshold: 0.4 },
    )

    observer.observe(node)
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [value])

  return (
    /* Bottom-aligned: the emphasised stat is larger, so hanging all three off a
       shared bottom edge keeps the labels on one line. */
    <div
      ref={ref}
      className="flex flex-col justify-end border-t border-hairline py-6 first:pt-0 md:border-t-0 md:border-l md:px-8 md:py-0 md:first:border-l-0 md:first:pl-0"
    >
      <span
        className={`block font-mono leading-none font-medium tracking-[-0.03em] tabular-nums ${
          emphasis ? 'text-[44px] text-volt-ink xl:text-[56px]' : 'text-4xl text-ink xl:text-[44px]'
        }`}
      >
        {shown.toLocaleString('en-US')}
        {suffix}
      </span>
      <span className={`mt-3 block text-[15px] ${emphasis ? 'text-ink' : 'text-muted'}`}>
        {label}
      </span>
    </div>
  )
}
