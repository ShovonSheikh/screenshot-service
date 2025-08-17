import { createHash } from "crypto"
import { promises as fs } from "fs"
import path from "path"
import os from "os"

interface CacheEntry {
  key: string
  filePath: string
  metadata: {
    url: string
    params: any
    format: string
    createdAt: number
    lastAccessed: number
    size: number
  }
}

class CacheManager {
  private cache = new Map<string, CacheEntry>()
  private cacheDir: string
  private maxCacheSize: number // in bytes
  private maxCacheAge: number // in milliseconds

  constructor(cacheDir?: string, maxCacheSize = 100 * 1024 * 1024, maxCacheAge = 24 * 60 * 60 * 1000) {
    // Use OS-appropriate temp directory if not specified
    this.cacheDir = cacheDir || path.join(os.tmpdir(), "screenshot-service-cache")
    this.maxCacheSize = maxCacheSize // 100MB default
    this.maxCacheAge = maxCacheAge // 24 hours default

    this.ensureCacheDir()

    // Clean up cache every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000)
  }

  private async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
      console.log(`[Cache] Cache directory initialized: ${this.cacheDir}`)
    } catch (error) {
      console.error("Failed to create cache directory:", error)
      // Fallback to a different directory if the first one fails
      try {
        this.cacheDir = path.join(process.cwd(), ".cache", "screenshots")
        await fs.mkdir(this.cacheDir, { recursive: true })
        console.log(`[Cache] Using fallback cache directory: ${this.cacheDir}`)
      } catch (fallbackError) {
        console.error("Failed to create fallback cache directory:", fallbackError)
      }
    }
  }

  private generateCacheKey(url: string, params: any): string {
    const normalizedParams = {
      url: url.toLowerCase().trim(),
      fullPage: Boolean(params.fullPage),
      width: params.fullPage ? 0 : Number(params.width) || 1280,
      height: params.fullPage ? 0 : Number(params.height) || 800,
      format: String(params.format).toLowerCase() || "png",
      delay: Number(params.delay) || 0,
    }

    const hash = createHash("sha256")
    hash.update(JSON.stringify(normalizedParams))
    return hash.digest("hex")
  }

  private getFilePath(key: string, format: string): string {
    return path.join(this.cacheDir, `${key}.${format}`)
  }

  async get(url: string, params: any): Promise<Buffer | null> {
    const key = this.generateCacheKey(url, params)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if cache entry is expired
    const now = Date.now()
    if (now - entry.metadata.createdAt > this.maxCacheAge) {
      await this.delete(key)
      return null
    }

    try {
      // Update last accessed time
      entry.metadata.lastAccessed = now
      this.cache.set(key, entry)

      // Read file from disk
      const buffer = await fs.readFile(entry.filePath)
      console.log(`[Cache] Hit for key: ${key}`)
      return buffer
    } catch (error) {
      console.error(`[Cache] Failed to read cached file: ${entry.filePath}`, error)
      await this.delete(key)
      return null
    }
  }

  async set(url: string, params: any, buffer: Buffer): Promise<void> {
    const key = this.generateCacheKey(url, params)
    const format = String(params.format).toLowerCase() || "png"
    const filePath = this.getFilePath(key, format)

    try {
      // Write file to disk
      await fs.writeFile(filePath, buffer)

      // Get file stats
      const stats = await fs.stat(filePath)

      // Create cache entry
      const entry: CacheEntry = {
        key,
        filePath,
        metadata: {
          url,
          params,
          format,
          createdAt: Date.now(),
          lastAccessed: Date.now(),
          size: stats.size,
        },
      }

      this.cache.set(key, entry)
      console.log(`[Cache] Stored key: ${key}, size: ${stats.size} bytes`)

      // Check if we need to cleanup due to size limits
      await this.enforceSize()
    } catch (error) {
      console.error(`[Cache] Failed to store cache entry: ${key}`, error)
    }
  }

  private async delete(key: string): Promise<void> {
    const entry = this.cache.get(key)
    if (!entry) return

    try {
      await fs.unlink(entry.filePath)
      this.cache.delete(key)
      console.log(`[Cache] Deleted key: ${key}`)
    } catch (error) {
      console.error(`[Cache] Failed to delete cache entry: ${key}`, error)
      // Remove from memory cache even if file deletion failed
      this.cache.delete(key)
    }
  }

  private async cleanup(): Promise<void> {
    const now = Date.now()
    const expiredKeys: string[] = []

    // Find expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.metadata.createdAt > this.maxCacheAge) {
        expiredKeys.push(key)
      }
    }

    // Delete expired entries
    for (const key of expiredKeys) {
      await this.delete(key)
    }

    console.log(`[Cache] Cleanup completed. Removed ${expiredKeys.length} expired entries.`)
  }

  private async enforceSize(): Promise<void> {
    const totalSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.metadata.size, 0)

    if (totalSize <= this.maxCacheSize) {
      return
    }

    console.log(`[Cache] Size limit exceeded (${totalSize} bytes). Starting cleanup...`)

    // Sort entries by last accessed time (oldest first)
    const entries = Array.from(this.cache.values()).sort((a, b) => a.metadata.lastAccessed - b.metadata.lastAccessed)

    let currentSize = totalSize
    let deletedCount = 0

    // Delete oldest entries until we're under the size limit
    for (const entry of entries) {
      if (currentSize <= this.maxCacheSize * 0.8) {
        // Stop when we're at 80% of max size to avoid frequent cleanups
        break
      }

      await this.delete(entry.key)
      currentSize -= entry.metadata.size
      deletedCount++
    }

    console.log(`[Cache] Size enforcement completed. Removed ${deletedCount} entries.`)
  }

  getStats() {
    const entries = Array.from(this.cache.values())
    const totalSize = entries.reduce((sum, entry) => sum + entry.metadata.size, 0)
    const now = Date.now()

    return {
      totalEntries: entries.length,
      totalSize,
      maxSize: this.maxCacheSize,
      maxAge: this.maxCacheAge,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map((e) => e.metadata.createdAt)) : null,
      newestEntry: entries.length > 0 ? Math.max(...entries.map((e) => e.metadata.createdAt)) : null,
      hitRate: this.calculateHitRate(),
    }
  }

  private calculateHitRate(): number {
    // This is a simplified hit rate calculation
    // In a production system, you'd want to track hits/misses more accurately
    return this.cache.size > 0 ? 0.75 : 0 // Placeholder value
  }

  async clear(): Promise<void> {
    const keys = Array.from(this.cache.keys())
    for (const key of keys) {
      await this.delete(key)
    }
    console.log(`[Cache] Cleared all ${keys.length} entries.`)
  }
}

// Create a global cache instance that persists across Next.js hot reloads in development
const globalForCache = globalThis as unknown as {
  cacheManager: CacheManager | undefined
}

export const cacheManager = globalForCache.cacheManager ?? new CacheManager()

if (process.env.NODE_ENV !== 'production') {
  globalForCache.cacheManager = cacheManager
}
