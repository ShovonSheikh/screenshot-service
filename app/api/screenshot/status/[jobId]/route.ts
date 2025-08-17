import { type NextRequest, NextResponse } from "next/server"
import { getSecurityHeaders } from "@/lib/security"
import { jobQueue } from "@/lib/job-queue"

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400, headers: getSecurityHeaders() })
    }

    console.log(`[Status] Looking for job: ${jobId}`)
    const job = jobQueue.getJob(jobId)
    
    if (!job) {
      console.log(`[Status] Job not found: ${jobId}`)
      // Get all available job IDs for debugging
      const allJobs = jobQueue.getAllJobs()
      console.log(`[Status] Available jobs:`, allJobs.map(j => ({ id: j.id, status: j.status })))
      return NextResponse.json({ error: "Job not found" }, { status: 404, headers: getSecurityHeaders() })
    }

    console.log(`[Status] Found job: ${jobId}, status: ${job.status}`)

    // Return job status without sensitive internal data
    const response = {
      jobId: job.id,
      status: job.status,
      createdAt: new Date(job.createdAt).toISOString(),
      completedAt: job.completedAt ? new Date(job.completedAt).toISOString() : undefined,
      result: job.result,
      error: job.error,
    }

    return NextResponse.json(response, { headers: getSecurityHeaders() })
  } catch (error) {
    console.error("Job status error:", error)
    return NextResponse.json(
      { error: "Failed to get job status. Please try again." },
      { status: 500, headers: getSecurityHeaders() },
    )
  }
}
