#!/usr/bin/env bash
set -e
echo "Downloading Creator Fonts Suite..."
node backend/scripts/download_fonts.mjs
echo "Creator Fonts Suite Download Complete!"
