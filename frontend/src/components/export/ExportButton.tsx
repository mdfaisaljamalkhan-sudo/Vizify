import { useState } from 'react'
import { Download, Share2, Presentation, Loader2 } from 'lucide-react'
import jsPDF from 'jspdf'
import { apiClient } from '@/api/client'
import { useDashboardStore } from '@/store/dashboardStore'

interface ExportButtonProps {
  dashboardRef: React.RefObject<HTMLDivElement | null>
  fileName: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Core: inline computed styles onto every element of an SVG clone so that
// serialization preserves colours set via CSS classes.
// ─────────────────────────────────────────────────────────────────────────────
function inlineSvgStyles(liveEl: Element, cloneEl: Element) {
  const SVG_STYLE_PROPS = [
    'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity',
    'font-size', 'font-family', 'font-weight', 'opacity',
    'color', 'display', 'visibility',
  ]
  const liveNodes = [liveEl, ...Array.from(liveEl.querySelectorAll('*'))]
  const cloneNodes = [cloneEl, ...Array.from(cloneEl.querySelectorAll('*'))]

  liveNodes.forEach((live, i) => {
    if (i >= cloneNodes.length) return
    const clone = cloneNodes[i] as HTMLElement
    const cs = window.getComputedStyle(live)
    SVG_STYLE_PROPS.forEach(prop => {
      try {
        const v = cs.getPropertyValue(prop)
        if (v) clone.style.setProperty(prop, v)
      } catch { /* skip */ }
    })
  })
}

// Rasterise one SVG element → PNG data URL via an off-screen <canvas>
async function svgToDataUrl(liveSvg: SVGElement): Promise<string> {
  const rect = liveSvg.getBoundingClientRect()
  const w = Math.ceil(rect.width) || liveSvg.clientWidth || 400
  const h = Math.ceil(rect.height) || liveSvg.clientHeight || 300

  const clone = liveSvg.cloneNode(true) as SVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))
  inlineSvgStyles(liveSvg, clone)

  const svgStr = new XMLSerializer().serializeToString(clone)
  // btoa needs latin1; encode to handle emoji / unicode in axis labels
  const b64 = btoa(unescape(encodeURIComponent(svgStr)))
  const dataUrl = `data:image/svg+xml;base64,${b64}`

  return new Promise((resolve) => {
    const img = new Image(w, h)
    const canvas = document.createElement('canvas')
    canvas.width = w * 2   // 2× for retina sharpness
    canvas.height = h * 2
    const ctx = canvas.getContext('2d')!
    ctx.scale(2, 2)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      // Fallback: white rectangle with label
      ctx.fillStyle = '#f3f4f6'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#6b7280'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Chart', w / 2, h / 2)
      resolve(canvas.toDataURL('image/png'))
    }
    img.src = dataUrl
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Main capture: rasterise all SVG children, paint the whole dashboard to
// a single canvas, return a PNG data URL.
// ─────────────────────────────────────────────────────────────────────────────
async function captureToDataUrl(dashboardEl: HTMLElement): Promise<string> {
  const containerW = dashboardEl.scrollWidth
  const containerH = dashboardEl.scrollHeight

  // 1. Collect bounding rects of every live SVG before cloning
  const liveSvgs = Array.from(dashboardEl.querySelectorAll('svg')) as SVGElement[]
  const rects = liveSvgs.map(s => {
    const r = s.getBoundingClientRect()
    const containerRect = dashboardEl.getBoundingClientRect()
    return {
      x: r.left - containerRect.left,
      y: r.top - containerRect.top,
      w: r.width || s.clientWidth || 400,
      h: r.height || s.clientHeight || 300,
    }
  })

  // 2. Rasterise every SVG (in parallel)
  const chartImages = await Promise.all(liveSvgs.map(s => svgToDataUrl(s)))

  // 3. Draw the container as HTML-snapshot (no SVGs — replaced below)
  //    We use a temporary iframe so we get an accurate pixel snapshot
  const SCALE = 2
  const canvas = document.createElement('canvas')
  canvas.width = containerW * SCALE
  canvas.height = containerH * SCALE
  const ctx = canvas.getContext('2d')!
  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, containerW, containerH)

  // 4. Walk the DOM and paint text/box content via a recursive draw pass
  //    (simplified — we paint background + text, charts drawn below)
  paintBoxes(ctx, dashboardEl, dashboardEl, 0, 0, containerW, containerH)

  // 5. Paint rasterised charts on top
  await Promise.all(
    chartImages.map((dataUrl, i) =>
      new Promise<void>(resolve => {
        const img = new Image()
        img.onload = () => {
          const r = rects[i]
          ctx.drawImage(img, r.x, r.y, r.w, r.h)
          resolve()
        }
        img.onerror = () => resolve()
        img.src = dataUrl
      })
    )
  )

  return canvas.toDataURL('image/png')
}

// Lightweight box/text painter — handles backgrounds and text nodes
function paintBoxes(
  ctx: CanvasRenderingContext2D,
  root: HTMLElement,
  el: Element,
  offsetX: number,
  offsetY: number,
  containerW: number,
  containerH: number,
) {
  if (el instanceof SVGElement) return   // handled separately

  const rootRect = root.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  const x = r.left - rootRect.left
  const y = r.top - rootRect.top
  const w = r.width
  const h = r.height
  if (w <= 0 || h <= 0) return

  const cs = window.getComputedStyle(el)
  const bg = cs.backgroundColor
  if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
    ctx.fillStyle = bg
    const br = parseFloat(cs.borderRadius) || 0
    if (br > 0) {
      roundRect(ctx, x, y, w, h, br)
      ctx.fill()
    } else {
      ctx.fillRect(x, y, w, h)
    }
  }

  // Paint direct text nodes
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim()
      if (!text) continue
      ctx.fillStyle = cs.color || '#000'
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      ctx.textBaseline = 'top'
      // Approximate vertical centre
      ctx.fillText(text, x + 4, y + h * 0.1, w - 8)
    }
  }

  // Recurse
  for (const child of Array.from(el.children)) {
    paintBoxes(ctx, root, child, offsetX, offsetY, containerW, containerH)
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function ExportButton({ dashboardRef, fileName }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportingWhat, setExportingWhat] = useState<string | null>(null)
  const dashboard = useDashboardStore((s) => s.dashboard)

  const withExport = async (label: string, fn: () => Promise<void>) => {
    setIsExporting(true)
    setExportingWhat(label)
    try {
      await fn()
    } catch (err) {
      console.error(`${label} export failed:`, err)
      alert(`${label} export failed — see console for details.`)
    } finally {
      setIsExporting(false)
      setExportingWhat(null)
    }
  }

  const exportPNG = () => withExport('PNG', async () => {
    if (!dashboardRef.current) return
    const dataUrl = await captureToDataUrl(dashboardRef.current)
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${fileName}.png`
    a.click()
  })

  const exportPDF = () => withExport('PDF', async () => {
    if (!dashboardRef.current) return
    const dataUrl = await captureToDataUrl(dashboardRef.current)

    const img = new Image()
    await new Promise<void>(r => { img.onload = () => r(); img.src = dataUrl })
    const imgW = img.naturalWidth / 2
    const imgH = img.naturalHeight / 2

    const orientation = imgW > imgH ? 'l' : 'p'
    const [pageW, pageH]: [number, number] = orientation === 'l' ? [297, 210] : [210, 297]
    const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })

    const scale = Math.min(pageW / imgW, pageH / imgH)
    const dw = imgW * scale
    const dh = imgH * scale
    const ox = (pageW - dw) / 2
    const oy = (pageH - dh) / 2

    pdf.addImage(dataUrl, 'PNG', ox, oy, dw, dh)

    let remaining = dh - pageH
    let pos = pageH
    while (remaining > 0) {
      pdf.addPage()
      pdf.addImage(dataUrl, 'PNG', ox, oy - pos, dw, dh)
      remaining -= pageH
      pos += pageH
    }

    pdf.save(`${fileName}.pdf`)
  })

  const exportPPTX = () => withExport('PPTX', async () => {
    if (!dashboard?.id) return
    const res = await apiClient.get(`/api/dashboards/${dashboard.id}/export/pptx`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}.pptx`
    a.click()
    URL.revokeObjectURL(url)
  })

  const Btn = ({ label, onClick, color }: { label: string; onClick: () => void; color: string }) => (
    <button
      onClick={onClick}
      disabled={isExporting}
      className={`inline-flex items-center gap-2 px-4 py-2 ${color} text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity text-sm`}
    >
      {isExporting && exportingWhat === label
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <Download className="w-4 h-4" />}
      {isExporting && exportingWhat === label ? 'Exporting…' : label}
    </button>
  )

  return (
    <div className="flex gap-2 flex-wrap">
      <Btn label="PNG" onClick={exportPNG} color="bg-blue-600" />
      <Btn label="PDF" onClick={exportPDF} color="bg-blue-600" />
      {dashboard?.id && (
        <button
          onClick={exportPPTX}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 text-sm"
        >
          {isExporting && exportingWhat === 'PPTX'
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Presentation className="w-4 h-4" />}
          {isExporting && exportingWhat === 'PPTX' ? 'Exporting…' : 'PPTX'}
        </button>
      )}
      <button
        disabled
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm cursor-not-allowed"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>
    </div>
  )
}
