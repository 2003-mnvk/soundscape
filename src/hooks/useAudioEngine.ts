import { useEffect, useState, useSyncExternalStore } from 'react'
import { AudioEngine } from '../audio/AudioEngine'

export function useAudioEngine() {
  // Construction is inert. Only the toolbar click can open a context or request input.
  const [engine] = useState(() => new AudioEngine())
  const state = useSyncExternalStore(engine.subscribe, engine.getState)

  useEffect(() => () => { void engine.stop() }, [engine])

  return { engine, ...state }
}
