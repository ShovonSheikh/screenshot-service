import { type NextRequest, NextResponse } from "next/server"
import { getSecurityHeaders } from "@/lib/security"
import { jobQueue } from "@/lib/job-queue"

export async function GET(request: NextRequest) {
  try {
    const stats = jobQueue.getQueueStats()

    return NextResponse.json(
      {
        queue: stats,
        timestamp: new Date().toISOString(),
      },
      { headers: getSecurityHeaders() },
    )
  } catch (error) {
    console.error("Queue stats error:", error)
    return NextResponse.json(
      { error: "Failed to get queue statistics." },
      { status: 500, headers: getSecurityHeaders() },
    )
  }
}
