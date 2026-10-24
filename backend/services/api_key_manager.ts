import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import Groq from "groq-sdk";

// Constants for Primary & Backup keys (loaded dynamically from environment)
const DEFAULT_GEMINI_TRANSCRIPTION_PRIMARY = process.env.GEMINI_API_KEY_TRANSCRIPTION || "";
const DEFAULT_GEMINI_TRANSCRIPTION_BACKUP = process.env.GEMINI_API_KEY_TRANSCRIPTION_BACKUP || "";

const DEFAULT_GEMINI_CURATOR_PRIMARY = process.env.GEMINI_API_KEY_CURATOR || process.env.GEMINI_API_KEY || "";
const DEFAULT_GEMINI_CURATOR_BACKUP = process.env.GEMINI_API_KEY_CURATOR_BACKUP || "";

const DEFAULT_GEMINI_ART_DIRECTOR_PRIMARY = process.env.GEMINI_API_KEY_ART_DIRECTOR || "";
const DEFAULT_GEMINI_ART_DIRECTOR_BACKUP = process.env.GEMINI_API_KEY_ART_DIRECTOR_BACKUP || "";

const DEFAULT_GEMINI_STYLE_CLONER_PRIMARY = process.env.GEMINI_API_KEY_STYLE_CLONER || "";
const DEFAULT_GEMINI_STYLE_CLONER_BACKUP = process.env.GEMINI_API_KEY_STYLE_CLONER_BACKUP || "";

const DEFAULT_GROQ_PRIMARY = process.env.GROQ_API_KEY_PRIMARY || process.env.GROQ_API_KEY || "";
const DEFAULT_GROQ_BACKUP = process.env.GROQ_API_KEY_BACKUP || "";

export interface GeminiKeyEntry {
  key: string;
  label: "PRIMARY" | "BACKUP";
  service: "TRANSCRIPTION" | "CURATOR" | "ART_DIRECTOR" | "STYLE_CLONER";
}

// Client Pools (keyed by apiKey string for zero duplicate memory overhead)
const aiClientsMap = new Map<string, GoogleGenerativeAI>();
const fileManagersMap = new Map<string, GoogleAIFileManager>();

export function getGeminiClient(key: string): GoogleGenerativeAI {
  let client = aiClientsMap.get(key);
  if (!client) {
    client = new GoogleGenerativeAI(key);
    aiClientsMap.set(key, client);
  }
  return client;
}

export function getGeminiFileManager(key: string): GoogleAIFileManager {
  let fm = fileManagersMap.get(key);
  if (!fm) {
    fm = new GoogleAIFileManager(key);
    fileManagersMap.set(key, fm);
  }
  return fm;
}

function sanitizeKey(k: string | undefined, defaultVal: string): string {
  const val = k || defaultVal;
  return val.replace(/^["']|["']$/g, "").trim();
}

export const STANDARD_GEMINI_CANDIDATE_MODELS = [
  "gemini-3.8-flash",      // Rekomendasi Resmi Google Gemini API (Model Utama 3.8 Flash)
  "gemini-3.5-flash",      // Cascade 1: Model Vision & Analisis Sangat Andal & Stabil
  "gemini-3.7-flash",      // Cascade 2: Alternatif Seri Flash Terbaru
  "gemini-3.6-flash",      // Cascade 3: Alternatif Flash
  "gemini-3.5-flash-lite", // Cascade 4: Ringan & Cepat untuk Analisis JSON
  "gemini-flash-latest",   // Safety Net: Dynamic Latest Pointer Resmi
];

/**
 * 1. GEMINI TRANSCRIPTION KEYS (Primary & Backup)
 */
export function getTranscriptionKeys(): GeminiKeyEntry[] {
  const primary = sanitizeKey(
    process.env.GEMINI_API_KEY_TRANSCRIPTION || process.env.GEMINI_API_KEY,
    DEFAULT_GEMINI_TRANSCRIPTION_PRIMARY
  );
  const backup = sanitizeKey(
    process.env.GEMINI_API_KEY_TRANSCRIPTION_BACKUP || process.env.GEMINI_API_KEY_BACKUP,
    DEFAULT_GEMINI_TRANSCRIPTION_BACKUP
  );

  return [
    { key: primary, label: "PRIMARY", service: "TRANSCRIPTION" },
    { key: backup, label: "BACKUP", service: "TRANSCRIPTION" },
  ];
}

export function getTranscriptionApiKey(): string {
  return getTranscriptionKeys()[0]!.key;
}

export function getTranscriptionAi(): GoogleGenerativeAI {
  return getGeminiClient(getTranscriptionApiKey());
}

export function getTranscriptionFileManager(): GoogleAIFileManager {
  return getGeminiFileManager(getTranscriptionApiKey());
}

/**
 * 2. GEMINI CURATOR KEYS (Primary & Backup)
 */
export function getCuratorKeys(): GeminiKeyEntry[] {
  const primary = sanitizeKey(
    process.env.GEMINI_API_KEY_CURATOR ||
      process.env.GEMINI_API_KEY_CURATION ||
      process.env.GEMINI_API_KEY,
    DEFAULT_GEMINI_CURATOR_PRIMARY
  );
  const backup = sanitizeKey(
    process.env.GEMINI_API_KEY_CURATOR_BACKUP ||
      process.env.GEMINI_API_KEY_CURATION_BACKUP ||
      process.env.GEMINI_API_KEY_BACKUP,
    DEFAULT_GEMINI_CURATOR_BACKUP
  );

  return [
    { key: primary, label: "PRIMARY", service: "CURATOR" },
    { key: backup, label: "BACKUP", service: "CURATOR" },
  ];
}

export function getCuratorApiKey(): string {
  return getCuratorKeys()[0]!.key;
}

export function getCuratorAi(): GoogleGenerativeAI {
  return getGeminiClient(getCuratorApiKey());
}

export function getCuratorModel(modelName = "gemini-3.8-flash") {
  return getCuratorAi().getGenerativeModel({ model: modelName });
}

export function getCuratorFileManager(): GoogleAIFileManager {
  return getGeminiFileManager(getCuratorApiKey());
}

/**
 * 3. GEMINI ART DIRECTOR KEYS (Primary & Backup)
 */
export function getArtDirectorKeys(): GeminiKeyEntry[] {
  const primary = sanitizeKey(
    process.env.GEMINI_API_KEY_ART_DIRECTOR || process.env.GEMINI_API_KEY,
    DEFAULT_GEMINI_ART_DIRECTOR_PRIMARY
  );
  const backup = sanitizeKey(
    process.env.GEMINI_API_KEY_ART_DIRECTOR_BACKUP || process.env.GEMINI_API_KEY_BACKUP,
    DEFAULT_GEMINI_ART_DIRECTOR_BACKUP
  );

  return [
    { key: primary, label: "PRIMARY", service: "ART_DIRECTOR" },
    { key: backup, label: "BACKUP", service: "ART_DIRECTOR" },
  ];
}

export function getArtDirectorApiKey(): string {
  return getArtDirectorKeys()[0]!.key;
}

export function getArtDirectorAi(): GoogleGenerativeAI {
  return getGeminiClient(getArtDirectorApiKey());
}

export function getArtDirectorModel(modelName = "gemini-3.8-flash") {
  return getArtDirectorAi().getGenerativeModel({ model: modelName });
}

/**
 * 4. GEMINI STYLE CLONER KEYS (Dedicated Key with Automatic Cascade)
 */
export function getStyleClonerKeys(): GeminiKeyEntry[] {
  const primary = sanitizeKey(
    process.env.GEMINI_API_KEY_STYLE_CLONER ||
      process.env.GEMINI_API_KEY_ART_DIRECTOR ||
      process.env.GEMINI_API_KEY,
    DEFAULT_GEMINI_ART_DIRECTOR_PRIMARY
  );
  const backup = sanitizeKey(
    process.env.GEMINI_API_KEY_STYLE_CLONER_BACKUP ||
      process.env.GEMINI_API_KEY_ART_DIRECTOR_BACKUP ||
      process.env.GEMINI_API_KEY_BACKUP,
    DEFAULT_GEMINI_ART_DIRECTOR_BACKUP
  );

  return [
    { key: primary, label: "PRIMARY", service: "STYLE_CLONER" },
    { key: backup, label: "BACKUP", service: "STYLE_CLONER" },
  ];
}

export function getStyleClonerApiKey(): string {
  return getStyleClonerKeys()[0]!.key;
}

export function getStyleClonerAi(): GoogleGenerativeAI {
  return getGeminiClient(getStyleClonerApiKey());
}

export function getStyleClonerModel(modelName = "gemini-3.8-flash") {
  return getStyleClonerAi().getGenerativeModel({ model: modelName });
}

/**
 * Utility: Checks if an error is quota exceeded, rate limit, or resource exhausted.
 */
export function isQuotaOrRateLimitError(err: any): boolean {
  const msg = String(err?.message || "").toLowerCase();
  const status = err?.status || err?.statusCode || 0;
  return (
    status === 429 ||
    status === 403 ||
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("resource_exhausted") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("quota exceeded")
  );
}

/**
 * Utility: Checks if an error is transient or server overload (eligible for model rotation).
 */
export function isTransientError(err: any): boolean {
  const msg = String(err?.message || "").toLowerCase();
  const status = err?.status || err?.statusCode || 0;
  return (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    msg.includes("503") ||
    msg.includes("500") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("timeout") ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout")
  );
}

/**
 * Systematic 2-Dimensional Failover Engine:
 * Loops through Keys (Primary -> Backup) and Candidate Models.
 * - If quota/rate limit: switches immediately to Backup key.
 * - If model error/overload: rotates to next candidate model.
 */
export async function executeGeminiWithFailover<T>(options: {
  service: "TRANSCRIPTION" | "CURATOR" | "ART_DIRECTOR" | "STYLE_CLONER";
  candidateModels: string[];
  action: (ai: GoogleGenerativeAI, modelName: string, keyInfo: GeminiKeyEntry) => Promise<T>;
  timeoutMs?: number;
}): Promise<T> {
  const keys =
    options.service === "TRANSCRIPTION"
      ? getTranscriptionKeys()
      : options.service === "CURATOR"
      ? getCuratorKeys()
      : options.service === "STYLE_CLONER"
      ? getStyleClonerKeys()
      : [...getArtDirectorKeys(), ...getCuratorKeys()];

  const validKeys = keys.filter((k) => k.key && k.key.length > 10);
  let lastError: any = null;

  for (const keyInfo of validKeys) {
    const ai = getGeminiClient(keyInfo.key);
    for (const modelName of options.candidateModels) {
      try {
        console.log(
          `[ApiKeyManager] [${options.service}] Mencoba kunci ${keyInfo.label} dengan model ${modelName}...`
        );
        let callPromise = options.action(ai, modelName, keyInfo);
        if (options.timeoutMs && options.timeoutMs > 0) {
          callPromise = Promise.race([
            callPromise,
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(
                      `Timeout panggilan model ${modelName} (${Math.round(
                        options.timeoutMs! / 1000
                      )} detik)`
                    )
                  ),
                options.timeoutMs
              )
            ),
          ]);
        }
        const result = await callPromise;
        return result;
      } catch (err: any) {
        lastError = err;
        const isQuota = isQuotaOrRateLimitError(err);
        if (isQuota) {
          console.warn(
            `[ApiKeyManager] [${options.service}] Kunci ${keyInfo.label} mencapai batas limit/kuota: ${err?.message?.slice(
              0,
              120
            )}. Beralih ke kunci berikutnya...`
          );
          // Break model loop to switch key immediately
          break;
        } else {
          console.warn(
            `[ApiKeyManager] [${options.service}] Model ${modelName} kendala: ${err?.message?.slice(
              0,
              120
            )}. Mencoba model berikutnya...`
          );
        }
      }
    }
  }

  throw (
    lastError ||
    new Error(`Semua kunci API dan model untuk layanan ${options.service} gagal diproses.`)
  );
}

/**
 * 4 & 5. GROQ DUAL CLIENTS WITH AUTO-FAILOVER & ROUND-ROBIN
 */
let groqCurrentIndex = 0;

export interface GroqKeyEntry {
  key: string;
  label: "PRIMARY" | "BACKUP";
}

export function getGroqKeys(): GroqKeyEntry[] {
  const primary =
    process.env.GROQ_API_KEY_PRIMARY ||
    process.env.GROQ_API_KEY ||
    DEFAULT_GROQ_PRIMARY;
  const backup =
    process.env.GROQ_API_KEY_BACKUP ||
    DEFAULT_GROQ_BACKUP;

  return [
    { key: primary, label: "PRIMARY" },
    { key: backup, label: "BACKUP" },
  ];
}

/**
 * Executes a Groq API operation with automatic failover and round-robin switching.
 */
export async function executeGroqWithFailover<T>(
  action: (client: Groq, keyInfo: GroqKeyEntry) => Promise<T>,
  timeoutMs = 60000
): Promise<T> {
  const keys = getGroqKeys().filter((k) => k.key && k.key.length > 10);
  if (keys.length === 0) {
    throw new Error("Tidak ada GROQ_API_KEY yang terkonfigurasi.");
  }

  let attempts = 0;
  let lastError: any = null;

  while (attempts < keys.length) {
    const activeEntry = keys[groqCurrentIndex % keys.length]!;
    try {
      const client = new Groq({ apiKey: activeEntry.key, timeout: timeoutMs });
      const result = await action(client, activeEntry);
      return result;
    } catch (err: any) {
      lastError = err;
      console.warn(
        `[ApiKeyManager] Groq ${activeEntry.label} mengalami kendala: ${err?.message || err}. Mencoba failover...`
      );
      groqCurrentIndex = (groqCurrentIndex + 1) % keys.length;
      attempts++;
    }
  }

  throw lastError || new Error("Semua kredensial Groq API gagal diproses.");
}
