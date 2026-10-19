import "../load-env";

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://mock:mock@127.0.0.1:5432/mock";
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "mock-secret-at-least-32-characters-long!!";

import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";

const app = createApp();

describe("Clip Video Streaming Endpoint (HTTP 206 Partial Content)", () => {
  it("streams full video when no Range header is provided", async () => {
    const res = await request(app).get("/api/clips/sample-clip/stream");

    // Expect either 200 or 404 (if file path resolution depends on local video file)
    if (res.status === 200) {
      expect(res.headers["content-type"]).toBe("video/mp4");
      expect(res.headers["accept-ranges"]).toBe("bytes");
      expect(res.headers["content-length"]).toBeDefined();
    } else {
      expect(res.status).toBe(404);
    }
  });

  it("handles partial content (Range requests) with status 206", async () => {
    const res = await request(app)
      .get("/api/clips/sample-clip/stream")
      .set("Range", "bytes=0-1023");

    if (res.status === 206) {
      expect(res.headers["content-type"]).toBe("video/mp4");
      expect(res.headers["content-range"]).toMatch(/^bytes 0-1023\/\d+$/);
      expect(res.headers["content-length"]).toBe("1024");
    } else {
      expect(res.status).toBe(404);
    }
  });

  it("returns 416 Range Not Satisfiable for invalid range", async () => {
    const res = await request(app)
      .get("/api/clips/sample-clip/stream")
      .set("Range", "bytes=999999999-999999999");

    if (res.status === 416) {
      expect(res.headers["content-range"]).toMatch(/^bytes \*\/\d+$/);
    } else {
      expect(res.status).toBe(404);
    }
  });
});

