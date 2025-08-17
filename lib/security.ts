export function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname.toLowerCase()

    // Only allow http and https protocols
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { valid: false, error: "Only HTTP and HTTPS protocols are allowed" }
    }

    // Block local/private IPs and internal networks
    const blockedPatterns = [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "::1",
      // Private IPv4 ranges
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      // Link-local addresses
      /^169\.254\./,
      /^fe80:/,
      // Private IPv6 ranges
      /^fc00:/,
      /^fd00:/,
      // Multicast
      /^224\./,
      /^ff00:/,
    ]

    for (const pattern of blockedPatterns) {
      if (typeof pattern === "string") {
        if (hostname === pattern) {
          return { valid: false, error: "Local and private network addresses are not allowed" }
        }
      } else if (pattern.test(hostname)) {
        return { valid: false, error: "Local and private network addresses are not allowed" }
      }
    }

    // Block suspicious domains
    const suspiciousDomains = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "short.link"]

    if (suspiciousDomains.some((domain) => hostname.includes(domain))) {
      return { valid: false, error: "URL shorteners and suspicious domains are not allowed" }
    }

    // Check for suspicious patterns in URL
    const suspiciousPatterns = [/javascript:/i, /data:/i, /vbscript:/i, /file:/i, /ftp:/i]

    if (suspiciousPatterns.some((pattern) => pattern.test(url))) {
      return { valid: false, error: "Suspicious URL pattern detected" }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: "Invalid URL format" }
  }
}

export function sanitizeScreenshotParams(params: any): {
  url: string
  fullPage: boolean
  width: number
  height: number
  format: "png" | "jpeg" | "webp" | "avif" | "bmp"
  delay: number
} {
  const formatStr = String(params.format).toLowerCase()
  let validFormat: "png" | "jpeg" | "webp" | "avif" | "bmp" = "png"
  
  if (["jpeg", "jpg"].includes(formatStr)) {
    validFormat = "jpeg"
  } else if (formatStr === "webp") {
    validFormat = "webp"
  } else if (formatStr === "avif") {
    validFormat = "avif"
  } else if (formatStr === "bmp") {
    validFormat = "bmp"
  }
  
  return {
    url: String(params.url || "").trim(),
    fullPage: Boolean(params.fullPage),
    width: Math.min(Math.max(Number.parseInt(String(params.width)) || 1280, 320), 3840),
    height: Math.min(Math.max(Number.parseInt(String(params.height)) || 800, 240), 2160),
    format: validFormat,
    delay: Math.min(Math.max(Number.parseFloat(String(params.delay)) || 0, 0), 10),
  }
}

export function getSecurityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
  }
}
