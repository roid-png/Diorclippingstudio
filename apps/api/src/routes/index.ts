import { Router } from "express";
import { noStore } from "../middleware/no-store";
import { adminRouter } from "./admin.routes";
import { healthRouter } from "./health.routes";
import { notesRouter } from "./notes.routes";
import { youtubeRouter } from "./youtube.routes";
import { projectsRouter } from "./projects.routes";
import { clipsRouter } from "./clips.routes";

// Mounted at /api. Add a router per resource and register it here.
export const apiRouter = Router();

apiRouter.use(noStore);
apiRouter.use("/health", healthRouter);
apiRouter.use("/notes", notesRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/youtube", youtubeRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/clips", clipsRouter);



