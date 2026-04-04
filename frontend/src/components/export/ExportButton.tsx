import { useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface ExportButtonProps {
  dashboardRef: React.RefObject<HTMLDivElement | null>
  fileName: string
}

export function ExportButton({ dashboardRef, fileName }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const exportPNG = async () => {
    if (!dashboardRef.current) return

    setIsExporting(true)
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      })

      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `${fileName}.png`
      link.click()
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const exportPDF = async () => {
    if (!dashboardRef.current) return

    setIsExporting(true)
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width

      let heightLeft = pdfHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight)
      heightLeft -= pdf.internal.pageSize.getHeight()

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight)
        heightLeft -= pdf.internal.pageSize.getHeight()
      }

      pdf.save(`${fileName}.pdf`)
    } catch (error) {
      console.error('Export failed:', error)
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
