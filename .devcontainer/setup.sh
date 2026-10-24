#!/bin/bash
# Jangan gunakan set -e agar kegagalan paket minor tidak memicu Recovery Mode di Codespaces

echo "=========================================================="
echo " [1/4] Mengupdate Package Linux & Menginstal Dependensi  "
echo "=========================================================="
export DEBIAN_FRONTEND=noninteractive

sudo apt-get update -y || true
sudo apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg62-turbo-dev \
    libgif-dev \
    librsvg2-dev \
    fontconfig || true

echo "=========================================================="
echo " [2/4] Menyiapkan Folder Wajib & Hak Akses Output        "
echo "=========================================================="
mkdir -p backend/temp backend/presets backend/outputs backend/assets \
         apps/api/temp apps/api/outputs \
         apps/web/public/fonts public/fonts outputs temp || true

chmod -R 777 backend/temp backend/outputs apps/api/temp apps/api/outputs outputs temp 2>/dev/null || true

echo "=========================================================="
echo " [3/4] Menginstal Dependensi Monorepo & Pustaka Studio   "
echo "=========================================================="
# Pastikan Node & NVM terkonfigurasi
export NVM_DIR="/usr/local/share/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" 2>/dev/null || true
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh" 2>/dev/null || true

if command -v nvm &> /dev/null; then
    nvm use 22 2>/dev/null || nvm use default 2>/dev/null || true
fi

# Aktifkan pnpm secara global
if ! command -v pnpm &> /dev/null; then
    echo "Mengaktifkan pnpm package manager..."
    corepack enable 2>/dev/null || true
    corepack prepare pnpm@10.34.6 --activate 2>/dev/null || sudo npm install -g pnpm 2>/dev/null || true
fi

# Jalankan instalasi dependensi pnpm
echo "Menjalankan instalasi paket monorepo..."
pnpm install --no-frozen-lockfile 2>/dev/null || pnpm install 2>/dev/null || npm install 2>/dev/null || true

# Download aset font studio jika skrip tersedia
if [ -f "scripts/download-fonts.js" ]; then
    echo "Mengunduh aset font lokal untuk canvas rendering..."
    node scripts/download-fonts.js 2>/dev/null || true
fi

echo "=========================================================="
echo " [4/4] Verifikasi Lingkungan Sistem                      "
echo "=========================================================="
ffmpeg -version 2>/dev/null | head -n 1 || true
node -v 2>/dev/null || true
npm -v 2>/dev/null || true
pnpm -v 2>/dev/null || true

echo ""
echo "=========================================================="
echo "   Setup Lingkungan GitHub Codespaces Berhasil Selesai!   "
echo "=========================================================="
exit 0

