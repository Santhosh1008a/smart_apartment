import { useEffect, useRef, useState } from "react"
import idle01 from "../../../../src/components/ai-assistant/assets/idle-01.png"
import idle03 from "../../../../src/components/ai-assistant/assets/idle-03.png"
import idle05 from "../../../../src/components/ai-assistant/assets/idle-05.png"
import idle07 from "../../../../src/components/ai-assistant/assets/idle-07.png"
import blink02 from "../../../../src/components/ai-assistant/assets/blink-02.png"
import winkLeft from "../../../../src/components/ai-assistant/assets/wink-left.png"
import winkRight from "../../../../src/components/ai-assistant/assets/wink-right.png"
import happy01 from "../../../../src/components/ai-assistant/assets/happy-01.png"
import happy03 from "../../../../src/components/ai-assistant/assets/happy-03.png"
import happy05 from "../../../../src/components/ai-assistant/assets/happy-05.png"
import happy07 from "../../../../src/components/ai-assistant/assets/happy-07.png"
import thinking01 from "../../../../src/components/ai-assistant/assets/thinking-01.png"
import thinking02 from "../../../../src/components/ai-assistant/assets/thinking-02.png"
import thinking03 from "../../../../src/components/ai-assistant/assets/thinking-03.png"
import thinking06 from "../../../../src/components/ai-assistant/assets/thinking-06.png"
import thinking07 from "../../../../src/components/ai-assistant/assets/thinking-07.png"
import working02 from "../../../../src/components/ai-assistant/assets/working-02.png"
import working04 from "../../../../src/components/ai-assistant/assets/working-04.png"
import working05 from "../../../../src/components/ai-assistant/assets/working-05.png"
import working06 from "../../../../src/components/ai-assistant/assets/working-06.png"
import dragging01 from "../../../../src/components/ai-assistant/assets/dragging-01.png"
import dragging03 from "../../../../src/components/ai-assistant/assets/dragging-03.png"
import dragging05 from "../../../../src/components/ai-assistant/assets/dragging-05.png"
import click01 from "../../../../src/components/ai-assistant/assets/click-01.png"
import click02 from "../../../../src/components/ai-assistant/assets/click-02.png"
import click03 from "../../../../src/components/ai-assistant/assets/click-03.png"
import click04 from "../../../../src/components/ai-assistant/assets/click-04.png"
import success01 from "../../../../src/components/ai-assistant/assets/success-01.png"
import success03 from "../../../../src/components/ai-assistant/assets/success-03.png"
import success05 from "../../../../src/components/ai-assistant/assets/success-05.png"
import success06 from "../../../../src/components/ai-assistant/assets/success-06.png"
import confused01 from "../../../../src/components/ai-assistant/assets/confused-01.png"
import confused02 from "../../../../src/components/ai-assistant/assets/confused-02.png"
import confused03 from "../../../../src/components/ai-assistant/assets/confused-03.png"
import confused05 from "../../../../src/components/ai-assistant/assets/confused-05.png"
import confused06 from "../../../../src/components/ai-assistant/assets/confused-06.png"
import "./AIMascot.css"

const POSITION_KEY = "syncliving.ai-mascot-position.v1"
const SEQUENCES = {
  idle: [idle01, idle03, idle05, idle07],
  click: [click01, click02, click03, click04],
  happy: [happy01, happy03, happy05, happy07],
  thinking: [thinking01, thinking02, thinking03, thinking06, thinking07],
  working: [working02, working04, working05, working06],
  dragging: [dragging01, dragging03, dragging05],
  success: [success01, success03, success05, success06],
  error: [confused01, confused02, confused03, confused05, confused06],
}
const ONE_SHOT_STATES = new Set(["click", "happy", "success", "error"])

function readSavedPosition() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(POSITION_KEY) || "null")
    return Number.isFinite(saved?.x) && Number.isFinite(saved?.y) ? saved : null
  } catch {
    return null
  }
}

function savePosition(position) {
  try {
    window.localStorage.setItem(POSITION_KEY, JSON.stringify(position))
  } catch {
    // The mascot remains draggable when browser storage is unavailable.
  }
}

function clampMascotPosition(candidate, buttonRef) {
  const rect = buttonRef.current?.getBoundingClientRect()
  const width = rect?.width || 96
  const height = rect?.height || 112
  const maxX = Math.max(8, window.innerWidth - width - 8)
  const maxY = Math.max(8, window.innerHeight - height - 8)
  return {
    x: Math.min(Math.max(8, candidate.x), maxX),
    y: Math.min(Math.max(8, candidate.y), maxY),
  }
}

function getDefaultMascotPosition(buttonRef) {
  const rect = buttonRef.current?.getBoundingClientRect()
  return clampMascotPosition({
    x: window.innerWidth - (rect?.width || 96) - 20,
    y: window.innerHeight - (rect?.height || 112) - 28,
  }, buttonRef)
}

export default function AIMascot({ state = "idle", onActivate }) {
  const buttonRef = useRef(null)
  const pointerRef = useRef(null)
  const positionRef = useRef(null)
  const suppressClickRef = useRef(false)
  const suppressTimerRef = useRef(null)
  const [position, setPosition] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [frameSelection, setFrameSelection] = useState({ state: "idle", index: 0 })
  const [autoBlink, setAutoBlink] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  const moveTo = (candidate, persist = false) => {
    const next = clampMascotPosition(candidate, buttonRef)
    positionRef.current = next
    setPosition(next)
    if (persist) savePosition(next)
  }

  useEffect(() => {
    const stored = readSavedPosition()
    const start = stored || getDefaultMascotPosition(buttonRef)
    positionRef.current = clampMascotPosition(start, buttonRef)
    setPosition(positionRef.current)

    const syncViewport = () => {
      const next = clampMascotPosition(positionRef.current || getDefaultMascotPosition(buttonRef), buttonRef)
      positionRef.current = next
      setPosition(next)
      savePosition(next)
    }
    window.addEventListener("resize", syncViewport)
    window.addEventListener("orientationchange", syncViewport)
    return () => {
      window.removeEventListener("resize", syncViewport)
      window.removeEventListener("orientationchange", syncViewport)
    }
  }, [])

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const syncMotion = () => setReducedMotion(motionPreference.matches)
    const syncVisibility = () => setIsVisible(document.visibilityState === "visible")
    syncMotion()
    syncVisibility()
    motionPreference.addEventListener?.("change", syncMotion)
    document.addEventListener("visibilitychange", syncVisibility)
    return () => {
      motionPreference.removeEventListener?.("change", syncMotion)
      document.removeEventListener("visibilitychange", syncVisibility)
    }
  }, [])

  useEffect(() => () => {
    window.clearTimeout(suppressTimerRef.current)
  }, [])

  const explicitFace = state === "wink-left"
    ? winkLeft
    : state === "wink-right"
      ? winkRight
      : null
  const isWinking = state === "wink-left" || state === "wink-right"
  const bodyState = isDragging ? "dragging" : (SEQUENCES[state] ? state : "idle")
  const frames = SEQUENCES[bodyState]
  const shouldAnimate = !reducedMotion && isVisible
  const frameIndex = frameSelection.state === bodyState ? frameSelection.index : 0

  useEffect(() => {
    if (!shouldAnimate || frames.length < 2) return undefined

    const frameDelay = bodyState === "idle" ? 420 : bodyState === "thinking" ? 360 : 190
    let nextIndex = 0
    const interval = window.setInterval(() => {
      if (ONE_SHOT_STATES.has(bodyState) && nextIndex >= frames.length - 1) {
        window.clearInterval(interval)
        return
      }
      nextIndex = (nextIndex + 1) % frames.length
      setFrameSelection({ state: bodyState, index: nextIndex })
    }, frameDelay)
    return () => window.clearInterval(interval)
  }, [bodyState, frames, shouldAnimate])

  useEffect(() => {
    if (!shouldAnimate || state !== "idle" || isDragging) {
      const resetTimer = window.setTimeout(() => setAutoBlink(false), 0)
      return () => window.clearTimeout(resetTimer)
    }

    let blinkTimer
    let reopenTimer
    const scheduleBlink = () => {
      blinkTimer = window.setTimeout(() => {
        setAutoBlink(true)
        reopenTimer = window.setTimeout(() => setAutoBlink(false), 145)
        scheduleBlink()
      }, 3800 + Math.random() * 2700)
    }
    scheduleBlink()
    return () => {
      window.clearTimeout(blinkTimer)
      window.clearTimeout(reopenTimer)
    }
  }, [isDragging, shouldAnimate, state])

  const startPointer = (event) => {
    if (!event.isPrimary || event.button !== 0) return
    const start = positionRef.current || getDefaultMascotPosition(buttonRef)
    positionRef.current = start
    setPosition(start)
    pointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPosition: start,
      moved: false,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const movePointer = (event) => {
    const pointer = pointerRef.current
    if (!pointer || pointer.pointerId !== event.pointerId) return
    const deltaX = event.clientX - pointer.startX
    const deltaY = event.clientY - pointer.startY
    if (!pointer.moved && Math.hypot(deltaX, deltaY) < 6) return
    pointer.moved = true
    event.preventDefault()
    setIsDragging(true)
    moveTo({
      x: pointer.startPosition.x + deltaX,
      y: pointer.startPosition.y + deltaY,
    })
  }

  const endPointer = (event) => {
    const pointer = pointerRef.current
    if (!pointer || pointer.pointerId !== event.pointerId) return
    pointerRef.current = null
    if (pointer.moved) {
      suppressClickRef.current = true
      window.clearTimeout(suppressTimerRef.current)
      suppressTimerRef.current = window.setTimeout(() => {
        suppressClickRef.current = false
      }, 500)
      if (positionRef.current) savePosition(positionRef.current)
    }
    setIsDragging(false)
  }

  const handleClick = (event) => {
    if (suppressClickRef.current && event.detail !== 0) {
      suppressClickRef.current = false
      window.clearTimeout(suppressTimerRef.current)
      return
    }
    suppressClickRef.current = false
    onActivate?.()
  }

  const handleKeyDown = (event) => {
    const offsets = {
      ArrowUp: [0, -20],
      ArrowDown: [0, 20],
      ArrowLeft: [-20, 0],
      ArrowRight: [20, 0],
    }
    const offset = offsets[event.key]
    if (!offset) return
    event.preventDefault()
    const current = positionRef.current || getDefaultMascotPosition(buttonRef)
    moveTo({ x: current.x + offset[0], y: current.y + offset[1] }, true)
  }

  const faceFrame = explicitFace || (autoBlink ? blink02 : null)
  const currentFrame = frames[Math.min(frameIndex, frames.length - 1)]
  const stateLabel = state === "thinking"
    ? "Thinking"
    : state === "working"
      ? "Working"
      : state === "success"
        ? "Finished successfully"
        : state === "error"
          ? "Needs attention"
          : "Ready"

  return (
    <button
      ref={buttonRef}
      type="button"
      className="ai-mascot"
      style={position ? { left: `${position.x}px`, top: `${position.y}px` } : undefined}
      data-state={isDragging ? "dragging" : state}
      onPointerDown={startPointer}
      onPointerMove={movePointer}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onLostPointerCapture={endPointer}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Open SyncLiving AI assistant. ${stateLabel}. Use arrow keys to move the mascot.`}
      title="Ask SyncLiving AI · Drag to move · Use arrow keys to reposition"
    >
      <span className="ai-mascot__art" aria-hidden="true">
        <img className="ai-mascot__body" src={currentFrame} alt="" draggable="false" />
        {isWinking && (
          <span className="ai-mascot__wink-overlay">
            <span className="ai-mascot__screen" />
            <img className="ai-mascot__eyes" src={faceFrame} alt="" draggable="false" />
          </span>
        )}
        {faceFrame && !isWinking && <img className="ai-mascot__face" src={faceFrame} alt="" draggable="false" />}
      </span>
    </button>
  )
}
