import { useState } from 'react'
import { Download, Share2, Presentation, Loader2, Copy, Check, X } from 'lucide-react'
import jsPDF from 'jspdf'
import { toPng } from 'html-to-image'
import { apiClient } from '@/api/client'
import { useDashboardStore } from '@/store/dashboardStore'

interface ExportButtonProps {
  dashboardRef: React.RefObject<HTMLDivElement | null>
  fileName: string
}

// ─── Colour resolution ────────────────────────────────────────────────────────
// Tailwind v4 emits oklch() values. html-to-image can't parse them.
// Force the browser to convert any colour to rgb() before we use it.
const _colourCache = new Map<string, string>()
function resolveColor(raw: string): string {
  if (!raw || raw === 'transparent' || raw === 'rgba(0, 0, 0, 0)') return raw
  if (_colourCache.has(raw)) return _colourCache.get(raw)!
  // No conversion needed for rgb/rgba
  if (raw.startsWith('rgb')) { _colourCache.set(raw, raw); return raw }
  const el = document.createElement('div')
  el.style.cssText = `position:fixed;opacity:0;pointer-events:none;color:${raw}`
  document.body.appendChild(el)
  const resolved = getComputedStyle(el).color || raw
  document.body.removeChild(el)
  _colourCache.set(raw, resolved)
  return resolved
}

// ─── Inline every colour-related computed style onto a clone ─────────────────
const COLOR_PROPS = [
  'color', 'background-color', 'border-color',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'fill', 'stroke',
]
const LAYOUT_PROPS = [
  'font-size', 'font-weight', 'font-family', 'line-height', 'text-align',
  'display', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content',
  'gap', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'width', 'height', 'min-height', 'max-width',
  'border-radius', 'border-width', 'border-style', 'opacity', 'box-shadow',
  'position', 'top', 'left', 'right', 'bottom', 'overflow',
]

function inlineStyles(liveRoot: HTMLElement, cloneRoot: HTMLElement) {
  const liveAll = [liveRoot, ...Array.from(liveRoot.querySelectorAll('*'))]
  const cloneAll = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll('*'))]

  liveAll.forEach((live, i) => {
    if (i >= cloneAll.length) return
    if (live instanceof SVGElement) return  // handled via rasterisation
    const clone = cloneAll[i] as HTMLElement
    const cs = window.getComputedStyle(live)

    COLOR_PROPS.forEach(p => {
      const v = cs.getPropertyValue(p)
      if (v) clone.style.setProperty(p, resolveColor(v))
    })
    LAYOUT_PROPS.forEach(p => {
      const v = cs.getPropertyValue(p)
      if (v) clone.style.setProperty(p, v)
    })
    // Strip class names — prevents stylesheet oklch values leaking in
    if (!(clone instanceof SVGElement)) clone.className = ''
  })
}

// ─── SVG → raster PNG data-URL ───────────────────────────────────────────────
function inlineSvgElementStyles(liveEl: Element, cloneEl: Element) {
  const SVG_PROPS = [
    'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity',
    'color', 'font-size', 'font-family', 'font-weight', 'opacity',
    'display', 'visibility', 'text-anchor', 'dominant-baseline',
  ]
  const liveNodes = [liveEl, ...Array.from(liveEl.querySelectorAll('*'))]
  const cloneNodes = [cloneEl, ...Array.from(cloneEl.querySelectorAll('*'))]
  liveNodes.forEach((live, i) => {
    if (i >= cloneNodes.length) return
    const cs = window.getComputedStyle(live)
    const cloneHtml = cloneNodes[i] as HTMLElement
    SVG_PROPS.forEach(p => {
      const v = cs.getPropertyValue(p)
      if (v) {
        try { cloneHtml.style.setProperty(p, resolveColor(v)) } catch { /* skip */ }
      }
    })
    cloneHtml.removeAttribute('class')
  })
}

async function svgToDataUrl(liveSvg: SVGElement): Promise<{ dataUrl: string; rect: DOMRect }> {
  const rect = liveSvg.getBoundingClientRect()
  const w = Math.max(Math.ceil(rect.width), 100)
  const h = Math.max(Math.ceil(rect.height), 100)

  const clone = liveSvg.cloneNode(true) as SVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))
  inlineSvgElementStyles(liveSvg, clone)

  const svgStr = new XMLSerializer().serializeToString(clone)
  const b64 = btoa(unescape(encodeURIComponent(svgStr)))
  const svgDataUrl = `data:image/svg+xml;base64,${b64}`

  return new Promise(resolve => {
    const img = new Image(w, h)
    const canvas = document.createElement('canvas')
    canvas.width = w * 2
    canvas.height = h * 2
    const ctx = canvas.getContext('2d')!
    ctx.scale(2, 2)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h)
      resolve({ dataUrl: canvas.toDataURL('image/png'), rect })
    }
    img.onerror = () => {
      // Fallback: plain white tile — chart still shown as blank space
      resolve({ dataUrl: canvas.toDataURL('image/png'), rect })
    }
    img.src = svgDataUrl
  })
}

// ─── Main capture ─────────────────────────────────────────────────────────────
async function captureToDataUrl(dashboardEl: HTMLElement): Promise<string> {
  // 0. Force light mode so all Tailwind dark: colours become their light counterparts.
  //    This is the only reliable way to ensure readable contrast in exports.
  const html = document.documentElement
  const wasDark = html.classList.contains('dark')
  if (wasDark) html.classList.remove('dark')

  // Give the browser one frame to re-paint light-mode colours before we read
  // computed styles for the clone.
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

  try {
    return await _capture(dashboardEl)
  } finally {
    if (wasDark) html.classList.add('dark')
  }
}

async function _capture(dashboardEl: HTMLElement): Promise<string> {
  // 1. Rasterise all live SVG charts (now in light-mode colours)
  const liveSvgs = Array.from(dashboardEl.querySelectorAll('svg')) as SVGElement[]
  const rasterised = await Promise.all(liveSvgs.map(svgToDataUrl))

  // 2. Clone and inline all computed + resolved styles
  const clone = dashboardEl.cloneNode(true) as HTMLElement
  inlineStyles(dashboardEl, clone)

  // 3. Replace every cloned SVG with the rasterised <img>
  const clonedSvgs = Array.from(clone.querySelectorAll('svg')) as SVGElement[]
  rasterised.forEach(({ dataUrl, rect }, i) => {
    if (i >= clonedSvgs.length) return
    const img = document.createElement('img')
    img.src = dataUrl
    img.style.cssText = `display:block;width:${rect.width}px;height:${rect.height}px;`
    clonedSvgs[i].parentNode?.replaceChild(img, clonedSvgs[i])
  })

  // 4. Mount clone off-screen with exact dashboard width
  const container = document.createElement('div')
  container.style.cssText = `
    position:fixed;left:-99999px;top:0;
    width:${dashboardEl.scrollWidth}px;
    background:#ffffff;
  `
  container.appendChild(clone)
  document.body.appendChild(container)

  // 5. Wait for all rasterised images to load
  const imgs = Array.from(clone.querySelectorAll('img'))
  await Promise.all(imgs.map(img =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); setTimeout(r, 2000) })
  ))

  // 6. Capture with html-to-image — now NO oklch values remain, NO SVGs remain
  try {
    return await toPng(clone, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      width: dashboardEl.scrollWidth,
      height: clone.scrollHeight,
      cacheBust: true,
    })
  } finally {
    document.body.removeChild(container)
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ExportButton({ dashboardRef, fileName }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportingWhat, setExportingWhat] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const dashboard = useDashboardStore((s) => s.dashboard)

  const handleShare = async () => {
    if (!dashboard?.id) return
    setSharing(true)
    try {
      const res = await apiClient.post(`/api/dashboards/${dashboard.id}/share`)
      const token = res.data.share_token
      const url = `${window.location.origin}/shared/${token}`
      setShareUrl(url)
    } catch (e) {
      console.error('Share failed', e)
    } finally {
      setSharing(false)
    }
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleUnshare = async () => {
    if (!dashboard?.id) return
    await apiClient.post(`/api/dashboards/${dashboard.id}/unshare`).catch(() => {})
    setShareUrl(null)
  }

  const run = async (label: string, fn: () => Promise<void>) => {
    setIsExporting(true)
    setExportingWhat(label)
    try { await fn() }
    catch (err) {
      console.error(`${label} export failed:`, err)
      alert(`${label} export failed — see browser console for details.`)
    } finally {
      setIsExporting(false)
      setExportingWhat(null)
    }
  }

  const exportPNG = () => run('PNG', async () => {
    if (!dashboardRef.current) return
    const dataUrl = await captureToDataUrl(dashboardRef.current)
    const a = document.createElement('a')
    a.href = dataUrl; a.download = `${fileName}.png`; a.click()
  })

  const exportPDF = () => run('PDF', async () => {
    if (!dashboardRef.current) return
    const dataUrl = await captureToDataUrl(dashboardRef.current)

    const img = new Image()
    await new Promise<void>(r => { img.onload = () => r(); img.src = dataUrl })
    const imgW = img.naturalWidth / 2    // ÷2 because pixelRatio=2
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

    // Paginate if taller than one page
    let remaining = dh - pageH, pos = pageH
    while (remaining > 0) {
      pdf.addPage()
      pdf.addImage(dataUrl, 'PNG', ox, oy - pos, dw, dh)
      remaining -= pageH; pos += pageH
    }
    pdf.save(`${fileName}.pdf`)
  })

  const exportPPTX = () => run('PPTX', async () => {
    if (!dashboard?.id) return
    const res = await apiClient.get(`/api/dashboards/${dashboard.id}/export/pptx`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url; a.download = `${fileName}.pptx`; a.click()
    URL.revokeObjectURL(url)
  })

  const Btn = ({
    label, onClick, extraClass = 'bg-blue-600',
    icon = <Download className="w-4 h-4" />,
  }: { label: string; onClick: () => void; extraClass?: string; icon?: React.ReactNode }) => (
    <button
      onClick={onClick} disabled={isExporting}
      className={`inline-flex items-center gap-2 px-4 py-2 ${extraClass} text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity text-sm`}
    >
      {isExporting && exportingWhat === label
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : icon}
      {isExporting && exportingWhat === label ? 'Exporting…' : label}
    </button>
  )

  return (
    <div className="flex gap-2 flex-wrap">
      <Btn label="PNG" onClick={exportPNG} />
      <Btn label="PDF" onClick={exportPDF} />
      {dashboard?.id && (
        <Btn label="PPTX" onClick={exportPPTX} extraClass="bg-orange-600"
          icon={<Presentation className="w-4 h-4" />} />
      )}
      {dashboard?.id && (
        <button
          onClick={handleShare}
          disabled={sharing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
        >
          {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          Share
        </button>
      )}

      {/* Share URL modal */}
      {shareUrl && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShareUrl(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Share Dashboard</h3>
              <button onClick={() => setShareUrl(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Anyone with this link can view the dashboard live and add comments.
            </p>
            <div className="flex gap-2 mb-4">
              <input
                readOnly value={shareUrl}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white select-all"
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">Link is active until you stop sharing</span>
              <button onClick={handleUnshare} className="text-xs text-red-500 hover:text-red-700 underline">
                Stop sharing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
