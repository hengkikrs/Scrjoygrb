# Grab Desktop Automation Agent

Aplikasi operator RPA untuk membantu pengisian data POI Grab secara terkontrol (Assisted Mode sebagai default) dengan dukungan impor CSV UTF-8, jembatan ADB & scrcpy, verifikasi OCR, dan checkpoint persisten dengan pemulihan crash.

Tersedia **dua cara** untuk membuka dan menjalankan aplikasi ini secara lokal di komputer Anda:

---

## Opsi 1: Jalankan Web Workbench di Localhost (Windows / macOS / Linux)

### Prasyarat
- **Node.js 20+** (`node -v`)
- Opsional untuk kontrol HP Android nyata: **Android Platform-Tools (`adb`)** dan **`scrcpy`** di PATH sistem (atau atur path manual di tab **Perangkat & Vision**).

### Langkah Menjalankan
1. Instal dependensi:
   ```bash
   npm install
   ```
2. *(Opsional)* Jika ingin menggunakan fitur Asisten AI (normalisasi jam operasional / penjelasan error), salin `.env.example` menjadi `.env.local` lalu isi `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env.local
   ```
3. Jalankan server lokal di port `3000`:
   ```bash
   npm run dev
   ```
4. Buka browser dan kunjungi:
   ```
   http://localhost:3000
   ```
5. Untuk menghubungkan HP Android USB nyata:
   - Aktifkan **USB Debugging** pada HP Android dan sambungkan lewat kabel USB.
   - Buka tab **Perangkat & Vision**, klik **Pindai ADB Lokal**, pilih perangkat USB yang terdeteksi, lalu klik **Launch scrcpy**.

---

## Opsi 2: Aplikasi Desktop Windows Native (Python + PySide6 + `.exe`)

Jika Anda ingin membuka aplikasi sebagai **program desktop Windows mandiri** (tanpa browser):

1. Buka aplikasi web ini, masuk ke tab **Desktop Agent**.
2. Klik **Unduh Paket Desktop Windows (.zip)** (atau unduh langsung dari `/api/download/desktop-agent`).
3. Ekstrak file `grab-desktop-agent-windows.zip` ke folder lokal, misalnya `C:\grab-desktop-agent`.
4. Klik dua kali **`run_windows.bat`** — skrip akan otomatis membuat virtual environment Python (`.venv`), memasang dependensi (`PySide6`, `Pillow`, `rapidocr-onnxruntime`), dan membuka jendela aplikasi desktop.
5. Untuk mengemas menjadi file `.exe` mandiri, jalankan **`build_exe.bat`** (hasil berada di `dist/GrabDesktopAgent.exe`).

---

## Pengujian Unit
Jalankan seluruh unit test inti:
```bash
npx --yes tsx --test lib/csv-parser.test.ts lib/state-machine.test.ts lib/workflow-validation.test.ts lib/local-runtime.test.ts
```
