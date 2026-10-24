import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";

export interface KeyTokenUsageRecord {
  keyName: string;
  alias: string;
  service: string;
  type: "gemini" | "groq";
  totalLimit: number;
  tokensUsed: number;
  tokensRemaining: number;
  requestCount: number;
  lastUsedAt?: string;
  lastTokensDeducted?: number;
}

export type TokenLedgerState = Record<string, KeyTokenUsageRecord>;

const DEFAULT_FREE_TIER_LIMIT = 1000000; // 1,000,000 tokens default

class TokenTrackerService extends EventEmitter {
  private ledgerPath: string;
  private state: TokenLedgerState = {};
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    super();
    const dataDir = path.resolve(process.cwd(), "backend/data");
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch {}
    }
    this.ledgerPath = path.join(dataDir, "api_key_usage.json");
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.ledgerPath)) {
        const raw = fs.readFileSync(this.ledgerPath, "utf-8");
        this.state = JSON.parse(raw);
      }
    } catch {
      this.state = {};
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      try {
        const dir = path.dirname(this.ledgerPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.ledgerPath, JSON.stringify(this.state, null, 2), "utf-8");
      } catch (err: any) {
        console.warn(`[TokenTracker] Gagal menyimpan ledger ke disk: ${err?.message}`);
      }
    }, 1000); // 1s debounce to save disk I/O
  }

  private getKeyAlias(keyNameOrService: string): string {
    const s = keyNameOrService.toUpperCase();
    if (s.includes("TRANSCRIPTION")) return "Gemini Transkripsi Audio";
    if (s.includes("CURAT")) return "Gemini Kurasi Momen Viral";
    if (s.includes("ART")) return "Gemini Art Director & Beats";
    if (s.includes("STYLE") || s.includes("CLON")) return "Gemini Universal Style Cloner";
    if (s.includes("GROQ")) return "Groq Whisper & Chat";
    return keyNameOrService;
  }

  /**
   * Records token usage deduction from Gemini or Groq response metadata.
   */
  public recordUsage(
    keyIdentifier: string,
    service: string,
    tokensDeducted: number,
    type: "gemini" | "groq" = "gemini"
  ): KeyTokenUsageRecord {
    if (tokensDeducted <= 0) {
      tokensDeducted = type === "gemini" ? 350 : 150; // default conservative estimate if metadata omitted
    }

    const safeKey = keyIdentifier.slice(-12) || service;
    const lookupId = `${service}_${type}_${safeKey}`;

    if (!this.state[lookupId]) {
      this.state[lookupId] = {
        keyName: lookupId,
        alias: this.getKeyAlias(service),
        service,
        type,
        totalLimit: DEFAULT_FREE_TIER_LIMIT,
        tokensUsed: 0,
        tokensRemaining: DEFAULT_FREE_TIER_LIMIT,
        requestCount: 0,
      };
    }

    const record = this.state[lookupId]!;
    record.tokensUsed += tokensDeducted;
    record.tokensRemaining = Math.max(0, record.totalLimit - record.tokensUsed);
    record.requestCount += 1;
    record.lastUsedAt = new Date().toISOString();
    record.lastTokensDeducted = tokensDeducted;

    this.scheduleSave();

    // Broadcast SSE event
    this.emit("token_deducted", {
      keyId: lookupId,
      key_alias: record.alias,
      service: record.service,
      type: record.type,
      used: tokensDeducted,
      total_used: record.tokensUsed,
      remaining: record.tokensRemaining,
      total_limit: record.totalLimit,
      percentage_remaining: Math.round((record.tokensRemaining / record.totalLimit) * 100),
      timestamp: record.lastUsedAt,
    });

    console.log(
      `[TokenTracker] Pemotongan Kuota: ${record.alias} (-${tokensDeducted} Token | Sisa: ${record.tokensRemaining.toLocaleString()} / ${record.totalLimit.toLocaleString()})`
    );

    return record;
  }

  /**
   * Retrieves full snapshot of all tracked keys and token limits.
   */
  public getAllUsage(): TokenLedgerState {
    return { ...this.state };
  }
}

export const tokenTracker = new TokenTrackerService();
