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

    try {
      const dimensions = screenSize === 'custom' 
        ? { width: customWidth, height: customHeight }
        : screenSize === 'mobile' 
        ? { width: 375, height: 667 }
        : screenSize === 'tablet'
        ? { width: 768, height: 1024 }
        : { width: 1920, height: 1080 }

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
      }
    } catch (error) {
      setResult({ success: false, error: 'Network error occurred' })
      toast.error('Network error occurred')
    } finally {
      setLoading(false)
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
      const link = document.createElement('a')
      link.href = result.imageUrl
      link.download = `screenshot-${Date.now()}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
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
                    <div className="flex gap-2">
                      {['png', 'jpeg'].map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setFormat(fmt)}
                          className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                            format === fmt
                              ? 'border-primary bg-blue-50 text-primary'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Other Options */}
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="fullPage"
                        checked={fullPage}
                        onChange={(e) => setFullPage(e.target.checked)}
                        className="mr-2 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor="fullPage" className="text-sm text-gray-700">Capture full page</label>
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

            {/* Result Display */}
            {result && (
              <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                {result.success ? (
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
                      <img
                        src={result.imageUrl}
                        alt="Screenshot preview"
                        className="max-w-full h-auto rounded-lg shadow-md"
                        style={{ maxHeight: '300px' }}
                      />
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
                )}
              </div>
            )}
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

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose the plan that fits your needs. All plans include our core features.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                name: 'Free',
                price: '$0',
                period: '/month',
                features: ['100 screenshots/month', 'Basic support', 'Standard quality', 'Public API access'],
                popular: false
              },
              {
                name: 'Starter',
                price: '$19',
                period: '/month',
                features: ['5,000 screenshots/month', 'Email support', 'HD quality', 'Custom dimensions', 'Cache optimization'],
                popular: false
              },
              {
                name: 'Professional',
                price: '$49',
                period: '/month',
                features: ['25,000 screenshots/month', 'Priority support', '4K quality', 'Advanced options', 'Analytics dashboard', 'Custom branding'],
                popular: true
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                period: '',
                features: ['Unlimited screenshots', '24/7 phone support', 'Ultra HD quality', 'Custom integrations', 'SLA guarantee', 'Dedicated account manager'],
                popular: false
              }
            ].map((plan, index) => (
              <div key={index} className={`bg-white rounded-xl border-2 p-6 relative ${
                plan.popular ? 'border-primary shadow-lg' : 'border-gray-200'
              }`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="text-3xl font-bold text-gray-900">
                    {plan.price}
                    <span className="text-lg font-normal text-gray-600">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-gray-600">
                      <i className="ri-check-line text-green-500 mr-2"></i>
                      {feature}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-3 rounded-lg font-medium transition-colors ${
                  plan.popular
                    ? 'bg-primary text-white hover:bg-blue-600'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}>
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Built for Modern Development
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Our screenshot API is designed with developers in mind, offering the reliability and performance you need for production applications.
              </p>
              <div className="space-y-6">
                {[
                  {
                    icon: 'ri-rocket-line',
                    title: 'Lightning Fast',
                    description: 'Average response time under 2 seconds with global CDN distribution.'
                  },
                  {
                    icon: 'ri-shield-check-line',
                    title: '99.9% Uptime',
                    description: 'Enterprise-grade infrastructure with automatic failover and monitoring.'
                  },
                  {
                    icon: 'ri-code-s-slash-line',
                    title: 'Easy Integration',
                    description: 'Simple REST API with SDKs for popular programming languages.'
                  }
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start">
                    <div className="text-primary text-2xl mr-4 mt-1">
                      <i className={benefit.icon}></i>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{benefit.title}</h3>
                      <p className="text-gray-600">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="bg-gray-900 rounded-lg p-4 text-green-400 font-mono text-sm">
                <div className="mb-2">$ curl -X POST https://api.urlsnap.com/screenshot \</div>
                <div className="mb-2 ml-4">-H "Content-Type: application/json" \</div>
                <div className="mb-2 ml-4">-d '&#123;&quot;url&quot;: &quot;https://example.com&quot;&#125;'</div>
                <div className="mt-4 text-gray-400"># Response</div>
                <div className="text-blue-400">{
                  <>
                    <div className="ml-2">"success": true,</div>
                    <div className="ml-2">"image": "base64_encoded_image",</div>
                    <div className="ml-2">"cached": false</div>
                  </>
                }</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-primary">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of developers who trust our screenshot API for their applications.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-primary px-8 py-3 rounded-lg hover:bg-gray-100 transition-colors font-medium">
              Start Free Trial
            </button>
            <button className="border-2 border-white text-white px-8 py-3 rounded-lg hover:bg-white hover:text-primary transition-colors font-medium">
              View Documentation
            </button>
          </div>
        </div>
      </section>

      {/* API Documentation */}
      <section id="api-docs" className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">API Documentation</h2>
            <p className="text-xl text-gray-600">Complete guide to integrating our screenshot API</p>
          </div>

          <div className="space-y-8">
            {/* Main Screenshot API */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Screenshot Capture</h3>
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <code className="text-green-400">POST /api/screenshot</code>
              </div>
              
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Request Body:</h4>
              <div className="bg-white rounded-lg p-4 mb-4 border">
                <pre className="text-sm text-gray-700">
{`{
  "url": "https://example.com",
  "width": 1920,
  "height": 1080,
  "fullPage": false,
  "format": "png",
  "delay": 0
}`}
                </pre>
              </div>

              <h4 className="text-lg font-semibold text-gray-900 mb-2">Response:</h4>
              <div className="bg-white rounded-lg p-4 border">
                <pre className="text-sm text-gray-700">
{`{
  "success": true,
  "image": "base64_encoded_image_data",
  "cached": false,
  "timestamp": "2024-01-15T10:30:00Z"
}`}
                </pre>
              </div>
            </div>

            {/* Cache Management API */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Cache Management</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="bg-gray-900 rounded-lg p-4 mb-2">
                    <code className="text-blue-400">GET /api/screenshot/cache</code>
                  </div>
                  <p className="text-gray-600 mb-4">Get cache statistics including total entries, hit rate, and storage usage.</p>
                </div>

                <div>
                  <div className="bg-gray-900 rounded-lg p-4 mb-2">
                    <code className="text-red-400">DELETE /api/screenshot/cache</code>
                  </div>
                  <p className="text-gray-600">Clear all cached screenshots and reset statistics.</p>
                </div>
              </div>
            </div>

            {/* Quick Start Examples */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Quick Start Examples</h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">cURL</h4>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <pre className="text-sm text-green-400">
{`curl -X POST http://localhost:3000/api/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "width": 1920,
    "height": 1080,
    "format": "png"
  }'`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">JavaScript (Fetch)</h4>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <pre className="text-sm text-blue-400">
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
  // Use the image URL as needed
}`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-blue-900 mb-4">Important Notes</h3>
              <ul className="space-y-2 text-blue-800">
                <li className="flex items-start">
                  <i className="ri-information-line mr-2 mt-0.5"></i>
                  <span><strong>Rate Limiting:</strong> API requests are limited to prevent abuse. Current limit: 100 requests per minute.</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-information-line mr-2 mt-0.5"></i>
                  <span><strong>Maximum Dimensions:</strong> Screenshots are limited to 4000x4000 pixels for performance reasons.</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-information-line mr-2 mt-0.5"></i>
                  <span><strong>Supported Formats:</strong> PNG and JPEG formats are supported. PNG is recommended for better quality.</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-information-line mr-2 mt-0.5"></i>
                  <span><strong>Cache TTL:</strong> Screenshots are cached for 1 hour to improve performance and reduce server load.</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-information-line mr-2 mt-0.5"></i>
                  <span><strong>Timeout:</strong> Screenshot capture will timeout after 30 seconds to prevent hanging requests.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="font-pacifico text-2xl text-primary mb-4">urlSnap</div>
              <p className="text-gray-400 mb-4">
                Professional screenshot API for developers. Fast, reliable, and easy to integrate.
              </p>
              <div className="flex space-x-4">
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
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#api-docs" className="text-gray-400 hover:text-white transition-colors">API Docs</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Technical</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Status Page</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Changelog</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Rate Limits</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">SDKs</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 urlSnap. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}