# 🚀 Panduan Penggunaan GitHub Codespaces: DIOR Clipping Studio

Dokumentasi ini memandu Anda menjalankan **DIOR Clipping Studio** langsung di cloud menggunakan **GitHub Codespaces** dengan lingkungan yang sudah terkonfigurasi otomatis (Node.js 20, FFmpeg, dependensi kompilasi Canvas C++, font studio, port forwarding, dan CORS).

---

## 📋 Langkah 1: Push Perubahan ke GitHub (Dari Komputer Lokal)

Sebelum membuat container di cloud, pastikan seluruh konfigurasi Codespaces terbaru telah terunggah ke repositori GitHub Anda:

Buka terminal pada direktori proyek dan jalankan:
```bash
git add .
git commit -m "feat: add codespaces config and devcontainer automation"
git push origin main
```
*(Catatan: Jika branch utama Anda bernama `master`, sesuaikan dengan `git push origin master`)*.

---

## ☁️ Langkah 2: Membuka Repositori di GitHub Codespaces

1. Buka halaman repositori GitHub Anda di browser: `https://github.com/USERNAME/REPO_NAME`.
2. Klik tombol hijau bertuliskan **`Code`** di sudut kanan atas daftar file.
3. Pilih tab **`Codespaces`**.
4. Klik tombol **`Create codespace on main`** (atau klik ikon **`+`**).
5. GitHub Codespaces akan otomatis:
   - Membangun container Linux Debian Bullseye dengan Node.js 20.
   - Menjalankan `.devcontainer/setup.sh` untuk menginstal **FFmpeg**, library sistem C++ Canvas (`libcairo2-dev`, `libpango1.0-dev`, dll.), font Montserrat, dan dependensi monorepo.
   - Membuka VS Code berbasis web di browser Anda dalam beberapa saat.

---

## 🔑 Langkah 3: Menyiapkan API Key (Environment Variables)

Ada dua metode mudah untuk memasukkan API Key Gemini & Groq Anda di Codespaces:

### Metode A: Menggunakan File `.env` (Paling Cepat)
Di terminal Codespaces (menu `Terminal` -> `New Terminal`), jalankan:
```bash
cp .env.example .env
nano .env
```
Isi API key Anda pada baris yang sesuai (khususnya `GEMINI_API_KEY` dan `GROQ_API_KEY_PRIMARY`), lalu simpan (`Ctrl + O`, `Enter`, lalu `Ctrl + X`).

### Metode B: Menggunakan GitHub Secrets (Permanen & Aman)
1. Di repositori GitHub, buka tab **Settings** -> **Secrets and variables** -> **Codespaces**.
2. Klik **New repository secret**.
3. Tambahkan key seperti `GEMINI_API_KEY` dan `GROQ_API_KEY_PRIMARY`. Secret ini akan otomatis terbaca setiap kali Codespace baru dibuat.

---

## ▶️ Langkah 4: Menyalakan Aplikasi (1 Perintah)

Di terminal Codespaces, cukup ketik:

```bash
npm run dev:all
# atau
pnpm run dev:all
```

Perintah di atas secara bersamaan (*concurrently*) akan menyalakan:
1. **Backend API & Media Server** (`backend/server.ts`) pada `http://0.0.0.0:5000`
2. **Frontend Studio Web App** pada `http://0.0.0.0:3000`

### 🌐 Mengakses Aplikasi di Browser:
- Begitu server menyala, GitHub Codespaces akan menampilkan notifikasi pop-up di pojok kanan bawah:
  > *"Your application running on port 3000 is available."*
- Klik tombol **`Open in Browser`**.
- Aplikasi **DIOR Clipping Studio** akan langsung terbuka di tab baru browser Anda via domain publik Codespaces (misal: `https://xxxx-3000.app.github.dev/app`).

---

## 🛠️ Ringkasan Konfigurasi Teknis yang Diotomasi

| Komponen | Konfigurasi Codespaces | Fungsi / Manfaat |
| :--- | :--- | :--- |
| **Port 3000** | Forwarded (`visibility: public`) | Frontend UI Studio TanStack / Vite |
| **Port 5000** | Forwarded (`visibility: public`) | Backend Express API & Streaming Media Server |
| **Host Binding** | `0.0.0.0` | Memungkinkan routing keluar dari container virtual Codespaces |
| **CORS Policy** | Mengizinkan `*.app.github.dev` & `localhost:3000` | Mencegah blokir browser saat request API dan transfer token |
| **Streaming Media** | HTTP 206 Range + CORP `cross-origin` | Video preview hasil klip dapat discrub & diputar langsung tanpa lag |
| **System Packages** | FFmpeg, Pango, Cairo, Montserrat Fonts | Rendering video canvas dan motion animation berjalan 100% native |

---

## 💡 Troubleshooting Cepat

- **Port Belum Public?**
  Jika video atau API tidak merespons, buka tab **`PORTS`** di panel bawah VS Code Codespaces, klik kanan pada port **3000** dan **5000**, lalu ubah **Port Visibility** menjadi **Public**.
- **Periksa Status FFmpeg**:
  Ketik `ffmpeg -version` di terminal Codespaces untuk memastikan engine video siap digunakan.

