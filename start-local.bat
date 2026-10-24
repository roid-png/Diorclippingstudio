@echo off
title DIOR Clipping Studio - Localhost (Port 3000 & 5000)
echo ======================================================================
echo    🎬 DIOR CLIPPING STUDIO - RUNNING ON LOCALHOST
echo    ⚡ Optimized for Laptop Intel Core i5 / RAM 8 GB
echo ======================================================================
echo.
echo [1/2] Memastikan dependencies dan file environment siap...
cd /d "%~dp0"

if not exist ".env" (
  if exist ".env.example" (
    echo Menggandakan .env.example ke .env...
    copy .env.example .env
  )
)

echo [2/2] Menjalankan Backend API (Port 5000) dan Web Studio (Port 3000)...
echo.
echo ----------------------------------------------------------------------
echo  🌐 Buka browser Anda di: http://localhost:3000
echo  🎵 Backend API aktif di: http://localhost:5000
echo  Tekan Ctrl+C untuk menghentikan server.
echo ----------------------------------------------------------------------
echo.

npm run dev:all
pause

