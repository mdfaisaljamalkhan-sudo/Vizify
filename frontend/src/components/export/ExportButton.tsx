import { useState } from 'react'
import { Download, Share2, Presentation, Loader2 } from 'lucide-react'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import { apiClient } from '@/api/client'
import { useDashboardStore } from '@/store/dashboardStore'

interface ExportButtonProps {
  dashboardRef: React.RefObject<HTMLDivElement | null>
  fileName: string
}

async function captureElement(el: HTMLElement): Promise<string> {
  // html-to-image handles oklch colors and SVGs natively — no style cloning needed
  return toPng(el, {
    quality: 1,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    // Ensure fonts are embedded
    fetchRequestInit: { cache: 'no-cache' },
    filter: (node) => {
      // Skip hidden elements that could skew dimensions
      if (node instanceof HTMLElement && node.style.display === 'none') return false
      return true
    },
  })
}

export function ExportButton({ dashboardRef, fileName }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportingWhat, setExportingWhat] = useState<'png' | 'pdf' | 'pptx' | null>(null)
  const dashboard = useDashboardStore((s) => s.dashboard)

  const exportPNG = async () => {
    if (!dashboardRef.current) return
    setIsExporting(true)
    setExportingWhat('png')
    try {
      const dataUrl = await captureElement(dashboardRef.current)
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `${fileName}.png`
      link.click()
    } catch (err) {
      console.error('PNG export failed:', err)
      alert('PNG export failed. Check console for details.')
    } finally {
      setIsExporting(false)
      setExportingWhat(null)
    }
  }

  const exportPDF = async () => {
    if (!dashboardRef.current) return
    setIsExporting(true)
    setExportingWhat('pdf')
    try {
      const dataUrl = await captureElement(dashboardRef.current)

      // Measure actual pixel size from the data URL
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
        img.src = dataUrl
      })

      const imgW = img.naturalWidth / 2    // ÷2 because pixelRatio=2
      const imgH = img.naturalHeight / 2

      // Fit to A4 landscape if wide, portrait if tall
      const a4w = 297, a4h = 210
      const orientation = imgW > imgH ? 'l' : 'p'
      const [pageW, pageH] = orientation === 'l' ? [a4w, a4h] : [a4h, a4w]

      const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
      const scale = Math.min(pageW / imgW, pageH / imgH)
      const drawW = imgW * scale
      const drawH = imgH * scale
      const offsetX = (pageW - drawW) / 2
      const offsetY = (pageH - drawH) / 2

      pdf.addImage(dataUrl, 'PNG', offsetX, offsetY, drawW, drawH)

      // Add extra pages if content overflows
      if (drawH > pageH) {
        let remaining = drawH - pageH
        let pos = pageH
        while (remaining > 0) {
          pdf.addPage()
          pdf.addImage(dataUrl, 'PNG', offsetX, offsetY - pos, drawW, drawH)
          remaining -= pageH
          pos += pageH
        }
      }

      pdf.save(`${fileName}.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('PDF export failed. Check console for details.')
    } finally {
      setIsExporting(false)
      setExportingWhat(null)
    }
  }

  const exportPPTX = async () => {
    if (!dashboard?.id) return
    setIsExporting(true)
    setExportingWhat('pptx')
    try {
      const res = await apiClient.get(`/api/dashboards/${dashboard.id}/export/pptx`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileName}.pptx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PPTX export failed:', err)
      alert('PPTX export failed.')
    } finally {
      setIsExporting(false)
      setExportingWhat(null)
    }
  }

  const btn = (label: string, onClick: () => void, color: string, icon: React.ReactNode, which: string) => (
    <button
      onClick={onClick}
      disabled={isExporting}
      className={`inline-flex items-center gap-2 px-4 py-2 ${color} text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity text-sm`}
    >
      {isExporting && exportingWhat === which
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : icon}
      {isExporting && exportingWhat === which ? `Exporting…` : label}
    </button>
  )

  return (
    <div className="flex gap-2 flex-wrap">
      {btn('PNG', exportPNG, 'bg-blue-600', <Download className="w-4 h-4" />, 'png')}
      {btn('PDF', exportPDF, 'bg-blue-600', <Download className="w-4 h-4" />, 'pdf')}
      {dashboard?.id && btn('PPTX', exportPPTX, 'bg-orange-600', <Presentation className="w-4 h-4" />, 'pptx')}
      <button
        disabled
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm cursor-not-allowed"
        title="Coming soon"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>
    </div>
  )
}
