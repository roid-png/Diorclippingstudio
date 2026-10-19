import { Router } from "express";
import { validateYouTubeUrlSchema } from "@starter/shared/validators/youtube";
import { jsonBody } from "../middleware/body";
import { validateAndFetchYouTubeMetadata } from "../services/youtube.service";

export const youtubeRouter = Router();

// Validate and fetch metadata via POST (JSON body)
youtubeRouter.post("/validate", jsonBody, async (req, res) => {
  const { url } = validateYouTubeUrlSchema.parse(req.body);
  const metadata = await validateAndFetchYouTubeMetadata(url);
  res.json({ data: metadata });
});

// Validate and fetch metadata via GET (Query param)
youtubeRouter.get("/validate", async (req, res) => {
  const { url } = validateYouTubeUrlSchema.parse({
    url: typeof req.query.url === "string" ? req.query.url : "",
  });
  const metadata = await validateAndFetchYouTubeMetadata(url);
  res.json({ data: metadata });
});

