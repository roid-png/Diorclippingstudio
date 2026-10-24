import { Router, type Request, type Response } from "express";
import { videoRouter } from "./video.routes";

export const downloadRouter = Router();

// Re-use the HTTP 206 streaming and download handler
downloadRouter.use("/", videoRouter);
