import "../load-env";

// Ensure required env vars are present for app initialization in unit test
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://mock:mock@127.0.0.1:5432/mock";
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "mock-secret-at-least-32-characters-long!!";

import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { extractYouTubeVideoId } from "../services/youtube.service";

const app = createApp();

describe("YouTube URL Parser Helper", () => {
  it("extracts ID from standard watch URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=V0k9u")).toBe("V0k9u");
    expect(extractYouTubeVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from youtu.be short URL", () => {
    expect(extractYouTubeVideoId("https://youtu.be/V0k9u")).toBe("V0k9u");
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from shorts URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/shorts/V0k9u")).toBe("V0k9u");
  });

  it("extracts ID from embed URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/embed/V0k9u")).toBe("V0k9u");
  });

  it("returns null for non-YouTube links", () => {
    expect(extractYouTubeVideoId("https://vimeo.com/123456")).toBeNull();
    expect(extractYouTubeVideoId("")).toBeNull();
  });
});

describe("YouTube Validation & Metadata Endpoint", () => {
  it("validates standard YouTube URL via POST and returns metadata", async () => {
    const res = await request(app)
      .post("/api/youtube/validate")
      .send({ url: "https://www.youtube.com/watch?v=V0k9u" });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.videoId).toBe("V0k9u");
    expect(res.body.data.title).toContain("Masterclass Konten Viral");
    expect(res.body.data.channelTitle).toBe("Dior Media Creator Lab");
    expect(res.body.data.isConfirmed).toBe(true);
  });

  it("validates youtu.be short URL via GET and returns metadata", async () => {
    const res = await request(app)
      .get("/api/youtube/validate")
      .query({ url: "https://youtu.be/V0k9u" });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.videoId).toBe("V0k9u");
    expect(res.body.data.isConfirmed).toBe(true);
  });

  it("returns 422 error for invalid non-YouTube URL", async () => {
    const res = await request(app)
      .post("/api/youtube/validate")
      .send({ url: "https://vimeo.com/123456" });

    expect(res.status).toBe(422);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 error for empty URL", async () => {
    const res = await request(app)
      .post("/api/youtube/validate")
      .send({ url: "" });

    expect(res.status).toBe(422);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
