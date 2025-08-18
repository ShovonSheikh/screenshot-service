import { type NextRequest, NextResponse } from "next/server"
import puppeteer from "puppeteer"
import chromium from "@sparticuz/chromium"
import { rateLimiter } from "@/lib/rate-limiter"
import { validateUrl, sanitizeScreenshotParams, getSecurityHeaders } from "@/lib/security"
import { cacheManager } from "@/lib/cache-manager"

interface ScreenshotParams {
  url: string
  fullPage?: boolean
  width?: number
  height?: number
  format?: "png" | "jpeg" | "webp" | "avif" | "bmp"
  delay?: number
}

function parseScreenshotParams(searchParams: URLSearchParams): ScreenshotParams {
  const url = searchParams.get("url") || ""
  const fullPage = searchParams.get("fullPage") === "1" || searchParams.get("fullPage") === "true"
  const width = Math.min(Math.max(Number.parseInt(searchParams.get("width") || "1280"), 320), 3840)
  const height = Math.min(Math.max(Number.parseInt(searchParams.get("height") || "800"), 240), 2160)
  const formatParam = searchParams.get("format") || "png"
  const format = (["png", "jpeg", "webp", "avif", "bmp"].includes(formatParam) ? formatParam : "png") as "png" | "jpeg" | "webp" | "avif" | "bmp"
  const delay = Math.min(Math.max(Number.parseFloat(searchParams.get("delay") || "0"), 0), 10)

  return { url, fullPage, width, height, format, delay }
}

async function captureScreenshot(params: ReturnType<typeof sanitizeScreenshotParams>): Promise<Buffer> {
  // Configure for serverless environment (Vercel) vs local development
  const isProduction = process.env.NODE_ENV === 'production'
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: isProduction 
      ? await chromium.executablePath() 
      : process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: isProduction 
      ? chromium.args.concat([
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ])
      : [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--no-zygote",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
  })

  try {
    const page = await browser.newPage()
    
    // Add error handlers to prevent frame detachment issues
    page.on('error', (error) => {
      console.warn('Page error:', error)
    })
    
    page.on('pageerror', (error) => {
      console.warn('Page error:', error)
    })
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.warn('Console error:', msg.text())
      }
    })

    // Always set viewport to ensure proper rendering dimensions
    // This affects how the page renders even for full page screenshots
    await page.setViewport({
      width: params.width,
      height: params.height,
    })

    // Set user agent to avoid bot detection
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    )

    // Set additional headers to avoid detection
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    })

    // Navigate to the URL with timeout
    try {
      await page.goto(params.url, {
        waitUntil: "networkidle2", // Changed from networkidle0 for better reliability
        timeout: 30000,
      })
    } catch (navigationError) {
      console.error("Navigation error:", navigationError)
      // Try with a simpler wait condition if networkidle2 fails
      await page.goto(params.url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      })
    }

    // Wait for additional delay if specified
    if (params.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, params.delay * 1000))
    }

    // Additional wait for page stability
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second for any dynamic content
    } catch (error) {
      console.warn("Additional wait failed:", error)
    }

    // Take screenshot
    let screenshotType: "png" | "jpeg" = "png"
    if (params.format === "jpeg") {
      screenshotType = "jpeg"
    }
    
    const screenshot = await page.screenshot({
      type: screenshotType,
      fullPage: params.fullPage,
      quality: params.format === "jpeg" ? 90 : undefined,
    })
    
    // Note: For WebP, AVIF, and BMP formats, we capture as PNG and let the frontend handle conversion
    // This is because Puppeteer natively only supports PNG and JPEG formats

    await page.close()
    return Buffer.from(screenshot)
  } finally {
    await browser.close()
  }
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimiter.checkLimit(request)

    if (!rateLimitResult.allowed) {
      const resetDate = new Date(rateLimitResult.resetTime).toISOString()
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          resetTime: resetDate,
          remaining: rateLimitResult.remaining,
        },
        {
          status: 429,
          headers: {
            ...getSecurityHeaders(),
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
            "Retry-After": Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        },
      )
    }

    const { searchParams } = new URL(request.url)
    const rawParams = parseScreenshotParams(searchParams)

    const params = sanitizeScreenshotParams(rawParams)

    // Validate required parameters
    if (!params.url) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400, headers: getSecurityHeaders() })
    }

    // Enhanced URL validation
    const urlValidation = validateUrl(params.url)
    if (!urlValidation.valid) {
      return NextResponse.json({ error: urlValidation.error }, { status: 400, headers: getSecurityHeaders() })
    }

    let screenshot = await cacheManager.get(params.url, params)
    let fromCache = false

    if (screenshot) {
      console.log(`[API] Using cached screenshot for URL: ${params.url}`)
      fromCache = true
    } else {
      console.log(`[API] Generating new screenshot for URL: ${params.url}`)
      screenshot = await captureScreenshot(params)

      // Store in cache for future use
      if (screenshot) {
        await cacheManager.set(params.url, params, screenshot)
      }
    }

    if (!screenshot) {
      throw new Error("Failed to capture screenshot")
    }

    // Return the screenshot as a response
    return new NextResponse(new Uint8Array(screenshot), {
      status: 200,
      headers: {
        "Content-Type": `image/${params.format}`,
        "Content-Disposition": `inline; filename="screenshot.${params.format}"`,
      },
    })
  } catch (error) {
    console.error("Screenshot error:", error)

    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        return NextResponse.json(
          { error: "Request timeout. The page took too long to load." },
          { status: 408, headers: getSecurityHeaders() },
        )
      }
      if (error.message.includes("net::ERR_NAME_NOT_RESOLVED")) {
        return NextResponse.json(
          { error: "Unable to resolve the provided URL." },
          { status: 400, headers: getSecurityHeaders() },
        )
      }
    }

    return NextResponse.json(
      { error: "Failed to capture screenshot. Please try again." },
      { status: 500, headers: getSecurityHeaders() },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = rateLimiter.checkLimit(request)

    if (!rateLimitResult.allowed) {
      const resetDate = new Date(rateLimitResult.resetTime).toISOString()
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          resetTime: resetDate,
          remaining: rateLimitResult.remaining,
        },
        {
          status: 429,
          headers: {
            ...getSecurityHeaders(),
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
            "Retry-After": Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        },
      )
    }

    const body = await request.json()

    const params = sanitizeScreenshotParams(body)

    // Validate required parameters
    if (!params.url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400, headers: getSecurityHeaders() })
    }

    // Enhanced URL validation
    const urlValidation = validateUrl(params.url)
    if (!urlValidation.valid) {
      return NextResponse.json({ error: urlValidation.error }, { status: 400, headers: getSecurityHeaders() })
    }

    let screenshot = await cacheManager.get(params.url, params)
    let fromCache = false

    if (screenshot) {
      console.log(`[API] Using cached screenshot for URL: ${params.url}`)
      fromCache = true
    } else {
      console.log(`[API] Generating new screenshot for URL: ${params.url}`)
      screenshot = await captureScreenshot(params)

      // Store in cache for future use
      if (screenshot) {
        await cacheManager.set(params.url, params, screenshot)
      }
    }

    if (!screenshot) {
      throw new Error("Failed to capture screenshot")
    }

    // Convert buffer to base64 for JSON response
    const base64Screenshot = Buffer.from(screenshot).toString("base64")

    return NextResponse.json(
      {
        success: true,
        image: base64Screenshot,
        format: params.format,
        timestamp: new Date().toISOString(),
        fromCache, // Add cache indicator
      },
      {
        headers: {
          ...getSecurityHeaders(),
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
          "X-Cache": fromCache ? "HIT" : "MISS", // Add cache status header
        },
      },
    )
  } catch (error) {
    console.error("Screenshot error:", error)

    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        return NextResponse.json(
          { error: "Request timeout. The page took too long to load." },
          { status: 408, headers: getSecurityHeaders() },
        )
      }
      if (error.message.includes("net::ERR_NAME_NOT_RESOLVED")) {
        return NextResponse.json(
          { error: "Unable to resolve the provided URL." },
          { status: 400, headers: getSecurityHeaders() },
        )
      }
    }

    return NextResponse.json(
      { error: "Failed to capture screenshot. Please try again." },
      { status: 500, headers: getSecurityHeaders() },
    )
  }
}
