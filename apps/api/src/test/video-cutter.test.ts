import "../load-env";

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://mock:mock@127.0.0.1:5432/mock";
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "mock-secret-at-least-32-characters-long!!";

import { describe, expect, it } from "vitest";
import { createProjectSchema } from "@starter/shared/validators/projects";

describe("Video Cutter & Viral Scoring Rules", () => {
  it("validates project creation input with valid YouTube URL and defaults", () => {
    const input = createProjectSchema.parse({
      youtubeUrl: "https://www.youtube.com/watch?v=V0k9u",
      clipDuration: 45,
      maxClips: 10,
    });

    expect(input.youtubeUrl).toBe("https://www.youtube.com/watch?v=V0k9u");
    expect(input.clipDuration).toBe(45);
    expect(input.maxClips).toBe(10);
    expect(input.editStyle).toBe("theo-podcast");
    expect(input.motionGraphicStyle).toBe("theo-infographics");
    expect(input.subtitleStyle).toBe("theo-red-pill");
  });

  it("rejects invalid clip duration not in 30, 45, 60", () => {
    expect(() =>
      createProjectSchema.parse({
        youtubeUrl: "https://www.youtube.com/watch?v=V0k9u",
        clipDuration: 15,
      })
    ).toThrow();
  });

  it("rejects maxClips greater than 10", () => {
    expect(() =>
      createProjectSchema.parse({
        youtubeUrl: "https://www.youtube.com/watch?v=V0k9u",
        maxClips: 20,
      })
    ).toThrow();
  });

  it("rejects maxClips less than 1", () => {
    expect(() =>
      createProjectSchema.parse({
        youtubeUrl: "https://www.youtube.com/watch?v=V0k9u",
        maxClips: 0,
      })
    ).toThrow();
  });
});
