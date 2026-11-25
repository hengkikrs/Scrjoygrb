# Grab Desktop Automation Agent

## Product Requirements Document (PRD) dan Instruksi Build untuk Google AI Studio

**Versi:** 1.0\
**Platform target:** Windows 10/11 + Android\
**Tujuan:** Membantu operator memasukkan data POI (Point of Interest)
dari CSV ke formulir Grab melalui perangkat Android yang terhubung
dengan USB Debugging.

------------------------------------------------------------------------

## 1. Ringkasan Produk

Bangun aplikasi desktop Windows bernama **Grab Desktop Automation
Agent**. Aplikasi ini membaca daftar tempat/POI dari file CSV,
menghubungkan komputer ke HP Android melalui ADB, memanfaatkan scrcpy
untuk menampilkan layar HP, lalu membantu mengisi formulir POI di
aplikasi Grab secara berurutan.

Aplikasi harus bekerja sebagai **desktop automation agent / robotic
process automation (RPA)** dengan kemampuan:

1.  Membaca dan memvalidasi data dari CSV.
2.  Menampilkan daftar pekerjaan dan status setiap baris.
3.  Mengendalikan perangkat Android melalui ADB.
4.  Menggunakan screenshot, OCR, dan deteksi tampilan untuk memahami
    layar.
5.  Menavigasi formulir Grab, mengisi kolom, dan memverifikasi hasil.
6.  Menyimpan progres secara persisten agar pekerjaan dapat dilanjutkan.
7.  Melewati data yang sudah lengkap atau sudah berhasil diproses.
8.  Menghentikan proses dengan aman jika layar tidak sesuai dugaan atau
    terjadi error.

**Catatan integrasi:** scrcpy adalah alat mirroring dan kontrol layar,
bukan API integrasi aplikasi Grab. Gunakan ADB sebagai lapisan
komunikasi perangkat. scrcpy dapat dijalankan bersamaan untuk memberi
operator tampilan langsung dan kontrol manual. Jangan mengasumsikan
struktur internal Grab atau endpoint privatnya.

------------------------------------------------------------------------

## 2. Tujuan dan Batasan

### Tujuan utama

-   Mengurangi pekerjaan copy-paste manual dari CSV ke formulir Grab.
-   Memproses data secara berurutan dan konsisten.
-   Menghindari pengisian ulang data yang sudah selesai.
-   Memberikan kontrol penuh kepada operator.
-   Menyediakan log dan riwayat untuk audit serta pemulihan proses.

### Bukan tujuan

-   Membobol, memodifikasi, atau melewati mekanisme keamanan Grab.
-   Mengakses API privat atau endpoint internal tanpa izin.
-   Mengakali CAPTCHA, OTP, autentikasi, pembatasan akun, atau proteksi
    aplikasi.
-   Mengirim data tanpa verifikasi operator pada tahap yang berisiko.
-   Menjalankan proses tersembunyi tanpa indikator aktivitas.

Gunakan hanya pada akun, perangkat, dan data yang memang menjadi
kewenangan operator. Pastikan otomasi sesuai ketentuan Grab dan
kebijakan penggunaan aplikasi. Jika tersedia API atau metode impor resmi
yang diizinkan, prioritaskan metode tersebut.

------------------------------------------------------------------------

## 3. Alur Kerja Pengguna

1.  Operator membuka aplikasi desktop.
2.  Operator menghubungkan HP Android ke laptop menggunakan kabel USB.
3.  Operator mengaktifkan Developer Options dan USB Debugging.
4.  Aplikasi mendeteksi perangkat melalui `adb devices`.
5.  Operator menyetujui dialog otorisasi USB Debugging pada HP.
6.  Operator membuka aplikasi Grab dan masuk ke halaman/formulir POI
    yang benar.
7.  Operator memilih file CSV.
8.  Aplikasi memeriksa header, format nomor telepon, URL, jam
    operasional, dan status baris.
9.  Dashboard menampilkan jumlah total, siap diproses, dilewati,
    berhasil, dan gagal.
10. Operator menekan **Start**.
11. Agent mengambil satu baris yang memenuhi syarat.
12. Agent memastikan halaman/formulir yang sedang tampil sesuai dengan
    langkah yang diharapkan.
13. Agent mengisi field satu per satu.
14. Agent membaca ulang nilai yang tampil dan memvalidasi kecocokan.
15. Jika ada tombol simpan/kirim, agent berhenti pada tahap konfirmasi
    atau meminta persetujuan operator sebelum tindakan final.
16. Setelah hasil dipastikan berhasil, status baris diperbarui menjadi
    `SUCCESS`.
17. Agent melanjutkan baris berikutnya.
18. Jika terjadi error, agent mengambil screenshot, mencatat penyebab,
    lalu melakukan retry terbatas atau melewati baris sesuai pengaturan.
19. Operator dapat Pause, Resume, Stop, atau menjalankan ulang pekerjaan
    yang gagal.

------------------------------------------------------------------------

## 4. Contoh Format CSV

Gunakan UTF-8. Sistem harus mendukung delimiter koma dan titik koma,
serta menyediakan pratinjau sebelum impor.

``` csv
poi_name,phone_number,website,opening_hours,status,notes
Kopi Pagi,081234567890,https://kopipagi.example,Mon-Sun 08:00-22:00,,
Toko Sejahtera,082112223333,https://tokosejahtera.example,Mon-Sat 09:00-17:00,,
Restoran Nusantara,081298765432,,Mon-Sun 10:00-21:00,,
```

### Definisi kolom

  -----------------------------------------------------------------------
  Kolom                   Wajib                   Keterangan
  ----------------------- ----------------------- -----------------------
  `poi_name`              Ya                      Nama tempat/POI

  `phone_number`          Sesuai formulir         Nomor telepon; simpan
                                                  sebagai teks agar angka
                                                  awal 0 tidak hilang

  `website`               Tidak                   URL website

  `opening_hours`         Sesuai formulir         Jam operasional dalam
                                                  format yang disepakati

  `status`                Otomatis                Status pemrosesan

  `notes`                 Otomatis                Catatan error atau
                                                  hasil validasi
  -----------------------------------------------------------------------

Kolom status dan notes boleh tidak tersedia pada CSV awal. Aplikasi
harus menambahkannya pada data internal dan menyediakan ekspor hasil.

### Status baris

-   `PENDING`: belum diproses.
-   `IN_PROGRESS`: sedang dikerjakan.
-   `SUCCESS`: berhasil dan sudah diverifikasi.
-   `SKIPPED`: dilewati karena kosong, tidak valid, sudah lengkap, atau
    diminta operator.
-   `NEEDS_REVIEW`: hasil tidak dapat dipastikan dan perlu pemeriksaan
    manual.
-   `FAILED`: gagal setelah batas retry tercapai.

Jangan menyamakan `FAILED` dengan `SUCCESS`. Jangan menandai baris
berhasil hanya karena tombol diklik.

------------------------------------------------------------------------

## 5. Aturan Pemrosesan Data

Buat aturan yang eksplisit dan dapat dikonfigurasi.

1.  `poi_name` kosong: tandai `SKIPPED` dengan alasan
    `MISSING_POI_NAME`.
2.  Semua field yang diperlukan sudah terisi dan status sumber
    menunjukkan selesai: lewati.
3.  Field opsional kosong: jangan mengetik nilai palsu; biarkan kosong.
4.  Nomor telepon: jangan mengubahnya menjadi angka. Pertahankan tanda
    `+`, angka awal nol, dan format teks yang valid.
5.  Website: validasi format URL. Jangan menambahkan URL yang tidak
    diberikan pengguna.
6.  Opening hours: jangan menebak jadwal yang tidak tersedia. Tandai
    `NEEDS_REVIEW` jika format tidak dapat dipetakan dengan aman ke
    formulir.
7.  Jika CSV sudah memiliki status `SUCCESS`, lewati secara default.
8.  Sediakan opsi operator untuk memproses ulang baris tertentu setelah
    konfirmasi.
9.  Simpan progres setelah setiap baris, bukan hanya setelah seluruh
    batch selesai.
10. Gunakan ID baris internal yang stabil. Jangan hanya mengandalkan
    nomor baris jika file dapat diurutkan ulang.

------------------------------------------------------------------------

## 6. Arsitektur Aplikasi

Pisahkan aplikasi menjadi modul-modul berikut.

``` text
grab-desktop-agent/
├── app/
│   ├── ui/                 # Dashboard desktop
│   ├── csv_manager/        # Import, validasi, ekspor CSV
│   ├── device_manager/     # Deteksi ADB dan perangkat Android
│   ├── scrcpy_manager/     # Menjalankan/menghentikan scrcpy
│   ├── screen_capture/     # Screenshot perangkat
│   ├── vision/             # OCR dan deteksi elemen layar
│   ├── automation/         # State machine dan urutan aksi
│   ├── grab_workflow/      # Workflow formulir POI yang dikonfigurasi
│   ├── validation/         # Verifikasi nilai dan hasil
│   ├── persistence/        # Database lokal dan checkpoint
│   └── logging/            # Log aktivitas dan error
├── config/
│   ├── app_settings.json
│   └── workflow_profile.json
├── data/
│   ├── jobs.db
│   └── logs/
├── assets/
│   └── templates/
├── tests/
├── requirements.txt
└── README.md
```

### Komponen teknologi yang disarankan

  -----------------------------------------------------------------------
  Komponen                            Teknologi
  ----------------------------------- -----------------------------------
  Desktop UI                          Python + PySide6

  Android communication               Android Debug Bridge (ADB)

  Screen mirroring                    scrcpy

  Screenshot                          ADB screencap atau
                                      scrcpy-compatible capture

  Input tap/keyboard                  ADB shell input, hanya untuk
                                      interaksi yang diizinkan

  OCR                                 PaddleOCR atau Tesseract

  Image processing                    OpenCV

  CSV                                 Python `csv` / pandas

  Database lokal                      SQLite

  Background jobs                     QThread / worker queue

  Logging                             Python logging

  AI assistance (opsional)            Gemini API

  Packaging                           PyInstaller
  -----------------------------------------------------------------------

Google AI Studio dapat digunakan untuk membantu menghasilkan kode,
merancang workflow, dan mengintegrasikan Gemini API. Namun, aplikasi
desktop Windows tetap harus dijalankan secara lokal di komputer
pengguna. Jangan menempatkan kredensial perangkat atau data sensitif ke
prompt/model tanpa kebutuhan dan persetujuan yang jelas.

### Prinsip penggunaan Gemini

Gemini boleh digunakan untuk: - Membantu mengklasifikasikan teks OCR. -
Menafsirkan variasi format jam operasional. - Menjelaskan pesan error
yang sudah ditangkap. - Memberi saran pemulihan ketika tampilan tidak
dikenali.

Gemini tidak boleh menjadi satu-satunya penentu koordinat klik atau
keberhasilan penyimpanan. Semua aksi harus dibatasi oleh workflow,
validasi lokal, dan status layar. Jangan mengirim screenshot yang memuat
informasi pribadi ke layanan AI tanpa persetujuan operator.

------------------------------------------------------------------------

## 7. Device Manager: ADB dan scrcpy

### Pemeriksaan perangkat

Aplikasi harus dapat:

-   Menemukan lokasi executable `adb`.
-   Menjalankan `adb devices`.
-   Menampilkan serial perangkat yang terhubung.
-   Mendeteksi status `device`, `unauthorized`, dan `offline`.
-   Meminta operator menyetujui otorisasi pada HP jika status
    `unauthorized`.
-   Memastikan hanya perangkat yang dipilih yang dikendalikan.
-   Menangani perangkat terputus saat proses berjalan.

Contoh perintah pemeriksaan:

``` bash
adb devices
adb -s DEVICE_SERIAL get-state
adb -s DEVICE_SERIAL shell wm size
adb -s DEVICE_SERIAL shell screencap -p /sdcard/screen.png
adb -s DEVICE_SERIAL pull /sdcard/screen.png ./screen.png
```

Ganti `DEVICE_SERIAL` dengan serial yang benar-benar terdeteksi. Jangan
menjalankan perintah pada perangkat yang tidak dipilih.

### Menjalankan scrcpy

Aplikasi menyediakan tombol:

-   Connect Device
-   Launch scrcpy
-   Close scrcpy
-   Refresh Device
-   Take Screenshot

scrcpy harus dapat dijalankan sebagai proses terpisah. Simpan PID/proses
dan tangani penutupan dengan benar. Jangan menganggap scrcpy sudah
terhubung hanya karena proses berhasil dijalankan; verifikasi status ADB
juga.

### Input dan navigasi

Gunakan ADB untuk tindakan sederhana yang sesuai dan diizinkan, seperti
tap, mengetik, atau menekan tombol navigasi. Koordinat layar harus
dihitung berdasarkan resolusi perangkat dan profil layout yang telah
dikalibrasi.

Contoh perintah teknis untuk pengujian perangkat sendiri:

``` bash
adb -s DEVICE_SERIAL shell input tap 500 800
adb -s DEVICE_SERIAL shell input keyevent 4
adb -s DEVICE_SERIAL shell input text "Contoh"
```

Catatan: `input text` memiliki keterbatasan untuk karakter khusus,
spasi, emoji, dan beberapa bahasa. Implementasikan metode input teks
yang aman dan uji karakter yang diperlukan. Jangan menyimpan clipboard
atau data sensitif lebih lama dari yang dibutuhkan.

------------------------------------------------------------------------

## 8. Vision dan Pemahaman Layar

Jangan membuat workflow yang hanya mengandalkan koordinat tetap. Ukuran
layar, keyboard, dialog, scroll, dan versi aplikasi dapat mengubah
posisi elemen.

Buat lapisan vision yang mendukung:

1.  Screenshot terbaru.
2.  OCR untuk membaca label, teks field, tombol, dan pesan status.
3.  Deteksi perubahan layar sebelum dan sesudah aksi.
4.  Pencocokan template untuk elemen visual yang stabil.
5.  Profil resolusi dan kalibrasi koordinat.
6.  Confidence score untuk hasil OCR/deteksi.
7.  Screenshot bukti untuk setiap kegagalan.

### Aturan keamanan vision

-   Jika layar tidak dikenali, jangan menebak koordinat.
-   Jika confidence di bawah ambang batas, pause dan minta operator.
-   Jika muncul dialog izin, login, OTP, CAPTCHA, atau peringatan
    keamanan, hentikan otomasi dan minta operator menanganinya secara
    manual.
-   Jangan mencoba melewati mekanisme keamanan atau autentikasi.
-   Jangan menekan tombol final seperti Submit/Save tanpa kebijakan
    konfirmasi yang jelas.

------------------------------------------------------------------------

## 9. Workflow Engine sebagai State Machine

Buat workflow berbasis state machine, bukan satu skrip panjang berisi
klik berurutan.

Contoh state:

``` text
IDLE
  ↓
DEVICE_CHECK
  ↓
WAITING_FOR_OPERATOR
  ↓
SCREEN_CHECK
  ↓
OPEN_POI_FORM
  ↓
READ_NEXT_CSV_ROW
  ↓
VALIDATE_ROW
  ├── invalid/empty → MARK_SKIPPED → READ_NEXT_CSV_ROW
  └── valid
        ↓
      FILL_POI_NAME
        ↓
      VERIFY_POI_NAME
        ↓
      FILL_PHONE
        ↓
      VERIFY_PHONE
        ↓
      FILL_WEBSITE
        ↓
      VERIFY_WEBSITE
        ↓
      FILL_OPENING_HOURS
        ↓
      VERIFY_OPENING_HOURS
        ↓
      REVIEW_BEFORE_SUBMIT
        ↓
      WAIT_FOR_OPERATOR_CONFIRMATION
        ↓
      SUBMIT_IF_APPROVED
        ↓
      VERIFY_RESULT
        ├── confirmed → MARK_SUCCESS
        └── uncertain → MARK_NEEDS_REVIEW
        ↓
      SAVE_CHECKPOINT
        ↓
      READ_NEXT_CSV_ROW
```

Setiap state harus mempunyai: - Kondisi masuk. - Aksi yang
diperbolehkan. - Timeout. - Kondisi sukses. - Kondisi gagal. - Kebijakan
retry. - Screenshot/log bukti jika gagal.

### Scroll otomatis

-   Scroll hanya ketika workflow memastikan field atau bagian formulir
    berikutnya memang berada di luar layar.
-   Setelah scroll, ambil screenshot dan identifikasi ulang elemen.
-   Jangan melakukan scroll berulang tanpa memeriksa posisi dan konten
    layar.
-   Sediakan batas scroll maksimum per state.
-   Jika elemen tidak ditemukan setelah batas tercapai, pause dan minta
    pemeriksaan manual.

------------------------------------------------------------------------

## 10. Pengisian Formulir POI

Buat workflow profile yang dapat dikonfigurasi karena struktur halaman
Grab dapat berubah. Jangan mengunci asumsi bahwa urutan, label, atau
jumlah field selalu sama.

Urutan logis pengisian:

1.  Nama tempat.
2.  Nomor telepon.
3.  Website.
4.  Opening hours.

Untuk setiap field:

1.  Temukan label/field melalui OCR atau template.
2.  Pastikan field yang benar sedang aktif.
3.  Fokuskan field.
4.  Isi nilai dari CSV.
5.  Baca kembali nilai yang tampil.
6.  Normalisasi hanya untuk perbandingan, bukan mengubah data sumber
    secara diam-diam.
7.  Cocokkan hasil dengan nilai CSV.
8.  Jika tidak cocok, coba koreksi secara terbatas atau tandai
    `NEEDS_REVIEW`.

Jangan mengisi field yang tidak ada dalam CSV dengan data karangan.
Jangan menganggap field kosong berarti boleh dilewati apabila field
tersebut wajib di formulir; tandai untuk pemeriksaan.

### Konfirmasi submit

Default aplikasi adalah **Assisted Mode**: - Agent mengisi dan
memverifikasi field. - Agent menampilkan ringkasan data. - Operator
menekan tombol konfirmasi untuk melanjutkan submit. - Agent menunggu
hasil dan memverifikasinya.

Sediakan opsi Auto-submit hanya jika operator secara eksplisit
mengaktifkannya, penggunaan tersebut diizinkan, dan deteksi layar serta
validasi hasil telah lolos. Tetap hentikan proses ketika muncul
tantangan keamanan atau perubahan workflow yang tidak dikenal.

------------------------------------------------------------------------

## 11. Dashboard UI

Buat tampilan modern, profesional, dan mudah dipahami. Gunakan tema
gelap/terang, indikator status yang jelas, serta log aktivitas
real-time.

### Panel utama

**A. Device Connection** - ADB status: Connected / Unauthorized /
Offline. - Nama/serial perangkat. - Resolusi layar. - Tombol Refresh,
Connect, Launch scrcpy.

**B. CSV Data** - Tombol Import CSV. - Nama file. - Tabel preview. -
Pencarian dan filter status. - Validasi header dan jumlah baris. -
Tombol Export Results.

**C. Progress** - Total rows. - Pending. - In progress. - Success. -
Skipped. - Needs review. - Failed. - Progress bar dan persentase.

**D. Automation Controls** - Start. - Pause. - Resume. - Stop. - Retry
Failed. - Process Selected Rows. - Assisted Mode / Auto-submit (default
Assisted Mode).

**E. Live Activity Log** Contoh:

``` text
12:01:02 Device connected: Android device
12:01:08 CSV imported: poi_data.csv (120 rows)
12:01:10 Validation completed: 112 ready, 5 skipped, 3 needs review
12:01:15 Processing row 1/120: Kopi Pagi
12:01:17 POI name verified
12:01:19 Phone number verified
12:01:21 Website verified
12:01:25 Opening hours verified
12:01:26 Waiting for operator confirmation
```

**F. Current Task** - Nama POI yang sedang dikerjakan. - Field saat
ini. - Status aksi. - Screenshot layar terakhir. - Tombol Pause dan
Manual Takeover.

------------------------------------------------------------------------

## 12. Checkpoint, Database, dan Resume

Gunakan SQLite agar progres tidak hilang jika aplikasi tertutup atau
komputer restart.

Tabel yang disarankan:

### `jobs`

-   `job_id`
-   `source_filename`
-   `created_at`
-   `updated_at`
-   `total_rows`
-   `job_status`

### `poi_records`

-   `record_id`
-   `job_id`
-   `source_row_number`
-   `poi_name`
-   `phone_number`
-   `website`
-   `opening_hours`
-   `status`
-   `attempt_count`
-   `last_error`
-   `updated_at`

### `automation_logs`

-   `log_id`
-   `job_id`
-   `record_id`
-   `timestamp`
-   `level`
-   `state`
-   `message`
-   `screenshot_path` (opsional)

### Ketentuan resume

-   Simpan status setelah setiap transisi penting dan setiap baris.
-   Ketika aplikasi dibuka ulang, tampilkan pekerjaan terakhir.
-   Baris `SUCCESS` tidak diproses ulang secara default.
-   Baris `IN_PROGRESS` saat aplikasi crash harus diubah menjadi
    `NEEDS_REVIEW`, bukan langsung diulang, karena aksi submit mungkin
    sudah terjadi.
-   Baris `FAILED` hanya diproses ulang atas permintaan operator atau
    sesuai kebijakan retry.
-   Sebelum resume, periksa kembali koneksi perangkat dan kondisi layar.

------------------------------------------------------------------------

## 13. Error Handling dan Retry

Jenis error minimal:

  -------------------------------------------------------------------------
  Kode                      Kondisi                 Tindakan
  ------------------------- ----------------------- -----------------------
  `DEVICE_NOT_FOUND`        Perangkat tidak         Pause, minta cek
                            terdeteksi              kabel/ADB

  `DEVICE_UNAUTHORIZED`     Otorisasi belum         Minta operator
                            disetujui               menyetujui di HP

  `DEVICE_OFFLINE`          Perangkat terputus      Pause dan tunggu
                                                    koneksi

  `SCRCPY_FAILED`           scrcpy gagal dibuka     Tampilkan log proses

  `CSV_INVALID`             Header/format tidak     Kembali ke import
                            sesuai                  

  `SCREEN_UNKNOWN`          Layar tidak dikenali    Pause, screenshot,
                                                    manual takeover

  `FIELD_NOT_FOUND`         Field tidak ditemukan   Retry terbatas lalu
                                                    review

  `FIELD_MISMATCH`          Nilai tidak cocok       Koreksi terbatas lalu
                                                    review

  `SUBMIT_UNCONFIRMED`      Hasil submit tidak      Jangan submit ulang;
                            jelas                   tandai review

  `APP_UNEXPECTED_DIALOG`   Dialog tidak dikenal    Pause dan minta
                                                    operator
  -------------------------------------------------------------------------

Aturan retry: - Default maksimal 2 kali untuk aksi non-final. - Gunakan
timeout yang dapat dikonfigurasi. - Jangan retry submit secara otomatis
jika hasil submit pertama tidak diketahui. - Jangan mengulang aksi yang
dapat membuat entri duplikat tanpa memeriksa kondisi saat ini. - Setiap
retry harus tercatat di log.

------------------------------------------------------------------------

## 14. Pause, Stop, dan Manual Takeover

Aplikasi harus menyediakan kontrol yang benar-benar berfungsi.

**Pause** - Hentikan aksi baru. - Tunggu aksi yang sedang berjalan
mencapai titik aman. - Simpan checkpoint. - Jangan menutup scrcpy secara
paksa.

**Stop** - Hentikan workflow secara terkontrol. - Simpan status dan
log. - Jangan mengubah baris yang belum dipastikan berhasil menjadi
`SUCCESS`.

**Manual Takeover** - Hentikan sementara aksi otomatis. - Biarkan
operator mengendalikan HP melalui scrcpy. - Setelah operator selesai,
minta konfirmasi untuk mengambil alih kembali. - Ambil screenshot baru
dan validasi state sebelum melanjutkan.

------------------------------------------------------------------------

## 15. Keamanan dan Privasi

-   Simpan CSV dan database secara lokal.
-   Jangan menyimpan password Grab, OTP, token, atau kredensial akun.
-   Jangan mengunggah data POI ke layanan AI tanpa persetujuan.
-   Sediakan opsi menghapus screenshot/log yang mengandung informasi
    sensitif.
-   Batasi akses ke folder data.
-   Jangan mencatat isi clipboard atau data pribadi yang tidak relevan.
-   Jangan mengirim perintah ke perangkat selain perangkat yang dipilih.
-   Berikan indikator yang terlihat ketika otomasi aktif.
-   Sediakan tombol Stop yang mudah dijangkau.

------------------------------------------------------------------------

## 16. Pengujian dan Kriteria Penerimaan

Aplikasi dianggap memenuhi MVP jika seluruh hal berikut berhasil:

### CSV

-   [ ] Dapat mengimpor CSV UTF-8.
-   [ ] Dapat mengenali delimiter koma dan titik koma.
-   [ ] Dapat mempertahankan nomor telepon dengan angka awal nol.
-   [ ] Dapat memvalidasi header dan baris kosong.
-   [ ] Dapat melewati baris yang sudah `SUCCESS`.
-   [ ] Dapat mengekspor hasil dengan status dan catatan.

### Perangkat

-   [ ] Dapat mendeteksi perangkat melalui ADB.
-   [ ] Dapat membedakan `device`, `unauthorized`, dan `offline`.
-   [ ] Dapat menjalankan scrcpy.
-   [ ] Dapat mengambil screenshot.
-   [ ] Dapat mendeteksi perangkat terputus.

### Otomasi

-   [ ] Memiliki state machine.
-   [ ] Dapat mengisi field yang telah dikonfigurasi.
-   [ ] Memverifikasi nilai setelah pengisian.
-   [ ] Dapat scroll dan memeriksa ulang layar.
-   [ ] Berhenti jika layar tidak dikenali.
-   [ ] Tidak menekan submit final tanpa kebijakan persetujuan.
-   [ ] Tidak mengulang submit ketika hasil sebelumnya belum diketahui.

### Pemulihan

-   [ ] Dapat Pause, Resume, dan Stop.
-   [ ] Dapat melanjutkan pekerjaan dari checkpoint.
-   [ ] Tidak menandai pekerjaan yang belum pasti sebagai berhasil.
-   [ ] Menyimpan log error dan screenshot bukti.

------------------------------------------------------------------------

## 17. Tahapan Pengembangan

Jangan membangun semua fitur sekaligus. Kerjakan bertahap dan pastikan
setiap tahap bisa dijalankan.

### Phase 1 --- Desktop foundation

-   Buat aplikasi PySide6.
-   Buat dashboard dan log.
-   Buat import CSV, preview, validasi, serta ekspor.
-   Buat database SQLite dan status pekerjaan.

**Hasil:** aplikasi desktop dapat mengelola data tanpa mengendalikan HP.

### Phase 2 --- Android connection

-   Integrasikan ADB.
-   Deteksi perangkat.
-   Tampilkan status USB Debugging.
-   Jalankan dan hentikan scrcpy.
-   Ambil screenshot perangkat.

**Hasil:** aplikasi desktop dapat terhubung ke HP dan menampilkan bukti
layar.

### Phase 3 --- Vision foundation

-   Tambahkan OCR.
-   Tampilkan hasil OCR pada screenshot.
-   Buat kalibrasi resolusi dan koordinat.
-   Buat deteksi layar dikenal/tidak dikenal.

**Hasil:** aplikasi dapat membaca tampilan dan menolak aksi saat layar
tidak dikenali.

### Phase 4 --- Assisted form filling

-   Buat workflow profile.
-   Isi satu field dalam satu waktu.
-   Verifikasi nilai setiap field.
-   Tambahkan Pause dan Manual Takeover.
-   Minta konfirmasi operator sebelum submit.

**Hasil:** agent dapat membantu mengisi satu record secara terkontrol.

### Phase 5 --- Batch processing

-   Proses beberapa record.
-   Lewati data kosong atau selesai.
-   Simpan checkpoint.
-   Tambahkan retry terbatas dan ekspor hasil.

**Hasil:** batch automation dapat dilanjutkan setelah jeda atau
gangguan.

### Phase 6 --- Optional AI assistance

-   Integrasikan Gemini untuk membantu interpretasi OCR atau format jam.
-   Tetapkan schema output yang ketat.
-   Validasi semua hasil AI secara lokal.
-   Sediakan mode tanpa AI jika API tidak tersedia.

**Hasil:** AI menjadi pendukung, bukan pengendali bebas atas HP.

------------------------------------------------------------------------

# 18. Master Prompt untuk Google AI Studio

Salin instruksi berikut ke Google AI Studio untuk memulai pembangunan
aplikasi.

------------------------------------------------------------------------

**PERAN**

Kamu adalah senior software engineer, desktop application architect,
Python automation engineer, dan QA engineer. Bangun aplikasi Windows
bernama **Grab Desktop Automation Agent** berdasarkan spesifikasi dalam
dokumen ini.

**TUJUAN**

Buat aplikasi desktop Python yang mengelola CSV berisi data POI dan
membantu operator mengisi formulir Grab pada HP Android yang terhubung
melalui USB Debugging. Gunakan ADB untuk komunikasi perangkat dan scrcpy
untuk screen mirroring. Aplikasi harus memiliki dashboard, CSV manager,
device manager, OCR/vision layer, workflow state machine, database
SQLite, logging, checkpoint, dan kontrol manual.

**ATURAN IMPLEMENTASI**

1.  Gunakan Python dan PySide6 untuk desktop UI.
2.  Gunakan ADB sebagai lapisan komunikasi Android.
3.  Integrasikan scrcpy sebagai proses eksternal yang dapat dikendalikan
    dari dashboard.
4.  Gunakan SQLite untuk menyimpan job, record, status, dan log.
5.  Pisahkan setiap modul sesuai struktur proyek.
6.  Gunakan worker thread agar UI tidak freeze selama proses ADB, OCR,
    atau otomasi.
7.  Semua proses harus memiliki timeout, exception handling, logging,
    dan cancellation.
8.  Jangan hardcode koordinat layar sebagai satu-satunya metode deteksi.
9.  Gunakan OCR, screenshot, template matching, dan validasi state.
10. Jangan melakukan aksi jika layar tidak dikenali atau confidence
    terlalu rendah.
11. Jangan mengakali CAPTCHA, OTP, login, atau mekanisme keamanan.
12. Default workflow adalah Assisted Mode dengan konfirmasi operator
    sebelum submit.
13. Jangan retry submit apabila hasil submit sebelumnya belum diketahui.
14. Simpan checkpoint setelah setiap record.
15. Baris yang telah `SUCCESS` dilewati secara default.
16. Buat mock device dan mock Grab workflow agar seluruh aplikasi dapat
    diuji tanpa HP.
17. Jangan mengarang selector, koordinat, urutan halaman, atau detail
    internal Grab. Buat konfigurasi workflow yang dapat dikalibrasi
    operator.
18. Jangan mengklaim fitur sudah berfungsi jika baru berupa placeholder.
    Tandai dengan jelas fitur yang belum diimplementasikan.

**CARA BEKERJA**

Bangun aplikasi secara bertahap:

-   Tahap 1: struktur proyek, dashboard, CSV import/export, validasi,
    SQLite.
-   Tahap 2: ADB device manager dan integrasi scrcpy.
-   Tahap 3: screenshot, OCR, dan vision interface.
-   Tahap 4: workflow state machine dan mock form filling.
-   Tahap 5: assisted automation, verifikasi field, dan operator
    confirmation.
-   Tahap 6: batch processing, checkpoint, retry, dan resume.
-   Tahap 7: pengujian, packaging Windows, dan dokumentasi.

Pada setiap tahap: - Tampilkan file yang dibuat dan isi kode
lengkapnya. - Pastikan import dan dependensi konsisten. - Berikan
perintah instalasi dan cara menjalankan. - Jalankan atau rancang unit
test untuk fungsi utama. - Jangan menghapus fitur yang sudah selesai
ketika menambahkan fitur baru. - Jika ada informasi yang belum tersedia,
buat interface/configuration point dan tanyakan hal yang benar-benar
diperlukan; jangan mengarang perilaku aplikasi Grab.

**DEFINITION OF DONE**

MVP dinyatakan selesai jika: - Aplikasi berjalan di Windows. - CSV dapat
diimpor, divalidasi, dan diekspor. - Perangkat Android dapat dideteksi
melalui ADB. - scrcpy dapat dibuka dari dashboard. - Screenshot dapat
diambil. - Data dapat diproses melalui mock workflow. - Status dan
checkpoint tersimpan di SQLite. - Assisted Mode dapat mengisi field yang
sudah dikonfigurasi dan memverifikasi hasil. - Operator dapat Pause,
Resume, Stop, dan Manual Takeover. - Error tidak menyebabkan data
ditandai berhasil secara keliru.

Mulai dari **Phase 1**. Jangan langsung membuat seluruh proyek dalam
satu jawaban jika hal tersebut membuat kode tidak lengkap atau sulit
diuji. Prioritaskan fondasi yang benar, modular, dan dapat dijalankan.

------------------------------------------------------------------------

## 19. Informasi yang Perlu Disiapkan Sebelum Integrasi Grab

Agar workflow bisa dikalibrasi dengan benar, siapkan:

1.  Screenshot halaman Grab sebelum formulir POI dibuka.
2.  Screenshot formulir POI yang memperlihatkan seluruh field.
3.  Screenshot bagian formulir setelah scroll.
4.  Screenshot kondisi setelah tombol simpan/submit ditekan.
5.  Contoh CSV dengan 3--5 baris data dummy.
6.  Informasi resolusi HP dan versi Android.
7.  Versi scrcpy dan ADB yang terpasang.

Jangan menyertakan password, OTP, nomor akun, atau informasi pribadi
pada screenshot contoh. Samarkan data sensitif.

**Penting:** struktur UI Grab dapat berubah sewaktu-waktu dan mungkin
berbeda antarversi atau akun. Karena itu, workflow harus dapat
dikonfigurasi dan diuji ulang, bukan mengandalkan satu rangkaian
koordinat yang dianggap permanen.

------------------------------------------------------------------------

## 20. Rekomendasi MVP

Mulai dengan target kecil:

-   1 perangkat Android.
-   1 file CSV.
-   1 workflow formulir POI.
-   4 field: nama, nomor telepon, website, opening hours.
-   Assisted Mode.
-   Konfirmasi manual sebelum submit.
-   Simpan status setiap record.
-   Resume setelah aplikasi ditutup.

Setelah versi ini stabil, baru tambahkan batch processing yang lebih
besar dan fitur AI.

**Prinsip utama:** akurasi dan keamanan data lebih penting daripada
kecepatan klik. Agent harus tahu kapan harus melanjutkan, kapan harus
melewati record, dan kapan harus berhenti untuk meminta bantuan
operator.
