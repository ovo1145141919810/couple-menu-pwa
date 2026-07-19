import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText as GSAPSplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, GSAPSplitText, useGSAP)

interface SplitTextProps {
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p'
  text?: string
  className?: string
  delay?: number
  duration?: number
  ease?: string
  splitType?: 'chars' | 'words' | 'lines' | 'words, chars'
  from?: gsap.TweenVars
  to?: gsap.TweenVars
  threshold?: number
  rootMargin?: string
  textAlign?: CSSProperties['textAlign']
  triggerOnMount?: boolean
  onLetterAnimationComplete?: () => void
}

export default function SplitText({
  text = '',
  className = '',
  delay = 50,
  duration = 1.25,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  textAlign = 'left',
  triggerOnMount = false,
  tag = 'p',
  onLetterAnimationComplete
}: SplitTextProps) {
  const ref = useRef<HTMLElement | null>(null)
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onLetterAnimationComplete)
  const [fontsLoaded, setFontsLoaded] = useState(() => document.fonts.status === 'loaded')
  const setElementRef = useCallback((node: HTMLElement | null) => {
    ref.current = node
  }, [])

  useEffect(() => {
    onCompleteRef.current = onLetterAnimationComplete
  }, [onLetterAnimationComplete])

  useEffect(() => {
    if (fontsLoaded) return
    let active = true
    void document.fonts.ready.then(() => active && setFontsLoaded(true))
    return () => {
      active = false
    }
  }, [fontsLoaded])

  useGSAP(
    () => {
      const element = ref.current
      if (!element || !text || !fontsLoaded || completedRef.current) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        completedRef.current = true
        onCompleteRef.current?.()
        return
      }

      const startPercent = (1 - threshold) * 100
      const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin)
      const marginValue = marginMatch ? Number.parseFloat(marginMatch[1]) : 0
      const marginUnit = marginMatch?.[2] || 'px'
      const sign = marginValue === 0 ? '' : marginValue < 0 ? `-=${Math.abs(marginValue)}${marginUnit}` : `+=${marginValue}${marginUnit}`

      const split = new GSAPSplitText(element, {
        type: splitType,
        smartWrap: true,
        linesClass: 'split-line',
        wordsClass: 'split-word',
        charsClass: 'split-char',
        reduceWhiteSpace: false,
        aria: 'auto'
      })
      const targets = splitType.includes('chars') && split.chars.length
        ? split.chars
        : splitType.includes('words') && split.words.length
          ? split.words
          : split.lines

      const tween = gsap.fromTo(
        targets,
        { ...from },
        {
          ...to,
          duration,
          ease,
          stagger: delay / 1000,
          scrollTrigger: triggerOnMount
            ? undefined
            : {
                trigger: element,
                start: `top ${startPercent}%${sign}`,
                once: true,
                fastScrollEnd: true,
                anticipatePin: 0.4
              },
          onComplete: () => {
            completedRef.current = true
            onCompleteRef.current?.()
          },
          willChange: 'transform, opacity',
          force3D: true
        }
      )

      return () => {
        tween.scrollTrigger?.kill()
        tween.kill()
        split.revert()
      }
    },
    {
      dependencies: [text, delay, duration, ease, splitType, JSON.stringify(from), JSON.stringify(to), threshold, rootMargin, fontsLoaded, triggerOnMount],
      scope: ref
    }
  )

  const style: CSSProperties = {
    textAlign,
    overflow: 'hidden',
    display: 'inline-block',
    whiteSpace: 'normal',
    overflowWrap: 'break-word',
    willChange: 'transform, opacity'
  }

  const elementProps = { ref: setElementRef, style, className: `split-parent ${className}`.trim() }
  if (tag === 'h1') return <h1 {...elementProps}>{text}</h1>
  if (tag === 'h2') return <h2 {...elementProps}>{text}</h2>
  if (tag === 'h3') return <h3 {...elementProps}>{text}</h3>
  if (tag === 'h4') return <h4 {...elementProps}>{text}</h4>
  if (tag === 'h5') return <h5 {...elementProps}>{text}</h5>
  if (tag === 'h6') return <h6 {...elementProps}>{text}</h6>
  return <p {...elementProps}>{text}</p>
}
