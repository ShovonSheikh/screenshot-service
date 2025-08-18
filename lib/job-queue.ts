import { validateUrl, sanitizeScreenshotParams } from "./security"
import { cacheManager } from "./cache-manager"
import puppeteer from "puppeteer"
import chromium from "@sparticuz/chromium"

export interface ScreenshotJob {
  id: string
  status: "pending" | "processing" | "completed" | "failed"
  params: {
    url: string
    fullPage: boolean
    width: number
    height: number
    format: "png" | "jpeg" | "webp" | "avif" | "bmp"
    delay: number
  }
  result?: {
    data: string // base64 encoded image
    format: string
    timestamp: string
    fromCache: boolean // Add cache indicator
  }
  error?: string
  createdAt: number
  completedAt?: number
}

class JobQueue {
  private jobs = new Map<string, ScreenshotJob>()
  private processingQueue: string[] = []
  private isProcessing = false

  constructor() {
    // Clean up completed jobs older than 1 hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000)
  }

  private cleanup() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.completedAt && job.completedAt < oneHourAgo) {
        this.jobs.delete(jobId)
      }
    }
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  createJob(params: any): { jobId: string; error?: string } {
    // Validate URL
    const urlValidation = validateUrl(params.url)
    if (!urlValidation.valid) {
      return { jobId: "", error: urlValidation.error }
    }

    // Sanitize parameters
    const sanitizedParams = sanitizeScreenshotParams(params)

    if (!sanitizedParams.url) {
      return { jobId: "", error: "URL is required" }
    }

    const jobId = this.generateJobId()
    const job: ScreenshotJob = {
      id: jobId,
      status: "pending",
      params: sanitizedParams,
      createdAt: Date.now(),
    }

    this.jobs.set(jobId, job)
    this.processingQueue.push(jobId)

    console.log(`[JobQueue] Created job ${jobId}, total jobs: ${this.jobs.size}`)

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue()
    }

    return { jobId }
  }

  getJob(jobId: string): ScreenshotJob | null {
    const job = this.jobs.get(jobId)
    console.log(`[JobQueue] getJob(${jobId}): ${job ? 'found' : 'not found'}`)
    if (job) {
      console.log(`[JobQueue] Job ${jobId} status: ${job.status}, completedAt: ${job.completedAt}`)
    }
    return job || null
  }

  private async processQueue() {
    if (this.isProcessing) return
    this.isProcessing = true

    console.log(`[JobQueue] Starting to process queue, jobs in queue: ${this.processingQueue.length}`)

    while (this.processingQueue.length > 0) {
      const jobId = this.processingQueue.shift()
      if (!jobId) continue

      const job = this.jobs.get(jobId)
      if (!job) {
        console.warn(`[JobQueue] Job ${jobId} not found in jobs map`)
        continue
      }

      try {
        job.status = "processing"
        this.jobs.set(jobId, job)

        console.log(`[JobQueue] Processing job ${jobId} for URL: ${job.params.url}`)

        let screenshot = await cacheManager.get(job.params.url, job.params)
        let fromCache = false

        if (screenshot) {
          console.log(`[JobQueue] Using cached screenshot for job ${jobId}`)
          fromCache = true
        } else {
          console.log(`[JobQueue] Generating new screenshot for job ${jobId}`)
          
          // Add retry logic for screenshot capture
          let retryCount = 0
          const maxRetries = 2
          
          while (retryCount <= maxRetries) {
            try {
              screenshot = await this.captureScreenshot(job.params)
              break
            } catch (error) {
              retryCount++
              console.warn(`[JobQueue] Screenshot attempt ${retryCount} failed for job ${jobId}:`, error)
              
              if (retryCount > maxRetries) {
                throw error
              }
              
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          }

          // Store in cache for future use
          if (screenshot) {
            await cacheManager.set(job.params.url, job.params, screenshot)
          }
        }

        if (!screenshot) {
          throw new Error("Failed to capture screenshot")
        }

        const base64Screenshot = Buffer.from(screenshot).toString("base64")

        job.status = "completed"
        job.result = {
          data: `data:image/${job.params.format};base64,${base64Screenshot}`,
          format: job.params.format,
          timestamp: new Date().toISOString(),
          fromCache, // Add cache indicator
        }
        job.completedAt = Date.now()

        console.log(`[JobQueue] Completed job ${jobId} ${fromCache ? "(from cache)" : "(newly generated)"}`)
      } catch (error) {
        console.error(`[JobQueue] Failed job ${jobId}:`, error)
        job.status = "failed"
        job.error = error instanceof Error ? error.message : "Unknown error occurred"
        job.completedAt = Date.now()
      }

      this.jobs.set(jobId, job)
    }

    this.isProcessing = false
  }

  private async captureScreenshot(params: ScreenshotJob["params"]): Promise<Buffer> {
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

      // Set viewport if not full page
      if (!params.fullPage) {
        await page.setViewport({
          width: params.width,
          height: params.height,
        })
      }

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
      // Note: Puppeteer only supports 'png' and 'jpeg' natively
      // For other formats, we capture as PNG and let the frontend handle conversion
      let screenshotType: "png" | "jpeg" = "png"
      if (params.format === "jpeg") {
        screenshotType = "jpeg"
      }
      
      const screenshot = await page.screenshot({
        type: screenshotType,
        fullPage: params.fullPage,
        quality: params.format === "jpeg" ? 90 : undefined,
      })

      await page.close()
      return Buffer.from(screenshot)
    } finally {
      await browser.close()
    }
  }

  getAllJobs(): ScreenshotJob[] {
    const jobs = Array.from(this.jobs.values())
    console.log(`[JobQueue] getAllJobs(): ${jobs.length} jobs found`)
    jobs.forEach(job => {
      console.log(`[JobQueue] Job ${job.id}: status=${job.status}, createdAt=${job.createdAt}, completedAt=${job.completedAt}`)
    })
    return jobs
  }

  getQueueStats() {
    const pending = Array.from(this.jobs.values()).filter((job) => job.status === "pending").length
    const processing = Array.from(this.jobs.values()).filter((job) => job.status === "processing").length
    const completed = Array.from(this.jobs.values()).filter((job) => job.status === "completed").length
    const failed = Array.from(this.jobs.values()).filter((job) => job.status === "failed").length

    return {
      total: this.jobs.size,
      pending,
      processing,
      completed,
      failed,
      isProcessing: this.isProcessing,
    }
  }
}

export const jobQueue = new JobQueue()
