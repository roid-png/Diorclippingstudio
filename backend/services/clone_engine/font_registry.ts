import fs from "node:fs";
import path from "node:path";
import { GlobalFonts } from "@napi-rs/canvas";

let fontsRegistered = false;
const registeredFontMap = new Map<string, string>();

/**
 * Mendapatkan direktori penyimpanan font dengan prioritas urutan pencarian.
 */
export function getFontsDirectories(): string[] {
  const dirs = [
    path.resolve(process.cwd(), "public/fonts"),
    path.resolve(process.cwd(), "backend/assets/fonts"),
    path.resolve(process.cwd(), "apps/api/assets/fonts"),
    path.resolve(process.cwd(), "apps/web/public/fonts"),
    path.resolve(process.cwd(), "../../public/fonts"),
    "D:/DIOR_CLIPPING/website-tahapan-dengan-kemauan-ku/public/fonts",
    "D:/DIOR_CLIPPING/website-tahapan-dengan-kemauan-ku/backend/assets/fonts",
  ];
  return dirs.filter((d) => fs.existsSync(d));
}

/**
 * Pemetaan cerdas font referensi ke font kreator open-source terdekat.
 */
const FONT_SYNONYMS_MAP: Record<string, string> = {
  // Sans-Serif Modern & Impact
  "futura": "League Spartan",
  "avenir": "League Spartan",
  "proxima nova": "Montserrat",
  "proximanova": "Montserrat",
  "gotham": "Montserrat",
  "circular": "Montserrat",
  "arial": "Inter",
  "helvetica": "Inter",
  "sf pro": "Inter",
  "sf pro display": "Inter",
  "san francisco": "Inter",
  "roboto": "Inter",

  // Bold Headline & Punchy
  "the bold font": "TheBoldFont",
  "theboldfont": "TheBoldFont",
  "league spartan": "League Spartan",
  "leaguespartan": "League Spartan",
  "bebas neue": "Bebas Neue",
  "bebasneue": "Bebas Neue",
  "anton": "Anton",
  "impact": "Impact",
  "oswald": "Oswald",

  // Casual / Gaming / Comic
  "komika axis": "Komika Axis",
  "komika": "Komika Axis",
  "comic sans": "Komika Axis",
  "comic sans ms": "Komika Axis",
  "bangers": "Bangers",
  "luckiest guy": "Luckiest Guy",
  "luckiestguy": "Luckiest Guy",

  // Editorial & Luxury
  "cinzel": "Cinzel",
  "trajan": "Cinzel",
  "didot": "Playfair Display",
  "bodoni": "Playfair Display",
  "playfair display": "Playfair Display",
  "playfair": "Playfair Display",
  "times new roman": "Playfair Display",
};

/**
 * Mendaftarkan seluruh font kreator dari folder public/fonts & backend/assets/fonts ke GlobalFonts @napi-rs/canvas.
 */
export function registerAllCreatorFonts(): void {
  if (fontsRegistered) return;

  const fontDirs = getFontsDirectories();
  let registeredCount = 0;

  for (const dir of fontDirs) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith(".ttf") || file.endsWith(".otf")) {
          const fontPath = path.join(dir, file);
          const baseName = path.basename(file, path.extname(file));

          // Normalisasi nama alias untuk registrasi kanvas
          const aliases: string[] = [baseName];

          // Buat alias tanpa hyphen (e.g. Montserrat-ExtraBold -> "Montserrat ExtraBold")
          const spaceName = baseName.replace(/[-_]/g, " ");
          aliases.push(spaceName);

          // Buat alias nama keluarga utama (e.g. "Montserrat")
          const familyName = baseName.split(/[-_]/)[0];
          aliases.push(familyName);

          for (const alias of aliases) {
            if (!registeredFontMap.has(alias.toLowerCase())) {
              try {
                const ok = GlobalFonts.registerFromPath(fontPath, alias);
                if (ok) {
                  registeredFontMap.set(alias.toLowerCase(), fontPath);
                  registeredCount++;
                }
              } catch {}
            }
          }
        }
      }
    } catch {}
  }

  fontsRegistered = true;
  console.log(`[FontRegistry] Berhasil mendaftarkan ${registeredFontMap.size} alias font ke @napi-rs/canvas.`);
}

/**
 * Mencari nama font kreator terdekat yang terdaftar.
 * Jika AI mendeteksi font tertentu dari video referensi tetapi file spesifiknya tidak ada,
 * otomatis memetakan ke font alternatif terdekat dengan bobot visual identik.
 */
export function getClosestFont(rawFontName: string): string {
  registerAllCreatorFonts();

  if (!rawFontName) return "Montserrat ExtraBold";

  const clean = rawFontName.trim().toLowerCase();

  // 1. Cek sinonim pemetaan langsung
  for (const [key, target] of Object.entries(FONT_SYNONYMS_MAP)) {
    if (clean === key || clean.includes(key)) {
      return target;
    }
  }

  // 2. Cek apakah ada di daftar alias yang terdaftar
  for (const [registeredAlias] of registeredFontMap.entries()) {
    if (clean === registeredAlias || clean.includes(registeredAlias) || registeredAlias.includes(clean)) {
      // Kembalikan nama yang rapi
      return registeredAlias
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }

  // 3. Fallback cerdas berdasarkan bobot / kata kunci
  if (clean.includes("serif") || clean.includes("luxury") || clean.includes("editorial")) {
    return "Playfair Display";
  }
  if (clean.includes("comic") || clean.includes("cartoon") || clean.includes("game")) {
    return "Luckiest Guy";
  }
  if (clean.includes("condensed") || clean.includes("tall") || clean.includes("narrow")) {
    return "Bebas Neue";
  }
  if (clean.includes("black") || clean.includes("heavy") || clean.includes("impact")) {
    return "Anton";
  }

  return "Montserrat ExtraBold";
}

/**
 * Menghasilkan string CSS font lengkap yang kompatibel dengan @napi-rs/canvas.
 */
export function resolveCanvasFontString(
  fontFamily: string,
  fontWeight: string = "800",
  fontSizePx: number = 48
): string {
  registerAllCreatorFonts();
  const closestFamily = getClosestFont(fontFamily);
  return `${fontWeight} ${fontSizePx}px "${closestFamily}", sans-serif`;
}
