import { useCallback, useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'

interface Spark {
  x: number
  y: number
  angle: number
  startTime: number
}

interface ClickSparkProps {
  sparkColor?: string
  sparkSize?: number
  sparkRadius?: number
  sparkCount?: number
  duration?: number
  easing?: 'linear' | 'ease-in' | 'ease-in-out' | 'ease-out'
  extraScale?: number
  buttonOnly?: boolean
  children: ReactNode
}

export default function ClickSpark({
  sparkColor = '#d96b7e',
  sparkSize = 10,
  sparkRadius = 20,
  sparkCount = 8,
  duration = 420,
  easing = 'ease-out',
  extraScale = 1,
  buttonOnly = false,
  children
}: ClickSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sparksRef = useRef<Spark[]>([])
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return
    let resizeTimer: number | undefined

    const resizeCanvas = () => {
      const { width, height } = parent.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(width * ratio))
      canvas.height = Math.max(1, Math.round(height * ratio))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      canvas.dataset.ratio = String(ratio)
    }
    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(resizeCanvas, 100)
    })
    observer.observe(parent)
    resizeCanvas()
    return () => {
      observer.disconnect()
      window.clearTimeout(resizeTimer)
    }
  }, [])

  const ease = useCallback((progress: number) => {
    if (easing === 'linear') return progress
    if (easing === 'ease-in') return progress * progress
    if (easing === 'ease-in-out') return progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress
    return progress * (2 - progress)
  }, [easing])

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
  }, [])

  const animate = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const ratio = Number(canvas.dataset.ratio || 1)

    const draw = (timestamp: number) => {
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)

      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = timestamp - spark.startTime
        if (elapsed >= duration) return false
        const progress = elapsed / duration
        const eased = ease(progress)
        const distance = eased * sparkRadius * extraScale
        const lineLength = sparkSize * (1 - eased)
        const x1 = spark.x + distance * Math.cos(spark.angle)
        const y1 = spark.y + distance * Math.sin(spark.angle)
        const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle)
        const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle)

        context.strokeStyle = sparkColor
        context.lineWidth = 2
        context.lineCap = 'round'
        context.beginPath()
        context.moveTo(x1, y1)
        context.lineTo(x2, y2)
        context.stroke()
        return true
      })

      frameRef.current = sparksRef.current.length ? requestAnimationFrame(draw) : null
    }
    frameRef.current = requestAnimationFrame(draw)
  }, [duration, ease, extraScale, sparkColor, sparkRadius, sparkSize])

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (buttonOnly && !(event.target as HTMLElement).closest('button')) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const now = performance.now()
    sparksRef.current.push(
      ...Array.from({ length: sparkCount }, (_, index) => ({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        angle: (2 * Math.PI * index) / sparkCount,
        startTime: now
      }))
    )
    if (frameRef.current === null) animate()
  }

  return (
    <div className="click-spark-root" onClick={handleClick}>
      <canvas ref={canvasRef} className="click-spark-canvas" aria-hidden="true" />
      {children}
    </div>
  )
}
