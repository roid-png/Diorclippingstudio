#!/bin/bash
set -e

# Pastikan NVM aktif dan Node 22 (sesuai .nvmrc) terpasang
export NVM_DIR="/usr/local/share/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"
if command -v nvm &> /dev/null; then
    nvm install 22 2>/dev/null || true
    nvm use 22 2>/dev/null || nvm use default 2>/dev/null || true
fi

echo "=========================================================="
echo " [1/4] Mengupdate Package Linux & Menginstal Dependensi  "
echo "=========================================================="
sudo apt-get update
sudo apt-get install -y \
    ffmpeg \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    fontconfig \
    fonts-montserrat

echo "=========================================================="
echo " [2/4] Menyiapkan Folder Wajib & Hak Akses Output        "
echo "=========================================================="
mkdir -p backend/temp backend/presets backend/outputs backend/assets \
         apps/api/temp apps/api/outputs \
         apps/web/public/fonts public/fonts outputs temp

# Pastikan permission folder temp dan outputs dapat ditulis oleh proses background
chmod -R 777 backend/temp backend/outputs apps/api/temp apps/api/outputs outputs temp 2>/dev/null || true

echo "=========================================================="
echo " [3/4] Menginstal Dependensi Monorepo & Pustaka Studio   "
echo "=========================================================="
# Aktifkan pnpm secara global via corepack jika belum tersedia
if ! command -v pnpm &> /dev/null; then
    echo "Mengaktifkan pnpm package manager..."
    corepack enable || sudo npm install -g pnpm
fi

# Jalankan instalasi dependensi
echo "Menjalankan instalasi paket via pnpm..."
pnpm install || npm install

# Download aset font studio jika skrip tersedia
if [ -f "scripts/download-fonts.js" ]; then
    echo "Mengunduh aset font lokal untuk canvas rendering..."
    node scripts/download-fonts.js || true
fi

echo "=========================================================="
echo " [4/4] Verifikasi Lingkungan Sistem                      "
echo "=========================================================="
echo -n "FFmpeg: " && ffmpeg -version | head -n 1
echo -n "Node.js: " && node -v
echo -n "NPM: " && npm -v
if command -v pnpm &> /dev/null; then
    echo -n "PNPM: " && pnpm -v
fi

echo ""
echo "=========================================================="
echo "   Setup Lingkungan GitHub Codespaces Berhasil Selesai!   "
echo "=========================================================="

