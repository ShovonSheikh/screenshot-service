import { type NextRequest, NextResponse } from "next/server"
import { getSecurityHeaders } from "@/lib/security"
import { cacheManager } from "@/lib/cache-manager"

export async function GET(request: NextRequest) {
  try {
    const stats = cacheManager.getStats()

    return NextResponse.json(
      {
        cache: {
          ...stats,
          totalSizeMB: Math.round((stats.totalSize / (1024 * 1024)) * 100) / 100,
          maxSizeMB: Math.round((stats.maxSize / (1024 * 1024)) * 100) / 100,
          utilizationPercent: Math.round((stats.totalSize / stats.maxSize) * 100),
        },
        timestamp: new Date().toISOString(),
      },
      { headers: getSecurityHeaders() },
    )
  } catch (error) {
    console.error("Cache stats error:", error)
    return NextResponse.json(
      { error: "Failed to get cache statistics." },
      { status: 500, headers: getSecurityHeaders() },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await cacheManager.clear()

    return NextResponse.json(
      {
        success: true,
        message: "Cache cleared successfully.",
        timestamp: new Date().toISOString(),
      },
      { headers: getSecurityHeaders() },
    )
  } catch (error) {
    console.error("Cache clear error:", error)
    return NextResponse.json({ error: "Failed to clear cache." }, { status: 500, headers: getSecurityHeaders() })
  }
}
