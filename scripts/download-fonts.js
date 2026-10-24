import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const FONTS_DIR = path.resolve("backend/assets/fonts");

const FONTS = [
  {
    name: "Montserrat-ExtraBold.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf",
  },
  {
    name: "PlusJakartaSans-ExtraBold.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf",
  },
  {
    name: "Poppins-Black.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Black.ttf",
  },
  {
    name: "Anton-Regular.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf",
  },
  {
    name: "BebasNeue-Regular.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bebasneue/BebasNeue-Regular.ttf",
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
          return reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
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

async function main() {
  if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
  }

  console.log(`[FontDownloader] Menyiapkan font di ${FONTS_DIR}...`);

  for (const font of FONTS) {
    const dest = path.join(FONTS_DIR, font.name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      console.log(`[FontDownloader] Font ${font.name} sudah ada (${fs.statSync(dest).size} bytes).`);
      continue;
    }
    console.log(`[FontDownloader] Mengunduh ${font.name} dari ${font.url}...`);
    try {
      await downloadFile(font.url, dest);
      const size = fs.statSync(dest).size;
      console.log(`[FontDownloader] Berhasil mengunduh ${font.name} (${size} bytes)`);
    } catch (err) {
      console.error(`[FontDownloader] Gagal mengunduh ${font.name}:`, err.message);
    }
  }

  console.log("[FontDownloader] Selesai instalasi font.");
}

main().catch(console.error);

