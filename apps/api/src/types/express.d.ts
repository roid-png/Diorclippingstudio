import type { AuthSession } from "../lib/auth";
import type { renderJobs as RenderJobsTable } from "../db/schema/render-jobs";

declare global {
  namespace Express {
    interface Request {
      // Set by requireAuth after an authoritative Better Auth session lookup.
      auth?: AuthSession;
    }
  }

  const renderJobs: typeof RenderJobsTable;
}

export {};
