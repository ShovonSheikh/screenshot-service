interface RateLimitEntry {
  count: number
  resetTime: number
}

class RateLimiter {
  private requests = new Map<string, RateLimitEntry>()
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(maxRequests = 10, windowMs = 60000) {
    // 10 requests per minute by default
    this.maxRequests = maxRequests
    this.windowMs = windowMs

    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key)
      }
    }
  }

  private getClientIP(request: Request): string {
    // Try to get real IP from headers (for production behind proxies)
    const forwarded = request.headers.get("x-forwarded-for")
    const realIP = request.headers.get("x-real-ip")
    const cfConnectingIP = request.headers.get("cf-connecting-ip")

    if (cfConnectingIP) return cfConnectingIP
    if (realIP) return realIP
    if (forwarded) return forwarded.split(",")[0].trim()

    // Fallback to a default identifier
    return "unknown"
  }

  checkLimit(request: Request): { allowed: boolean; remaining: number; resetTime: number } {
    const clientIP = this.getClientIP(request)
    const now = Date.now()
    const entry = this.requests.get(clientIP)

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      const resetTime = now + this.windowMs
      this.requests.set(clientIP, { count: 1, resetTime })
      return { allowed: true, remaining: this.maxRequests - 1, resetTime }
    }

    if (entry.count >= this.maxRequests) {
      // Rate limit exceeded
      return { allowed: false, remaining: 0, resetTime: entry.resetTime }
    }

    // Increment count
    entry.count++
    this.requests.set(clientIP, entry)
    return { allowed: true, remaining: this.maxRequests - entry.count, resetTime: entry.resetTime }
  }
}

export const rateLimiter = new RateLimiter(10, 60000) // 10 requests per minute
