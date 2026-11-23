# PRD: Flow KKPR Penilaian

## Ringkasan

Pengguna (Pelaku Usaha) yang sudah login ke aplikasi OSS dapat mengajukan **KKPR Penilaian** dengan menambahkan Kegiatan Usaha melalui menu Perizinan Berusaha.

## Requirement 1: Login

- Buka halaman login di `https://ui-login.oss.go.id/login`.
- Isi kolom username dengan kredensial test (email/telepon), dan kolom password.
- Klik tombol **"Masuk"**.
- Sistem melakukan redirect ke aplikasi perizinan (`perizinan.oss.go.id`) dan menampilkan dashboard.
- Verifikasi: berhasil masuk ke dashboard OSS.

## Requirement 2: Navigasi ke Tambah Kegiatan Usaha

- Klik menu **"Perizinan Berusaha"**.
- Klik sub-menu **"Kelola Usaha"**.
- Klik menu **"Kegiatan Usaha"**.
- Klik tombol **"Tambah Kegiatan Usaha"**.
- Verifikasi: form **Data Lokasi Usaha** muncul.

## Requirement 3: Form Data Lokasi Usaha

- Pada combobox **"Pilih lokasi usaha"**, cari dan pilih lokasi **"Automation_Darat_NonRDTR"** (Darat - Jawa Barat).
- Jawab **"Tidak"** pada pertanyaan Obvitnas dan PSN.
- Pilih perizinan lama (radio dengan value `01`).
- Klik tombol **"Selanjutnya"** setelah form valid.
- Verifikasi: berpindah ke form **Jenis Kegiatan & Bidang Usaha**.

## Requirement 4: Jenis Kegiatan & Bidang Usaha

- Pilih **Jenis Kegiatan Usaha** = **"Kegiatan Usaha Utama"**.
- Pilih **Bidang Usaha** = **"Periklanan"** (KBLI 73100 - Aktivitas Periklanan).
- Klik tombol **"Mengerti"** pada popup jika muncul.
- Pilih **Ruang Lingkup Kegiatan** = **"Seluruh"**.
- Klik tombol **"Tambah Bidang Usaha"**.
- Verifikasi: muncul popup peringatan **"RDTR Tidak Tersedia"** (karena lokasi non-RDTR).
- Klik tombol **"Mengerti"**.
- Jawab **"Tidak"** pada pertanyaan penguasaan lahan.
- Isi **Nama Usaha** = "AutomationTest KKPR_Penilaian".
- Verifikasi: nama usaha terisi, 1 baris KBLI Periklanan muncul di tabel "Daftar Bidang Usaha", teks "Kegiatan Usaha Utama" dan "73100 - Aktivitas Periklanan" tampil, tombol **"Selanjutnya"** enabled.

## Requirement 5: Cleanup

- Kembali ke menu **Daftar Kegiatan Usaha**.
- Hapus data test yang baru dibuat (baris teratas / nomor kegiatan yang baru).
- Konfirmasi penghapusan pada dialog.
- Verifikasi: toast **"Berhasil menghapus data"** muncul dan baris dengan nomor kegiatan tersebut hilang dari tabel.
