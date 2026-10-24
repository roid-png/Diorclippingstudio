export interface JobProgress {
  jobId: string;
  status: "downloading" | "analyzing" | "rendering" | "completed" | "error";
  step: 1 | 2 | 3;
  stepName: string;
  message: string;
  percent: number;
  currentClipIndex?: number;
  totalClips?: number;
  clipTitle?: string;
  error?: string;
  updatedAt: number;
  result?: any;
}

const jobStore = new Map<string, JobProgress>();

/**
 * Updates or creates a job progress record.
 */
export function updateJobProgress(
  jobId: string | undefined,
  patch: Partial<JobProgress>
): void {
  if (!jobId) return;

  const existing = jobStore.get(jobId) || {
    jobId,
    status: "downloading",
    step: 1,
    stepName: "Unduh Sumber",
    message: "Memulai pemrosesan...",
    percent: 10,
    updatedAt: Date.now(),
  };

  const updated: JobProgress = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  };

  jobStore.set(jobId, updated);
}

/**
 * Retrieves the current real-time progress of a job.
 */
export function getJobProgress(jobId: string): JobProgress | undefined {
  return jobStore.get(jobId);
}

/**
 * Clears a finished or cancelled job from memory.
 */
export function clearJobProgress(jobId: string): void {
  jobStore.delete(jobId);
}

// Auto-cleanup stale jobs older than 1 hour every 15 minutes
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobStore.entries()) {
    if (job.updatedAt < oneHourAgo) {
      jobStore.delete(id);
    }
  }
}, 15 * 60 * 1000);
