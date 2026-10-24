import { Router } from "express";
import { noStore } from "../middleware/no-store";
import { adminRouter } from "./admin.routes";
import { healthRouter } from "./health.routes";
import { notesRouter } from "./notes.routes";
import { youtubeRouter } from "./youtube.routes";
import { projectsRouter } from "./projects.routes";
import { clipsRouter } from "./clips.routes";
import { autoEditRouter } from "./auto-edit.routes";
import { renderRouter } from "./render.routes";
import { notificationsRouter } from "./notifications.routes";
import { accountRouter } from "./account.routes";
import { presetsRouter } from "./presets.routes";
import { downloadRouter } from "./download.routes";
import { videoRouter } from "./video.routes";
import { cloneStyleRouter } from "./clone-style.routes";
import { resetRouter } from "./reset.routes";
import { pipelineRouter } from "./pipeline.routes";
import { processVideoRouter } from "./process-video.routes";
import { settingsRouter } from "./settings.routes";

// Mounted at /api. Add a router per resource and register it here.
export const apiRouter = Router();

apiRouter.use(noStore);
apiRouter.use("/health", healthRouter);
apiRouter.use("/notes", notesRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/youtube", youtubeRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/clips", clipsRouter);
apiRouter.use("/auto-edit", autoEditRouter);
apiRouter.use("/render", renderRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/account", accountRouter);
apiRouter.use("/users", accountRouter);
apiRouter.use("/quotas", accountRouter);
apiRouter.use("/presets", presetsRouter);
apiRouter.use("/download", downloadRouter);
apiRouter.use("/video", videoRouter);
apiRouter.use("/clone-style", cloneStyleRouter);
apiRouter.use("/reset", resetRouter);
apiRouter.use("/pipeline", pipelineRouter);
apiRouter.use("/process-video", processVideoRouter);
apiRouter.use("/render-direct-upload", processVideoRouter);
apiRouter.use("/settings", settingsRouter);



