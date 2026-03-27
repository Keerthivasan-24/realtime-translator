import React, { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Draggable, resizable subtitle overlay with:
 * - Bilingual stacked view (toggle)
 * - Smooth fade/slide animations
 * - Resize handle (bottom-right corner)
 */
export default function Subtitles({ subtitle, showBilingual }) {
  // Position & size
  const [pos, setPos] = useState({ x: null, y: null }) // null = default centered bottom
  const [size, setSize] = useState({ w: 480, h: null }) // null height = auto
  const [visible, setVisible] = useState(false)
  const [displayed, setDisplayed] = useState(null) // what's actually rendered (for fade-out)

  const boxRef = useRef(null)
  const dragState = useRef(null)   // { startX, startY, origX, origY }
  const resizeState = useRef(null) // { startX, startW }
  const fadeTimer = useRef(null)
  const hideTimer = useRef(null)

  // ── Subtitle lifecycle: fade in on new subtitle, fade out after delay ──────
  useEffect(() => {
    if (subtitle?.translated) {
      clearTimeout(fadeTimer.current)
      clearTimeout(hideTimer.current)
      setDisplayed(subtitle)
      // Small rAF delay so the element is mounted before opacity transitions
      requestAnimationFrame(() => setVisible(true))
      hideTimer.current = setTimeout(() => {
        setVisible(false)
        fadeTimer.current = setTimeout(() => setDisplayed(null), 400) // match transition duration
      }, 4000)
    }
    return () => {
      clearTimeout(fadeTimer.current)
      clearTimeout(hideTimer.current)
    }
  }, [subtitle])

  // ── Drag ──────────────────────────────────────────────────────────────────
  const onDragStart = useCallback((e) => {
    e.preventDefault()
    const box = boxRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
    }

    const onMove = (ev) => {
      const dx = ev.clientX - dragState.current.startX
      const dy = ev.clientY - dragState.current.startY
      setPos({ x: dragState.current.origX + dx, y: dragState.current.origY + dy })
    }
    const onUp = () => {
      dragState.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // ── Resize ────────────────────────────────────────────────────────────────
  const onResizeStart = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const box = boxRef.current
    if (!box) return
    resizeState.current = { startX: e.clientX, startW: box.offsetWidth }

    const onMove = (ev) => {
      const dw = ev.clientX - resizeState.current.startX
      setSize(s => ({ ...s, w: Math.max(200, resizeState.current.startW + dw) }))
    }
    const onUp = () => {
      resizeState.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  if (!displayed) return null

  // Positioned style: default = centered bottom, or user-dragged absolute coords
  const posStyle = pos.x !== null
    ? { position: 'fixed', left: pos.x, top: pos.y, transform: 'none' }
    : { position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)' }

  return (
    <div
      ref={boxRef}
      onMouseDown={onDragStart}
      style={{
        ...posStyle,
        width: size.w,
        zIndex: 50,
        cursor: 'grab',
        userSelect: 'none',
        opacity: visible ? 1 : 0,
        transform: posStyle.transform
          ? `${posStyle.transform} translateY(${visible ? 0 : 8}px)`
          : `translateY(${visible ? 0 : 8}px)`,
        transition: 'opacity 0.35s ease, transform 0.35s ease',
        willChange: 'opacity, transform',
      }}
    >
      {/* Translated line (primary) */}
      <div style={styles.translated}>
        {displayed.translated}
      </div>

      {/* Original line (bilingual mode) */}
      {showBilingual && displayed.original && (
        <div style={styles.original}>
          {displayed.original}
        </div>
      )}

      {/* Resize handle */}
      <div
        onMouseDown={onResizeStart}
        style={styles.resizeHandle}
        title="Drag to resize"
      />
    </div>
  )
}

const styles = {
  translated: {
    fontSize: 18,
    fontWeight: 600,
    color: '#fff',
    background: 'rgba(0,0,0,0.72)',
    padding: '7px 16px',
    borderRadius: '8px 8px 0 0',
    textAlign: 'center',
    lineHeight: 1.4,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  original: {
    fontSize: 13,
    color: '#d1d5db',
    background: 'rgba(0,0,0,0.52)',
    padding: '4px 16px 6px',
    borderRadius: '0 0 8px 8px',
    textAlign: 'center',
    lineHeight: 1.4,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  resizeHandle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    cursor: 'se-resize',
    background: 'transparent',
    // Visual grip dots
    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.35) 1px, transparent 1px)',
    backgroundSize: '4px 4px',
    backgroundPosition: 'bottom right',
    backgroundRepeat: 'no-repeat',
    borderRadius: '0 0 8px 0',
  },
}
