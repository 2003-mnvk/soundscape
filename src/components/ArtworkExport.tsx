import { Camera, Download } from 'lucide-react'
import { useRef, useState } from 'react'
import { downloadArtwork } from '../visualizers/pngExport'
import type { PngScale } from '../visualizers/pngExport'

interface ArtworkExportProps {
  disabled: boolean
  modeId: string
  capture: (scale: PngScale) => Promise<Blob>
}

export function ArtworkExport({ disabled, modeId, capture }: ArtworkExportProps) {
  const [open, setOpen] = useState(false)
  const [scale, setScale] = useState<PngScale>(1)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const inProgress = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)

  async function exportPng() {
    if (inProgress.current || disabled) return
    inProgress.current = true
    setBusy(true)
    setMessage('Rendering PNG…')
    try {
      const png = await capture(scale)
      downloadArtwork(png, modeId, scale)
      setMessage('PNG download requested.')
    } catch {
      setMessage('Could not export the PNG. Try 1× or resize the window.')
    } finally {
      inProgress.current = false
      setBusy(false)
    }
  }

  return (
    <div
      className="export-control"
      onKeyDown={(event) => {
        if (!open || event.key !== 'Escape') return
        event.preventDefault()
        setOpen(false)
        trigger.current?.focus()
      }}
    >
      <button
        ref={trigger}
        className="settings-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="artwork-export-options"
        onClick={() => setOpen(!open)}
      >
        <Camera size={17} aria-hidden="true" /> Capture
      </button>
      <div id="artwork-export-options" className="export-panel" hidden={!open}>
        <label htmlFor="png-scale">PNG resolution</label>
        <div className="export-actions">
          <select id="png-scale" value={scale} disabled={busy} onChange={(event) => setScale(event.target.value === '2' ? 2 : 1)}>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
          <button className="export-download" type="button" onClick={() => { void exportPng() }} disabled={disabled} aria-disabled={busy || undefined}>
            <Download size={15} aria-hidden="true" /> Download PNG
          </button>
        </div>
        <p role="status">{message || (disabled ? 'Artwork is unavailable.' : '')}</p>
      </div>
    </div>
  )
}
