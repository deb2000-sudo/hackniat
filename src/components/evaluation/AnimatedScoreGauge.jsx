import { useEffect, useState } from 'react'

export default function AnimatedScoreGauge({ value = 0, label = 'Evaluation score' }) {
  const target = Math.max(0, Math.min(100, Number(value) || 0))
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    let frameId
    const startedAt = performance.now()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reduceMotion ? 1 : 900

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(target * eased)
      if (progress < 1) frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [target])

  const tone = target >= 75 ? 'success' : target >= 50 ? 'warning' : 'brand'

  return (
    <div
      className={`animated-score animated-score--${tone}`}
      style={{ '--score-angle': `${displayed * 3.6}deg` }}
      role="img"
      aria-label={`${label}: ${target} percent`}
    >
      <div className="animated-score__inner">
        <strong>{Math.round(displayed)}<span>%</span></strong>
        <small>{label}</small>
      </div>
    </div>
  )
}
