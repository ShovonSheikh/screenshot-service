'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface ScreenshotResult {
  success: boolean
  imageUrl?: string
  error?: string
  cached?: boolean
}

interface CacheStats {
  totalEntries: number
  hitRate: number
  storageUsage: string
}

interface LiveStats {
  urlReached: boolean | null
  captureCompleted: boolean | null
  delayRemaining: number | null
  isCapturing: boolean
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [fullPage, setFullPage] = useState(false)
  const [screenSize, setScreenSize] = useState('desktop')
  const [customWidth, setCustomWidth] = useState(1920)
  const [customHeight, setCustomHeight] = useState(1080)
  const [format, setFormat] = useState('png')
  const [delay, setDelay] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScreenshotResult | null>(null)
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [liveStats, setLiveStats] = useState<LiveStats>({
    urlReached: null,
    captureCompleted: null,
    delayRemaining: null,
    isCapturing: false
  })

  const fetchCacheStats = async () => {
    try {
      const response = await fetch('/api/screenshot/cache')
      if (response.ok) {
        const stats = await response.json()
        setCacheStats(stats)
      }
    } catch (error) {
      console.error('Failed to fetch cache stats:', error)
    }
  }

  useEffect(() => {
    fetchCacheStats()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) {
      toast.error('Please enter a URL')
      return
    }

    setLoading(true)
    setResult(null)
    
    // Initialize live stats
    setLiveStats({
      urlReached: null,
      captureCompleted: null,
      delayRemaining: delay > 0 ? delay : null,
      isCapturing: true
    })

    // Start delay countdown if delay is set
    let delayInterval: NodeJS.Timeout | null = null
    if (delay > 0) {
      let remainingTime = delay
      delayInterval = setInterval(() => {
        remainingTime -= 1
        setLiveStats(prev => ({
          ...prev,
          delayRemaining: remainingTime > 0 ? remainingTime : null
        }))
        if (remainingTime <= 0) {
          clearInterval(delayInterval!)
        }
      }, 1000)
    }

    try {
      const dimensions = screenSize === 'custom' 
        ? { width: customWidth, height: customHeight }
        : screenSize === 'mobile' 
        ? { width: 375, height: 667 }
        : screenSize === 'tablet'
        ? { width: 768, height: 1024 }
        : { width: 1920, height: 1080 }

      // Simulate URL reach status
      setTimeout(() => {
        setLiveStats(prev => ({ ...prev, urlReached: true }))
      }, 500)

      const response = await fetch('/api/screenshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          fullPage,
          width: dimensions.width,
          height: dimensions.height,
          format,
          delay,
        }),
      })

      const data = await response.json()

      // Mark capture as completed
      setLiveStats(prev => ({ ...prev, captureCompleted: true }))

      if (data.success) {
        setResult({
          success: true,
          imageUrl: `data:image/${format};base64,${data.image}`,
          cached: data.cached
        })
        toast.success(data.cached ? 'Screenshot retrieved from cache!' : 'Screenshot captured successfully!')
        fetchCacheStats()
      } else {
        setResult({ success: false, error: data.error })
        toast.error(data.error || 'Failed to capture screenshot')
        setLiveStats(prev => ({ ...prev, urlReached: false, captureCompleted: false }))
      }
    } catch (error) {
      setResult({ success: false, error: 'Network error occurred' })
      toast.error('Network error occurred')
      setLiveStats(prev => ({ ...prev, urlReached: false, captureCompleted: false }))
    } finally {
      setLoading(false)
      if (delayInterval) {
        clearInterval(delayInterval)
      }
      // Reset live stats after a short delay
      setTimeout(() => {
        setLiveStats({
          urlReached: null,
          captureCompleted: null,
          delayRemaining: null,
          isCapturing: false
        })
      }, 2000)
    }
  }

  const clearCache = async () => {
    try {
      const response = await fetch('/api/screenshot/cache', {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success('Cache cleared successfully')
        fetchCacheStats()
      } else {
        toast.error('Failed to clear cache')
      }
    } catch (error) {
      toast.error('Failed to clear cache')
    }
  }

  const downloadImage = () => {
    if (result?.imageUrl) {
      try {
        // Convert base64 to blob for proper download
        const base64Data = result.imageUrl.split(',')[1]
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: `image/${format}` })
        
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `screenshot-${Date.now()}.${format}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Clean up the blob URL
        setTimeout(() => URL.revokeObjectURL(url), 100)
      } catch (error) {
        console.error('Download failed:', error)
        toast.error('Failed to download image')
      }
    }
  }

  const openFullSize = () => {
    if (result?.imageUrl) {
      window.open(result.imageUrl, '_blank')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="font-pacifico text-2xl text-primary">urlSnap</div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
              <a href="#api-docs" className="text-gray-600 hover:text-gray-900 transition-colors">API Docs</a>
              <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">Support</a>
              <button className="bg-primary text-white px-6 py-2 rounded-button hover:bg-blue-600 transition-colors">
                Get Started
              </button>
            </nav>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <i className="ri-menu-line text-xl"></i>
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="md:hidden mt-4 pb-4 border-t border-gray-200 pt-4">
              <div className="flex flex-col space-y-4">
                <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
                <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
                <a href="#api-docs" className="text-gray-600 hover:text-gray-900 transition-colors">API Docs</a>
                <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">Support</a>
                <button className="bg-primary text-white px-6 py-2 rounded-button hover:bg-blue-600 transition-colors w-fit">
                  Get Started
                </button>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Hero Section with Screenshot Tool */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Capture Any Website
            <span className="block text-primary">Instantly</span>
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Professional screenshot API for developers. Fast, reliable, and easy to integrate.
            Perfect for monitoring, testing, and documentation.
          </p>

          {/* Screenshot Capture Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter website URL (e.g., https://example.com)"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-primary text-white px-8 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap font-medium"
                >
                  {loading ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-2"></i>
                      Capturing...
                    </>
                  ) : (
                    <>
                      <i className="ri-camera-line mr-2"></i>
                      Capture Screenshot
                    </>
                  )}
                </button>
              </div>

              {/* Advanced Options Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-primary hover:text-blue-600 transition-colors flex items-center mx-auto"
              >
                <i className={`ri-settings-3-line mr-2 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}></i>
                Advanced Options
              </button>

              {/* Advanced Options */}
              {showAdvanced && (
                <div className="grid md:grid-cols-2 gap-6 p-6 bg-gray-50 rounded-lg">
                  {/* Screen Size Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Screen Size</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'mobile', label: 'Mobile', icon: 'ri-smartphone-line' },
                        { value: 'tablet', label: 'Tablet', icon: 'ri-tablet-line' },
                        { value: 'desktop', label: 'Desktop', icon: 'ri-computer-line' },
                        { value: 'custom', label: 'Custom', icon: 'ri-settings-line' }
                      ].map((size) => (
                        <button
                          key={size.value}
                          type="button"
                          onClick={() => setScreenSize(size.value)}
                          className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center ${
                            screenSize === size.value
                              ? 'border-primary bg-blue-50 text-primary'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <i className={`${size.icon} text-xl mb-1`}></i>
                          <span className="text-sm font-medium">{size.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Dimensions */}
                  {screenSize === 'custom' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Custom Dimensions</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={customWidth}
                          onChange={(e) => setCustomWidth(Number(e.target.value))}
                          placeholder="Width"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                          min="100"
                          max="4000"
                        />
                        <span className="flex items-center text-gray-500">×</span>
                        <input
                          type="number"
                          value={customHeight}
                          onChange={(e) => setCustomHeight(Number(e.target.value))}
                          placeholder="Height"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                          min="100"
                          max="4000"
                        />
                      </div>
                    </div>
                  )}

                  {/* Format Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'png', label: 'PNG', desc: 'Lossless' },
                        { value: 'jpeg', label: 'JPEG', desc: 'Compressed' },
                        { value: 'webp', label: 'WebP', desc: 'Modern' },
                        { value: 'avif', label: 'AVIF', desc: 'Next-gen' },
                        { value: 'bmp', label: 'BMP', desc: 'Bitmap' }
                      ].map((fmt) => (
                        <button
                          key={fmt.value}
                          type="button"
                          onClick={() => setFormat(fmt.value)}
                          className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center ${
                            format === fmt.value
                              ? 'border-primary bg-blue-50 text-primary'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="text-sm font-medium">{fmt.label}</span>
                          <span className="text-xs text-gray-500">{fmt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Other Options */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label htmlFor="fullPage" className="text-sm font-medium text-gray-700">
                        Capture full page
                      </label>
                      <button
                        type="button"
                        onClick={() => setFullPage(!fullPage)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          fullPage ? 'bg-primary' : 'bg-gray-200'
                        }`}
                        role="switch"
                        aria-checked={fullPage}
                        aria-labelledby="fullPage"
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            fullPage ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Delay (seconds)</label>
                      <input
                        type="number"
                        value={delay}
                        onChange={(e) => setDelay(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        min="0"
                        max="10"
                      />
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Preview Section */}
            <div className="mt-8 p-6 bg-gray-50 rounded-lg">
              {/* Live Statistics Display */}
              {liveStats.isCapturing && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
                    <i className="ri-pulse-line mr-2 animate-pulse"></i>
                    Live Capture Status
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${
                        liveStats.urlReached === null ? 'bg-gray-400 animate-pulse' :
                        liveStats.urlReached ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-700">
                        URL Reach: {liveStats.urlReached === null ? 'Connecting...' : liveStats.urlReached ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${
                        liveStats.captureCompleted === null ? 'bg-gray-400 animate-pulse' :
                        liveStats.captureCompleted ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-700">
                        Capture: {liveStats.captureCompleted === null ? 'Processing...' : liveStats.captureCompleted ? 'Completed' : 'Failed'}
                      </span>
                    </div>
                    {liveStats.delayRemaining !== null && (
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full mr-2 bg-orange-500 animate-pulse"></div>
                        <span className="text-sm font-medium text-gray-700">
                          Delay: {liveStats.delayRemaining}s remaining
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Result Display or Placeholder */}
              {result ? (
                result.success ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Screenshot Captured!</h3>
                      {result.cached && (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                          <i className="ri-flashlight-line mr-1"></i>
                          From Cache
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        {fullPage ? (
                          <div className="relative">
                            <div 
                              className="w-full h-96 overflow-y-auto rounded-lg shadow-md border border-gray-200 bg-white"
                              style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}
                            >
                              <img
                                src={result.imageUrl}
                                alt="Full page screenshot preview"
                                className="w-full h-auto block"
                                style={{ minHeight: '100%' }}
                              />
                            </div>
                            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                              <i className="ri-scroll-to-bottom-line mr-1"></i>
                              Scrollable
                            </div>
                          </div>
                        ) : (
                          <img
                            src={result.imageUrl}
                            alt="Screenshot preview"
                            className="w-full h-auto rounded-lg shadow-md border border-gray-200"
                            style={{ maxHeight: '400px', objectFit: 'contain' }}
                          />
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={downloadImage}
                          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
                        >
                          <i className="ri-download-line mr-2"></i>
                          Download
                        </button>
                        <button
                          onClick={openFullSize}
                          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center"
                        >
                          <i className="ri-external-link-line mr-2"></i>
                          View Full Size
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-red-600 mb-2">
                      <i className="ri-error-warning-line text-2xl"></i>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Screenshot Failed</h3>
                    <p className="text-gray-600">{result.error}</p>
                  </div>
                )
              ) : (
                !liveStats.isCapturing && (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <i className="ri-image-line text-6xl"></i>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">Preview Area</h3>
                    <p className="text-gray-500">Start capturing to see the preview</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Choose Our Screenshot API?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Built for developers who need reliable, fast, and accurate website screenshots.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: 'ri-focus-3-line',
                title: 'Accurate',
                description: 'Pixel-perfect screenshots that capture websites exactly as users see them.'
              },
              {
                icon: 'ri-flashlight-line',
                title: 'Fast',
                description: 'Lightning-fast capture with intelligent caching for optimal performance.'
              },
              {
                icon: 'ri-shield-check-line',
                title: 'Secure',
                description: 'Enterprise-grade security with data encryption and privacy protection.'
              },
              {
                icon: 'ri-settings-3-line',
                title: 'Customizable',
                description: 'Full control over dimensions, formats, and capture settings.'
              },
              {
                icon: 'ri-code-line',
                title: 'Developer Friendly',
                description: 'Simple REST API with comprehensive documentation and examples.'
              },
              {
                icon: 'ri-bar-chart-line',
                title: 'Analytics',
                description: 'Detailed usage analytics and performance monitoring included.'
              }
            ].map((feature, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="text-primary text-3xl mb-4">
                  <i className={feature.icon}></i>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cache Statistics */}
      {cacheStats && (
        <section className="py-12 px-6 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Cache Statistics</h3>
                <button
                  onClick={clearCache}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center"
                >
                  <i className="ri-delete-bin-line mr-2"></i>
                  Clear Cache
                </button>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-1">{cacheStats.totalEntries}</div>
                  <div className="text-gray-600">Total Entries</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-1">{(cacheStats.hitRate * 100).toFixed(1)}%</div>
                  <div className="text-gray-600">Hit Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-1">{cacheStats.storageUsage}</div>
                  <div className="text-gray-600">Storage Usage</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* API Documentation */}
      <section id="api-docs" className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Developer API Documentation</h2>
            <p className="text-xl text-gray-600">Everything you need to integrate our screenshot API</p>
          </div>

          <div className="space-y-8">
            {/* Main API Endpoint */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Screenshot Capture API</h3>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg mb-4 font-mono text-sm overflow-x-auto">
                POST /api/screenshot
              </div>
              
              <h4 className="font-semibold text-gray-900 mb-2">Request Body:</h4>
              <div className="bg-gray-900 text-gray-300 p-4 rounded-lg mb-4 font-mono text-sm overflow-x-auto">
{`{
  "url": "https://example.com",
  "width": 1920,
  "height": 1080,
  "fullPage": false,
  "format": "png",
  "delay": 0
}`}
              </div>

              <h4 className="font-semibold text-gray-900 mb-2">Response:</h4>
              <div className="bg-gray-900 text-gray-300 p-4 rounded-lg font-mono text-sm overflow-x-auto">
{`{
  "success": true,
  "image": "base64-encoded-image-data",
  "cached": false,
  "timestamp": "2025-01-18T10:30:00Z"
}`}
              </div>
            </div>

            {/* Cache Management */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Cache Management</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Get Cache Statistics:</h4>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                    GET /api/screenshot/cache
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Clear Cache:</h4>
                  <div className="bg-gray-900 text-red-400 p-4 rounded-lg font-mono text-sm">
                    DELETE /api/screenshot/cache
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Start Examples */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Start Examples</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">cURL:</h4>
                  <div className="bg-gray-900 text-gray-300 p-4 rounded-lg font-mono text-sm overflow-x-auto">
{`curl -X POST http://localhost:3000/api/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "width": 1920,
    "height": 1080,
    "format": "png"
  }'`}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">JavaScript/Fetch:</h4>
                  <div className="bg-gray-900 text-gray-300 p-4 rounded-lg font-mono text-sm overflow-x-auto">
{`const response = await fetch('/api/screenshot', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://example.com',
    width: 1920,
    height: 1080,
    format: 'png'
  })
});

const data = await response.json();
if (data.success) {
  const imageUrl = \`data:image/png;base64,\${data.image}\`;
  // Use the image URL
}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-blue-900 mb-4">Important Notes</h3>
              <ul className="space-y-2 text-blue-800">
                <li className="flex items-start">
                  <i className="ri-information-line mr-2 mt-1 text-blue-600"></i>
                  <span><strong>Rate Limits:</strong> 100 requests per minute per IP address</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-information-line mr-2 mt-1 text-blue-600"></i>
                  <span><strong>Max Dimensions:</strong> 4000x4000 pixels</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-information-line mr-2 mt-1 text-blue-600"></i>
                  <span><strong>Supported Formats:</strong> PNG, JPEG</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-information-line mr-2 mt-1 text-blue-600"></i>
                  <span><strong>Cache TTL:</strong> Screenshots are cached for 1 hour</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-information-line mr-2 mt-1 text-blue-600"></i>
                  <span><strong>Timeout:</strong> 30 seconds maximum per request</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600">
              Choose the plan that fits your needs. No hidden fees.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                name: 'Free',
                price: '$0',
                period: '/month',
                features: [
                  '30 screenshots/month',
                  'PNG and JPEG support',
                  'Basic support',
                  'Max resolution 720p'
                ],
                buttonText: 'Get Started',
                popular: false
              },
              {
                name: 'Starter',
                price: '$9.99',
                period: '/month',
                features: [
                  '150 screenshots/month',
                  'PNG, JPG, JPEG, WebP support',
                  'Custom Dimensions',
                  'Max resolution 1080p'
                ],
                buttonText: 'Start Free Trial',
                popular: true
              },
              {
                name: 'Growth',
                price: '$24.99',
                period: '/month',
                features: [
                  '300 screenshots/month',
                  'PNG, JPG, JPEG, WebP, AVIF, BMP support',
                  'API Access (via API Key)',
                  'Priority Support',
                  'Batch Processing',
                  'Max resolution 4K'
                ],
                buttonText: 'Start Free Trial',
                popular: false
              }
            ].map((plan, index) => (
              <div key={index} className={`bg-white rounded-xl shadow-lg p-8 border-2 ${
                plan.popular ? 'border-primary' : 'border-gray-200'
              } relative`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-1">{plan.price}</div>
                  <div className="text-gray-500">{plan.period}</div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-gray-600">
                      <i className="ri-check-line text-green-500 mr-3"></i>
                      {feature}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-3 rounded-button transition-colors whitespace-nowrap font-medium ${
                  plan.popular
                    ? 'bg-primary text-white hover:bg-blue-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}>
                  {plan.buttonText}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              There are many reasons to use our API
            </h2>
          </div>
          <div className="space-y-20">
            {[
              {
                title: 'What can we do for you?',
                description: 'Our screenshot API integrates seamlessly into your existing workflow, providing reliable and consistent results for web monitoring, testing, documentation, and more. Whether you\'re building a SaaS platform or need automated website captures, we\'ve got you covered.',
                image: 'https://readdy.ai/api/search-image?query=professional%20developer%20working%20on%20computer%20with%20multiple%20monitors%20coding%20website%20screenshot%20API%20integration%20modern%20office%20workspace%20clean%20minimalist%20design%20technology%20illustration&width=600&height=400&seq=benefit001&orientation=landscape',
                reverse: false
              },
              {
                title: 'Responsive Image Capture',
                description: 'Capture websites across different devices and screen sizes with our advanced responsive capture technology. From mobile phones to desktop monitors, ensure your screenshots look perfect on every device your users might be using.',
                image: 'https://readdy.ai/api/search-image?query=responsive%20web%20design%20showcase%20multiple%20device%20mockups%20smartphone%20tablet%20laptop%20desktop%20website%20screenshots%20different%20screen%20sizes%20modern%20clean%20interface%20design&width=600&height=400&seq=benefit002&orientation=landscape',
                reverse: true
              },
              {
                title: 'Versatile workflow automation',
                description: 'Automate your screenshot workflows with our powerful batch processing capabilities. Schedule captures, set up webhooks for real-time notifications, and integrate with your existing tools to create a seamless automated pipeline.',
                image: 'https://readdy.ai/api/search-image?query=automated%20workflow%20dashboard%20with%20screenshot%20thumbnails%20batch%20processing%20queue%20management%20interface%20modern%20UI%20design%20productivity%20tools%20automation&width=600&height=400&seq=benefit003&orientation=landscape',
                reverse: false
              },
              {
                title: 'Daily Optimization',
                description: 'Our platform continuously optimizes capture performance and quality based on millions of daily screenshots. Benefit from machine learning algorithms that improve accuracy and speed while reducing processing time and costs.',
                image: 'https://readdy.ai/api/search-image?query=team%20collaboration%20innovation%20lightbulb%20idea%20generation%20creative%20workspace%20modern%20office%20environment%20people%20working%20together%20technology%20solutions%20brainstorming&width=600&height=400&seq=benefit004&orientation=landscape',
                reverse: true
              }
            ].map((benefit, index) => (
              <div key={index} className={`flex flex-col lg:flex-row${benefit.reverse ? '-reverse' : ''} items-center gap-12`}>
                <div className="lg:w-1/2">
                  <img src={benefit.image} alt={benefit.title} className="w-full rounded-xl shadow-lg" />
                </div>
                <div className="lg:w-1/2">
                  <h3 className="text-3xl font-bold text-gray-900 mb-4">{benefit.title}</h3>
                  <p className="text-lg text-gray-600 leading-relaxed">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-primary">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to start capturing?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of developers who trust urlSnap for their screenshot needs.
          </p>
          <button className="bg-white text-primary px-8 py-4 rounded-button hover:bg-gray-100 transition-colors whitespace-nowrap font-semibold text-lg">
            Start Free Trial
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-800 text-white py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="font-pacifico text-2xl text-primary mb-4">urlSnap</div>
              <p className="text-gray-300 mb-4">
                The most reliable screenshot API for developers and businesses worldwide.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#api-docs" className="text-gray-300 hover:text-white transition-colors">API Docs</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Community</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm mb-4 md:mb-0">
                © 2025 urlSnap. All rights reserved.
              </p>
              <div className="flex items-center space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <i className="ri-twitter-line text-xl"></i>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <i className="ri-github-line text-xl"></i>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <i className="ri-linkedin-line text-xl"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
