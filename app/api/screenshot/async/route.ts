import { type NextRequest, NextResponse } from "next/server"
import { rateLimiter } from "@/lib/rate-limiter"
import { getSecurityHeaders } from "@/lib/security"
import { jobQueue } from "@/lib/job-queue"

export async function POST(request: NextRequest) {
  try {
    // Check rate limit
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

    // Create job
    const result = jobQueue.createJob(body)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400, headers: getSecurityHeaders() })
    }

    return NextResponse.json(
      {
        success: true,
        jobId: result.jobId,
        message: "Screenshot job created successfully. Use the job ID to check status.",
        statusUrl: `/api/screenshot/status/${result.jobId}`,
      },
      {
        headers: {
          ...getSecurityHeaders(),
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
        },
      },
    )
  } catch (error) {
    console.error("Async screenshot error:", error)
    return NextResponse.json(
      { error: "Failed to create screenshot job. Please try again." },
      { status: 500, headers: getSecurityHeaders() },
    )
  }
}
