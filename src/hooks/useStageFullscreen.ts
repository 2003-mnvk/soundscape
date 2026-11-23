import { useEffect, useRef, useState } from 'react'

export function useStageFullscreen() {
  const stageRef = useRef<HTMLElement>(null)
  const exitRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pending = useRef(false)
  const focusedStage = useRef(false)
  const [mode, setMode] = useState<'windowed' | 'native' | 'immersive'>('windowed')
  const [message, setMessage] = useState('')
  const active = mode !== 'windowed'

  useEffect(() => {
    function sync() {
      const current = document.fullscreenElement
      setMode((previous) => {
        if (current && current === stageRef.current) return 'native'
        return previous === 'native' ? 'windowed' : previous
      })
    }

    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  useEffect(() => {
    if (active) {
      focusedStage.current = true
      exitRef.current?.focus()
    } else if (focusedStage.current) {
      focusedStage.current = false
      triggerRef.current?.focus()
    }
  }, [active])

  async function toggle() {
    const stage = stageRef.current
    if (!stage || pending.current) return
    setMessage('')

    if (mode === 'immersive') {
      setMode('windowed')
      return
    }

    pending.current = true
    try {
      if (document.fullscreenElement === stage) {
        await document.exitFullscreen()
        setMode('windowed')
      } else if (document.fullscreenEnabled && typeof stage.requestFullscreen === 'function') {
        await stage.requestFullscreen()
        if (document.fullscreenElement === stage) setMode('native')
      } else {
        setMode('immersive')
        setMessage('Using immersive view because native fullscreen is unavailable.')
      }
    } catch {
      if (document.fullscreenElement === stage) {
        setMessage('Could not exit fullscreen. Try pressing Escape.')
      } else {
        setMode('immersive')
        setMessage('Using immersive view because native fullscreen is unavailable.')
      }
    } finally {
      pending.current = false
    }
  }

  useEffect(() => {
    if (mode !== 'immersive') return
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMode('windowed')
        setMessage('')
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [mode])

  return { stageRef, triggerRef, exitRef, active, fallback: mode === 'immersive', message, toggle }
}
