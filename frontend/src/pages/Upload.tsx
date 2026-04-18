import { FileDropzone } from '@/components/upload/FileDropzone'
import { Header } from '@/components/Header'

export function Upload() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Vizify
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Transform your data into beautiful, actionable business dashboards in seconds.
            Upload any file and let AI generate insights.
          </p>
        </div>

        {/* Upload Component */}
        <div className="bg-white rounded-xl shadow-lg p-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-8 text-center">
            Get Started
          </h2>
          <FileDropzone />
        </div>

        {/* Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Multiple Formats</h3>
            <p className="text-gray-600">CSV, Excel, Word, PDF, JSON - we support them all</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">⚡</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Instant Analysis</h3>
            <p className="text-gray-600">AI-powered insights generated in seconds</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">📥</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Easy Export</h3>
            <p className="text-gray-600">Download as PNG, PDF, or share via link</p>
          </div>
        </div>
      </div>
    </div>
  )
}
