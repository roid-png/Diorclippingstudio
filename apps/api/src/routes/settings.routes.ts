import express, { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { tokenTracker } from "../services/token_tracker";

export const settingsRouter = Router();

settingsRouter.use(express.json());

// List of all recognized Gemini and Groq API key variable names
export const RECOGNIZED_KEY_NAMES = [
  // Gemini Primary
  "GEMINI_API_KEY_TRANSCRIPTION",
  "GEMINI_API_KEY_CURATION",
  "GEMINI_API_KEY_CURATOR",
  "GEMINI_API_KEY_ART_DIRECTOR",
  "GEMINI_API_KEY_STYLE_CLONER",
  "GEMINI_API_KEY",

  // Gemini Backup
  "GEMINI_API_KEY_TRANSCRIPTION_BACKUP",
  "GEMINI_API_KEY_CURATION_BACKUP",
  "GEMINI_API_KEY_CURATOR_BACKUP",
  "GEMINI_API_KEY_ART_DIRECTOR_BACKUP",
  "GEMINI_API_KEY_STYLE_CLONER_BACKUP",
  "GEMINI_API_KEY_BACKUP",

  // Groq
  "GROQ_API_KEY_PRIMARY",
  "GROQ_API_KEY_BACKUP",
  "GROQ_API_KEY",
] as const;

// Directory locations where .env must be synchronized
function getEnvFilePaths(): string[] {
  const cwd = process.cwd(); // usually d:\DIOR_CLIPPING\website-tahapan-dengan-kemauan-ku
  const paths = [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, "apps", "api", ".env"),
    path.resolve(cwd, "backend", ".env"),
    path.resolve(cwd, "..", ".env"),
    path.resolve(cwd, "..", "backend", ".env"),
  ];

  return paths.filter((p) => {
    try {
      return fs.existsSync(p) || fs.existsSync(path.dirname(p));
    } catch {
      return false;
    }
  });
}

/**
 * Safely updates or creates keys in a .env file content without destroying other variables
 */
function updateEnvContent(originalContent: string, updates: Record<string, string>): string {
  let lines = originalContent.split(/\r?\n/);
  const updatedKeys = new Set<string>();

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return line;
    }

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return line;

    const key = trimmed.slice(0, eqIdx).trim();
    if (updates[key] !== undefined) {
      updatedKeys.add(key);
      const val = updates[key];
      return `${key}="${val}"`;
    }
    return line;
  });

  // Append any keys that weren't present in the original file
  for (const [key, val] of Object.entries(updates)) {
    if (!updatedKeys.has(key) && val) {
      newLines.push(`${key}="${val}"`);
    }
  }

  return newLines.join("\n");
}

/**
 * GET /api/settings/api-keys
 * Returns all configured Gemini & Groq API keys
 */
settingsRouter.get("/api-keys", (_req: Request, res: Response) => {
  const keys: Record<string, string> = {};
  for (const name of RECOGNIZED_KEY_NAMES) {
    keys[name] = process.env[name] || "";
  }

  res.status(200).json({
    success: true,
    data: keys,
    directories: getEnvFilePaths(),
  });
});

/**
 * POST /api/settings/api-keys
 * Updates Gemini & Groq keys in process.env and writes to all directory .env files
 */
settingsRouter.post("/api-keys", (req: Request, res: Response) => {
  const updates = (req.body?.keys || req.body || {}) as Record<string, string>;
  const sanitizedUpdates: Record<string, string> = {};

  for (const [rawKey, rawVal] of Object.entries(updates)) {
    const key = rawKey.trim();
    if (RECOGNIZED_KEY_NAMES.includes(key as any)) {
      const val = typeof rawVal === "string" ? rawVal.replace(/^["']|["']$/g, "").trim() : "";
      sanitizedUpdates[key] = val;
      // Update running process environment immediately
      if (val) {
        process.env[key] = val;
      } else {
        delete process.env[key];
      }
    }
  }

  // Sinkronisasi otomatis alias kurasi (CURATION <-> CURATOR)
  if (sanitizedUpdates["GEMINI_API_KEY_CURATION"] && !sanitizedUpdates["GEMINI_API_KEY_CURATOR"]) {
    sanitizedUpdates["GEMINI_API_KEY_CURATOR"] = sanitizedUpdates["GEMINI_API_KEY_CURATION"];
    process.env["GEMINI_API_KEY_CURATOR"] = sanitizedUpdates["GEMINI_API_KEY_CURATION"];
  } else if (sanitizedUpdates["GEMINI_API_KEY_CURATOR"] && !sanitizedUpdates["GEMINI_API_KEY_CURATION"]) {
    sanitizedUpdates["GEMINI_API_KEY_CURATION"] = sanitizedUpdates["GEMINI_API_KEY_CURATOR"];
    process.env["GEMINI_API_KEY_CURATION"] = sanitizedUpdates["GEMINI_API_KEY_CURATOR"];
  }

  if (sanitizedUpdates["GEMINI_API_KEY_CURATION_BACKUP"] && !sanitizedUpdates["GEMINI_API_KEY_CURATOR_BACKUP"]) {
    sanitizedUpdates["GEMINI_API_KEY_CURATOR_BACKUP"] = sanitizedUpdates["GEMINI_API_KEY_CURATION_BACKUP"];
    process.env["GEMINI_API_KEY_CURATOR_BACKUP"] = sanitizedUpdates["GEMINI_API_KEY_CURATION_BACKUP"];
  } else if (sanitizedUpdates["GEMINI_API_KEY_CURATOR_BACKUP"] && !sanitizedUpdates["GEMINI_API_KEY_CURATION_BACKUP"]) {
    sanitizedUpdates["GEMINI_API_KEY_CURATION_BACKUP"] = sanitizedUpdates["GEMINI_API_KEY_CURATOR_BACKUP"];
    process.env["GEMINI_API_KEY_CURATION_BACKUP"] = sanitizedUpdates["GEMINI_API_KEY_CURATOR_BACKUP"];
  }

  // Update .env files across all directories
  const envPaths = getEnvFilePaths();
  const writtenPaths: string[] = [];

  for (const envPath of envPaths) {
    try {
      let existingContent = "";
      if (fs.existsSync(envPath)) {
        existingContent = fs.readFileSync(envPath, "utf-8");
      }
      const updatedContent = updateEnvContent(existingContent, sanitizedUpdates);
      fs.writeFileSync(envPath, updatedContent, "utf-8");
      writtenPaths.push(envPath);
    } catch (err: any) {
      console.warn(`[Settings] Gagal menulis ke ${envPath}:`, err?.message);
    }
  }

  console.log(`[Settings] API keys berhasil diperbarui di ${writtenPaths.length} direktori.`);

  res.status(200).json({
    success: true,
    message: `Kunci API berhasil disimpan dan diterapkan ke ${writtenPaths.length} direktori sistem!`,
    writtenDirectories: writtenPaths,
  });
});

/**
 * POST /api/settings/check-keys
 * Live verification & quota/rate-limit check for Gemini and Groq API keys
 */
settingsRouter.post("/check-keys", async (req: Request, res: Response) => {
  // Use keys provided in body if any, otherwise fallback to current process.env
  const bodyKeys = (req.body?.keys || req.body || {}) as Record<string, string>;

  const targetKeys: Record<string, string> = {};
  for (const name of RECOGNIZED_KEY_NAMES) {
    targetKeys[name] = bodyKeys[name] !== undefined ? bodyKeys[name] : (process.env[name] || "");
  }

  const results: Array<{
    name: string;
    type: "gemini" | "groq";
    role: "primary" | "backup";
    status: "active" | "warning" | "rate_limited" | "invalid" | "unconfigured" | "error";
    label: string;
    quotaRules: string;
    details: string;
    latencyMs?: number;
    remainingRequests?: string;
    remainingTokens?: string;
    resetTime?: string;
  }> = [];

  // 1. Check Gemini Keys
  const geminiEntries: Array<{ name: string; role: "primary" | "backup" }> = [
    { name: "GEMINI_API_KEY_TRANSCRIPTION", role: "primary" },
    { name: "GEMINI_API_KEY_CURATION", role: "primary" },
    { name: "GEMINI_API_KEY_ART_DIRECTOR", role: "primary" },
    { name: "GEMINI_API_KEY_STYLE_CLONER", role: "primary" },
    { name: "GEMINI_API_KEY", role: "primary" },
    { name: "GEMINI_API_KEY_TRANSCRIPTION_BACKUP", role: "backup" },
    { name: "GEMINI_API_KEY_CURATION_BACKUP", role: "backup" },
    { name: "GEMINI_API_KEY_ART_DIRECTOR_BACKUP", role: "backup" },
    { name: "GEMINI_API_KEY_STYLE_CLONER_BACKUP", role: "backup" },
    { name: "GEMINI_API_KEY_BACKUP", role: "backup" },
  ];

  for (const entry of geminiEntries) {
    const key = (targetKeys[entry.name] || "").trim();
    if (!key || key.length < 8) {
      results.push({
        name: entry.name,
        type: "gemini",
        role: entry.role,
        status: "unconfigured",
        label: "Belum Dikonfigurasi",
        quotaRules: "15 RPM • 1,000,000 TPM • 1,500 RPD",
        details: "Kunci API belum diisi di sistem.",
      });
      continue;
    }

    const start = Date.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
      const resp = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(6000),
      });

      const latencyMs = Date.now() - start;

      if (resp.status === 200) {
        results.push({
          name: entry.name,
          type: "gemini",
          role: entry.role,
          status: "active",
          label: "Aktif & Normal",
          quotaRules: "15 RPM • 1,000,000 TPM • 1,500 RPD",
          details: `Koneksi Google AI Studio terverifikasi (${latencyMs}ms). Siap memproses.`,
          latencyMs,
        });
      } else if (resp.status === 429) {
        results.push({
          name: entry.name,
          type: "gemini",
          role: entry.role,
          status: "rate_limited",
          label: "Limit Kuota Tercapai (429)",
          quotaRules: "15 RPM • 1,000,000 TPM • 1,500 RPD",
          details: "Limit kuota Google API telah tercapai. Sistem akan otomatis beralih ke kunci backup.",
          latencyMs,
        });
      } else if (resp.status === 400 || resp.status === 403) {
        results.push({
          name: entry.name,
          type: "gemini",
          role: entry.role,
          status: "invalid",
          label: "Kunci Tidak Valid (400/403)",
          quotaRules: "15 RPM • 1,000,000 TPM • 1,500 RPD",
          details: "API Key tidak dikenali oleh Google AI Studio atau otentikasi ditolak.",
          latencyMs,
        });
      } else {
        results.push({
          name: entry.name,
          type: "gemini",
          role: entry.role,
          status: "error",
          label: `Status HTTP ${resp.status}`,
          quotaRules: "15 RPM • 1,000,000 TPM • 1,500 RPD",
          details: `Respons server: ${resp.statusText}`,
          latencyMs,
        });
      }
    } catch (err: any) {
      results.push({
        name: entry.name,
        type: "gemini",
        role: entry.role,
        status: "error",
        label: "Koneksi Timeout / Gagal",
        quotaRules: "15 RPM • 1,000,000 TPM • 1,500 RPD",
        details: err?.message?.slice(0, 100) || "Gagal menghubungi endpoint Google API.",
      });
    }
  }

  // 2. Check Groq Keys
  const groqEntries: Array<{ name: string; role: "primary" | "backup" }> = [
    { name: "GROQ_API_KEY_PRIMARY", role: "primary" },
    { name: "GROQ_API_KEY_BACKUP", role: "backup" },
  ];

  for (const entry of groqEntries) {
    const key = (targetKeys[entry.name] || targetKeys["GROQ_API_KEY"] || "").trim();
    if (!key || key.length < 8) {
      results.push({
        name: entry.name,
        type: "groq",
        role: entry.role,
        status: "unconfigured",
        label: "Belum Dikonfigurasi",
        quotaRules: "20 RPM • 2,000 RPD • Whisper Cloud",
        details: "Kunci API Groq belum diisi.",
      });
      continue;
    }

    const start = Date.now();
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(6000),
      });

      const latencyMs = Date.now() - start;

      const remReq = resp.headers.get("x-ratelimit-remaining-requests");
      const limitReq = resp.headers.get("x-ratelimit-limit-requests");
      const remTok = resp.headers.get("x-ratelimit-remaining-tokens");
      const limitTok = resp.headers.get("x-ratelimit-limit-tokens");
      const resetReq = resp.headers.get("x-ratelimit-reset-requests");

      const remainingRequestsStr = remReq && limitReq ? `${remReq} / ${limitReq}` : undefined;
      const remainingTokensStr = remTok && limitTok ? `${remTok} / ${limitTok}` : undefined;

      if (resp.status === 200) {
        let isWarning = false;
        if (remReq && limitReq && Number(limitReq) > 0) {
          const ratio = Number(remReq) / Number(limitReq);
          if (ratio < 0.15) isWarning = true;
        }

        results.push({
          name: entry.name,
          type: "groq",
          role: entry.role,
          status: isWarning ? "warning" : "active",
          label: isWarning ? "Mendekati Limit (<15%)" : "Aktif & Normal",
          quotaRules: "20 RPM • 2,000 RPD • 30k TPM",
          details: `Koneksi Groq Whisper terverifikasi (${latencyMs}ms). Sisa request: ${remReq || "2000"}.`,
          latencyMs,
          remainingRequests: remainingRequestsStr,
          remainingTokens: remainingTokensStr,
          resetTime: resetReq || undefined,
        });
      } else if (resp.status === 429) {
        results.push({
          name: entry.name,
          type: "groq",
          role: entry.role,
          status: "rate_limited",
          label: "Limit Groq Tercapai (429)",
          quotaRules: "20 RPM • 2,000 RPD • 30k TPM",
          details: "Rate limit Groq tercapai. Sistem akan menggunakan failover key.",
          latencyMs,
          resetTime: resetReq || resp.headers.get("retry-after") || undefined,
        });
      } else if (resp.status === 401) {
        results.push({
          name: entry.name,
          type: "groq",
          role: entry.role,
          status: "invalid",
          label: "Kunci Tidak Valid (401)",
          quotaRules: "20 RPM • 2,000 RPD • 30k TPM",
          details: "API Key Groq tidak valid atau dicabut.",
          latencyMs,
        });
      } else {
        results.push({
          name: entry.name,
          type: "groq",
          role: entry.role,
          status: "error",
          label: `Status HTTP ${resp.status}`,
          quotaRules: "20 RPM • 2,000 RPD • 30k TPM",
          details: `Respons Groq: ${resp.statusText}`,
          latencyMs,
        });
      }
    } catch (err: any) {
      results.push({
        name: entry.name,
        type: "groq",
        role: entry.role,
        status: "error",
        label: "Koneksi Timeout / Gagal",
        quotaRules: "20 RPM • 2,000 RPD • 30k TPM",
        details: err?.message?.slice(0, 100) || "Gagal menghubungi endpoint Groq API.",
      });
    }
  }

  res.status(200).json({
    success: true,
    data: results,
    checkedAt: Date.now(),
  });
});

/**
 * GET /api/settings/api-tokens
 * [FASE 4: REAL-TIME API KEY & TOKEN USAGE SNAPSHOT]
 */
settingsRouter.get("/api-tokens", (_req: Request, res: Response) => {
  const usage = tokenTracker.getAllUsage();
  res.status(200).json({
    success: true,
    data: usage,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/settings/token-stream
 * [FASE 4: SERVER-SENT EVENTS (SSE) FOR REAL-TIME TOKEN DEDUCTION MONITORING]
 */
settingsRouter.get("/token-stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Send initial snapshot
  const initial = tokenTracker.getAllUsage();
  res.write(`event: token_snapshot\ndata: ${JSON.stringify(initial)}\n\n`);

  const onDeducted = (data: any) => {
    try {
      res.write(`event: token_deducted\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {}
  };

  tokenTracker.on("token_deducted", onDeducted);

  const heartbeat = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch {}
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    tokenTracker.off("token_deducted", onDeducted);
  });
});


