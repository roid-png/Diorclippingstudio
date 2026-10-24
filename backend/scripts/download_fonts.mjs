import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const TARGET_DIRS = [
  path.resolve("public/fonts"),
  path.resolve("apps/web/public/fonts"),
  path.resolve("backend/assets/fonts"),
  path.resolve("apps/api/assets/fonts"),
];

const FONTS = [
  // Sans-Serif Modern & Impact
  {
    name: "Montserrat-Bold.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf",
  },
  {
    name: "Montserrat-ExtraBold.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf",
  },
  {
    name: "Montserrat-Black.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf",
  },
  {
    name: "Poppins-Bold.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf",
  },
  {
    name: "Poppins-Black.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Black.ttf",
  },
  {
    name: "PlusJakartaSans-Bold.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf",
  },
  {
    name: "PlusJakartaSans-ExtraBold.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf",
  },
  {
    name: "Inter-Black.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf",
  },
  // Bold Headline & Punchy
  {
    name: "Anton-Regular.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf",
  },
  {
    name: "BebasNeue-Regular.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bebasneue/BebasNeue-Regular.ttf",
  },
  {
    name: "LeagueSpartan-Bold.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/leaguespartan/LeagueSpartan%5Bwght%5D.ttf",
  },
  {
    name: "LeagueSpartan-Black.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/leaguespartan/LeagueSpartan%5Bwght%5D.ttf",
  },
  {
    name: "Oswald-Bold.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/Oswald%5Bwght%5D.ttf",
  },
  // Casual / Gaming / Comic
  {
    name: "Bangers-Regular.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bangers/Bangers-Regular.ttf",
  },
  {
    name: "LuckiestGuy-Regular.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/apache/luckiestguy/LuckiestGuy-Regular.ttf",
  },
  // Editorial & Luxury
  {
    name: "Cinzel-Bold.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf",
  },
  {
    name: "PlayfairDisplay-Black.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf",
  },
];

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        }
        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP ${response.statusCode}`));
        }
        const fileStream = fs.createWriteStream(destPath);
        response.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close();
          resolve();
        });
        fileStream.on("error", (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      })
      .on("error", reject);
  });
}

export async function downloadCreatorFonts() {
  for (const d of TARGET_DIRS) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }

  const primaryDir = TARGET_DIRS[0];
  console.log(`[FontDownloader] Mengunduh font kreator ke ${primaryDir}...`);

  for (const font of FONTS) {
    const primaryDest = path.join(primaryDir, font.name);
    let downloaded = false;

    // Check if already in primary or backend/assets/fonts
    const existingCandidate = path.join(TARGET_DIRS[2], font.name);
    if (fs.existsSync(existingCandidate) && fs.statSync(existingCandidate).size > 1000) {
      if (!fs.existsSync(primaryDest) || fs.statSync(primaryDest).size < 1000) {
        fs.copyFileSync(existingCandidate, primaryDest);
      }
      downloaded = true;
    } else if (fs.existsSync(primaryDest) && fs.statSync(primaryDest).size > 1000) {
      downloaded = true;
    }

    if (!downloaded) {
      console.log(`[FontDownloader] Mengunduh ${font.name}...`);
      try {
        await downloadFile(font.url, primaryDest);
        console.log(`[FontDownloader] Berhasil: ${font.name} (${fs.statSync(primaryDest).size} bytes)`);
      } catch (err) {
        console.warn(`[FontDownloader] Gagal mengunduh ${font.name}: ${err.message}`);
      }
    }

    // Mirror to all other target directories if primaryDest exists
    if (fs.existsSync(primaryDest) && fs.statSync(primaryDest).size > 1000) {
      for (let i = 1; i < TARGET_DIRS.length; i++) {
        const dest = path.join(TARGET_DIRS[i], font.name);
        if (!fs.existsSync(dest) || fs.statSync(dest).size < 1000) {
          try {
            fs.copyFileSync(primaryDest, dest);
          } catch {}
        }
      }
    }
  }

  // Create aliases / clones for special creator font names if missing
  const aliases = [
    { from: "Anton-Regular.ttf", to: "Impact.ttf" },
    { from: "LeagueSpartan-Black.ttf", to: "TheBoldFont.ttf" },
    { from: "LuckiestGuy-Regular.ttf", to: "KomikaAxis.ttf" },
  ];

  for (const d of TARGET_DIRS) {
    for (const a of aliases) {
      const src = path.join(d, a.from);
      const dst = path.join(d, a.to);
      if (fs.existsSync(src) && (!fs.existsSync(dst) || fs.statSync(dst).size < 1000)) {
        try {
          fs.copyFileSync(src, dst);
        } catch {}
      }
    }
  }

  console.log(`[FontDownloader] Selesai. Total font tersedia di ${primaryDir}: ${fs.readdirSync(primaryDir).filter(f => f.endsWith('.ttf')).length}`);
}

// Auto-run if executed directly via node
if (process.argv[1]?.endsWith("download_fonts.mjs")) {
  downloadCreatorFonts().catch(console.error);
}
