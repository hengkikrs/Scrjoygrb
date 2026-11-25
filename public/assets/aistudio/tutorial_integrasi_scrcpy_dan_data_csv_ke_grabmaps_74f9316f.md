# Tutorial Alur Kerja: Integrasi `scrcpy` dan Data CSV ke GrabMaps

Dokumen ini menjelaskan langkah-langkah sistematis untuk memindahkan data lokasi dari file **CSV** ke formulir kontribusi peta (**GrabMaps - Memetakan Dunia Bersama**) pada perangkat Android yang di-*mirroring* menggunakan **`scrcpy`**. Struktur panduan ini disusun agar mudah dipahami baik untuk eksekusi manual maupun sebagai acuan pembuatan skrip otomatisasi di **Google AI Studio**.

---

## 1. Persiapan Lingkungan (Workspace Setup)

Sebelum memulai proses input data, pastikan lingkungan kerja sudah diatur sebagai berikut:
1. **Layar Sisi Kiri (`scrcpy`):** Hubungkan perangkat Android ke PC/laptop dan jalankan `scrcpy` sehingga layar HP tampil dan dapat dikontrol menggunakan mouse serta keyboard (termasuk fitur *copy-paste* clipboard `Ctrl+C` / `Ctrl+V`).
2. **Layar Sisi Kanan (Data CSV):** Buka file CSV yang berisi daftar lokasi (misalnya melalui WPS Office, Excel, atau dibaca langsung via skrip).

---

## 2. Pemetaan Data (CSV ke UI GrabMaps)

Berikut adalah pemetaan kolom dari file CSV ke kolom input pada aplikasi GrabMaps:

| Kolom CSV | Nama Header | Target Elemen UI di GrabMaps | Keterangan / Aturan |
| :--- | :--- | :--- | :--- |
| **Kolom A** | `Name` | Kolom Pencarian (`Cari`) | Digunakan untuk mencari titik lokasi di peta. |
| **Kolom B** | `Phone Number` | `Kontak/situs web` *(Fallback)* | Digunakan jika kolom `Website` pada baris tersebut kosong. |
| **Kolom C** | `Latitude, Longitude` | *(Opsional / Referensi)* | Dapat digunakan untuk memverifikasi keakuratan lokasi hasil pencarian. |
| **Kolom D** | `Website` | `Kontak/situs web` *(Utama)* | Prioritas utama untuk mengisi informasi kontak/situs web. |
| **Kolom E** | `Opening Hours` | `Jam buka` | Format contoh: `senin-sabtu(07:00-16:00), minggu(tutup)`. |

---

## 3. Langkah-Langkah Alur Kerja (Step-by-Step)

### Tahap 1: Membuka GrabMaps di `scrcpy`
1. Pada jendela `scrcpy`, buka menu pencarian aplikasi (*App Drawer*) dan ketik **`grab`**.
2. Klik ikon aplikasi **Grab** dan tunggu hingga halaman utama selesai dimuat.
3. Gulir (*scroll*) sedikit ke bawah pada halaman utama Grab, lalu klik widget/bagian peta (**GrabMaps**) untuk masuk ke tampilan peta eksplorasi.

---

### Tahap 2: Proses Input Data per Baris (Looping CSV)

Ulangi langkah-langkah berikut untuk setiap baris data mulai dari **Baris ke-2** hingga baris terakhir pada file CSV:

#### A. Pencarian Lokasi
1. **Salin Nama Lokasi:** Pilih sel pada **Kolom A (`Name`)** untuk baris aktif (contoh: `SMA N 1 Sukoharjo`), lalu salin (`Ctrl+C`).
2. **Tempel di Pencarian:** Klik kolom pencarian **`Cari`** di bagian atas tampilan GrabMaps pada `scrcpy`, lalu tempel (`Ctrl+V`).
3. **Pilih Hasil Pencarian:** Tunggu daftar saran lokasi muncul, lalu klik hasil yang nama dan alamatnya paling sesuai dengan data CSV.
4. **Buka Detail Lokasi:** Tunggu hingga pin peta mengarah ke lokasi dan kartu informasi tempat muncul di bagian bawah layar.

#### B. Membuka Formulir Kontribusi
5. Gulir ke bawah pada kartu detail tempat hingga menemukan banner *"Tahu tempat ini? Tambahkan info untuk menyempurnakan peta kami!"*.
6. Klik tombol **`Sempurnakan tempat`**.
7. Tunggu hingga halaman formulir berjudul **`Memetakan Dunia Bersama`** selesai dimuat.

#### C. Pengisian Formulir "Memetakan Dunia Bersama"
8. **Status Tempat:** Pada pertanyaan *"Apakah Anda sudah menemukan toko/bisnisnya?"*, pilih opsi **`Ditemukan dan buka`**.
9. *(Lewati bagian catatan koreksi nama dan unggah foto jika tidak diperlukan).*
10. **Isi Jam Buka:**
    - Beralih ke file CSV, salin data dari **Kolom E (`Opening Hours`)** pada baris yang sama.
    - Gulir halaman formulir di `scrcpy` ke bagian **`Jam buka`**, klik kolom inputnya, lalu tempel (`Ctrl+V`).
11. **Pilih Fasilitas:**
    - Gulir ke bagian **`Fasilitas`**.
    - Centang kotak **`Tempat parkir`** dan **`Toilet/Kamar Mandi`** (sesuaikan dengan kondisi kategori lokasi).
12. **Isi Kontak/Situs Web:**
    - Gulir ke bagian **`Kontak/situs web`**.
    - Periksa **Kolom D (`Website`)** pada baris yang sama di CSV:
      - **Jika ada isinya:** Salin URL dari **Kolom D**, lalu tempel ke kolom `Kontak/situs web`.
      - **Jika kosong:** Salin nomor telepon dari **Kolom B (`Phone Number`)** pada baris yang sama, lalu tempel ke kolom `Kontak/situs web`.
13. **Konfirmasi Kepemilikan:**
    - Pada pertanyaan *"Apakah Anda pemilik/orang yang dapat dihubungi untuk lokasi ini?"*, pilih opsi **`Tidak`**.

#### D. Pengiriman & Persiapan Iterasi Berikutnya
14. Klik tombol hijau **`Submit`** di bagian bawah layar.
15. Tunggu hingga muncul notifikasi hijau **`Success`** di bagian atas layar dan aplikasi otomatis kembali ke halaman detail tempat.
16. Klik ikon **panah kembali (`<`)** di pojok kiri atas layar `scrcpy` untuk kembali ke halaman utama pencarian GrabMaps.
17. Pindah ke **baris berikutnya** pada file CSV (misalnya dari Baris 2 ke Baris 3: `SMA N 1 KALIREJO`) dan ulangi dari **Langkah 1 (Bagian A)**.

---

## 4. Catatan Teknis & Penanganan Edge Cases (Untuk Integrasi AI Studio)

Jika dokumen ini digunakan di **Google AI Studio** untuk merancang skrip otomatisasi (seperti Python + ADB / UIAutomator2 / PyAutoGUI + Pandas), perhatikan beberapa hal berikut:

- **Sinkronisasi Baris Data (Row Consistency):** Pastikan indeks baris tetap konsisten saat mengambil data dari kolom `Name`, `Opening Hours`, `Website`, dan `Phone Number` agar data dari baris sebelumnya tidak tertukar saat kolom `Website` kosong.
- **Logika Fallback Kontak:**
  ```text
  kontak = row['Website'] if not empty(row['Website']) else row['Phone Number']
  ```
- **Penanganan Waktu Tunggu (*Delay / Explicit Wait*):**
  - Beri jeda 2–3 detik setelah menempel teks di kolom `Cari` agar daftar *autocomplete* muncul sempurna.
  - Beri jeda 3–5 detik setelah klik `Sempurnakan tempat` karena halaman formulir berbasis webview membutuhkan waktu muat.
  - Pastikan indikator notifikasi `Success` muncul (atau halaman kembali ke detail tempat) sebelum mengeksekusi tombol *Back*.
- **Scrolling Dinamis:** Posisi elemen `Jam buka`, `Fasilitas`, dan `Kontak/situs web` memerlukan aksi *scroll* vertikal. Jika menggunakan otomatisasi berbasis ADB/UIAutomator, sebaiknya gunakan pencarian elemen berdasarkan teks/ID (*scrollable selector*) daripada koordinat layar statis.

---

## 5. Ringkasan Alur (Pseudocode)

```text
START
  Buka Grab via scrcpy -> Masuk ke GrabMaps

  FOR setiap baris dalam data.csv:
      1. Klik kolom "Cari" -> Input baris['Name']
      2. Tunggu hasil -> Klik lokasi yang sesuai
      3. Klik "Sempurnakan tempat"
      4. Tunggu halaman "Memetakan Dunia Bersama"
      5. Klik "Ditemukan dan buka"
      6. Scroll ke "Jam buka" -> Input baris['Opening Hours']
      7. Scroll ke "Fasilitas" -> Centang "Tempat parkir" & "Toilet/Kamar Mandi"
      8. Scroll ke "Kontak/situs web" -> Input baris['Website'] (atau baris['Phone Number'] jika Website kosong)
      9. Pilih "Tidak" pada pertanyaan pemilik lokasi
      10. Klik "Submit" -> Tunggu notifikasi "Success"
      11. Klik tombol Kembali ("<") ke halaman pencarian
  END FOR
END
```