import { useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { useThemeStore } from '@/store/themeStore'

interface ExportButtonProps {
  dashboardRef: React.RefObject<HTMLDivElement | null>
  fileName: string
}

function cloneAndInlineStyles(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement

  const walk = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      if (node.nodeType === Node.TEXT_NODE) return
      for (let child of Array.from(node.childNodes)) walk(child)
      return
    }

    const el = node as HTMLElement
    const computed = window.getComputedStyle(el)

    // Copy critical computed styles to inline
    const stylesToCopy = [
      'backgroundColor', 'color', 'borderColor', 'borderWidth', 'borderStyle',
      'fontSize', 'fontWeight', 'fontFamily', 'padding', 'margin', 'display',
      'width', 'height', 'minHeight', 'position', 'justifyContent', 'alignItems',
      'flexDirection', 'gap', 'borderRadius', 'boxShadow', 'opacity', 'textAlign'
    ]

    stylesToCopy.forEach(prop => {
      const value = computed.getPropertyValue(prop)
      if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
        try {
          el.style[prop as any] = value
        } catch (e) {
          // ignore setter errors
        }
      }
    })

    // Remove classes to prevent oklch() issues (skip SVG elements)
    if (!(el instanceof SVGElement)) {
      el.className = ''
    } else {
      el.removeAttribute('class')
    }

    for (let child of Array.from(node.childNodes)) walk(child)
  }

  walk(clone)
  return clone
}

export function ExportButton({ dashboardRef, fileName }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const { isDark } = useThemeStore()

  const exportPNG = async () => {
    if (!dashboardRef.current) return

    setIsExporting(true)
    try {
      console.log('Starting PNG export...')

      // Clone element and inline all computed styles
      const clonedElement = cloneAndInlineStyles(dashboardRef.current)
      const tempContainer = document.createElement('div')
      tempContainer.style.position = 'fixed'
      tempContainer.style.left = '0'
      tempContainer.style.top = '0'
      tempContainer.style.zIndex = '-9999'
      tempContainer.style.visibility = 'hidden'
      tempContainer.appendChild(clonedElement)
      document.body.appendChild(tempContainer)

      try {
        const canvas = await html2canvas(clonedElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: true,
          foreignObjectRendering: false,
        })

        canvas.toBlob((blob) => {
          if (!blob) {
            console.error('Failed to create blob')
            return
          }
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `${fileName}.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
          console.log('PNG exported successfully')
        }, 'image/png')
      } finally {
        document.body.removeChild(tempContainer)
      }
    } catch (error) {
      console.error('PNG export failed:', error)
      alert('Failed to export PNG: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setIsExporting(false)
    }
  }

  const exportPDF = async () => {
    if (!dashboardRef.current) return

    setIsExporting(true)
    try {
      console.log('Starting PDF export...')

      // Clone element and inline all computed styles
      const clonedElement = cloneAndInlineStyles(dashboardRef.current)
      const tempContainer = document.createElement('div')
      tempContainer.style.position = 'fixed'
      tempContainer.style.left = '0'
      tempContainer.style.top = '0'
      tempContainer.style.zIndex = '-9999'
      tempContainer.style.visibility = 'hidden'
      tempContainer.appendChild(clonedElement)
      document.body.appendChild(tempContainer)

      try {
        const canvas = await html2canvas(clonedElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: true,
          foreignObjectRendering: false,
        })

        const imgData = canvas.toDataURL('image/png')
        const pdf = new jsPDF('p', 'mm', 'a4')

        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width
        const pageHeight = pdf.internal.pageSize.getHeight()

        // Add first page
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)

        // Add remaining pages if needed
        let heightLeft = pdfHeight - pageHeight
        let position = pageHeight

        while (heightLeft > 0) {
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, -position, pdfWidth, pdfHeight)
          heightLeft -= pageHeight
          position += pageHeight
        }

        // Use blob instead of direct save
        const blob = pdf.output('blob')
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${fileName}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        console.log('PDF exported successfully')
      } finally {
        document.body.removeChild(tempContainer)
      }
    } catch (error) {
      console.error('PDF export failed:', error)
      alert('Failed to export PDF: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={exportPNG}
        disabled={isExporting}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        <Download className="w-4 h-4" />
        PNG
      </button>
      <button
        onClick={exportPDF}
        disabled={isExporting}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        <Download className="w-4 h-4" />
        PDF
      </button>
      <button
        disabled
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-600 rounded-lg disabled:opacity-50 cursor-not-allowed"
        title="Share feature coming soon"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>
    </div>
  )
}
