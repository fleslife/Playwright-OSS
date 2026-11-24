# Skill: Otomasi Skenario SKPBKI (KKPR Kondisi Tertentu)

Panduan kerja untuk spec Playwright alur **SKPBKI** (Surat Keterangan Pengecualian
Berlokasi di Kawasan Industri) pada OSS staging.

- Spec acuan: `tests/Staging/Darat_SKPBKI.spec.js`
- Spec dasar: `tests/Staging/Darat_KKPR_Penilaian.spec.js` (skeleton + modal Pernyataan)
- Kerangka & jebakan bersama: `docs/SKILL_PKKPR_Scenarios.md`
- File upload uji: `tests/UploadFile/SampleDocument.pdf`

Status: **Lolos** di staging/chromium. Dua run terakhir 37.0s & 38.8s.

---

## 1. Ringkasan parameter

| Item | Nilai |
| --- | --- |
| KBLI | `15201` — Industri Alas Kaki untuk Keperluan Sehari-hari |
| Ruang lingkup | `Seluruh` (satu-satunya opsi; pilih dari `.v-overlay--active`) |
| Nama usaha test | `AutomationTest SKPBKI` |
| Lokasi | `Automation_Darat_NonRDTR` |
| Upload | `input[type="file"]` langsung (bukan tombol `Pilih Dokumen`) |
| Modal Pernyataan 7 poin | **ada** |

---

## 2. Objek unik SKPBKI

Letaknya di langkah **Jenis Kegiatan & Bidang Usaha**, persis setelah field `Nama Usaha`:

1. Pertanyaan **"Apakah Usaha Anda termasuk skala Menengah atau Besar?"** → jawab `Ya`.
2. Setelah `Ya`, muncul keterangan **"Nilai investasi > 10M atau nilai pendapatan
   tahunan > 50 M"** (perhatikan **spasi** setelah `>`).
3. Checkbox pernyataan: **"Dengan ini menyatakan bersedia dilakukan verifikasi
   kegiatan industri yang berada di luar kawasan industri."** → wajib dicentang,
   jika tidak tombol `Selanjutnya` tetap disabled.
4. Pertanyaan penguasaan lahan → jawab `Tidak` agar tidak masuk blok Penguasaan Lahan.

### Locator radio skala usaha

Radio ini **menolak** `check()` walaupun dengan `force: true`
(`Clicking the checkbox did not change its state`). Klik label teksnya:

```js
const pertanyaanSkala = page
  .getByText("Apakah Usaha Anda termasuk skala Menengah atau Besar?", { exact: false })
  .first();
const grupSkala = pertanyaanSkala.locator("xpath=ancestor::*[.//input[@type='radio']][1]");
const radioYaSkala = grupSkala.getByRole("radio", { name: "Ya", exact: true });

await grupSkala.getByText("Ya", { exact: true }).first().click();
await expect(radioYaSkala).toBeChecked({ timeout: 60000 });
```

### Locator checkbox pernyataan

Tidak memakai id tetap (`checkbox-v-*` dipakai MBR dan tidak stabil di sini).
Scope dari teks pernyataannya:

```js
const pernyataanVerifikasi = page
  .getByText("Dengan ini menyatakan bersedia dilakukan verifikasi kegiatan industri", { exact: false })
  .first();
const checkboxVerifikasi = pernyataanVerifikasi
  .locator("xpath=ancestor::*[.//input[@type='checkbox']][1]")
  .locator("input[type='checkbox']")
  .first();

await checkboxVerifikasi.check({ force: true, timeout: 30000 });
```

### Assertion keterangan investasi

UI memakai spasi (`> 10M`), bukan `>10M` seperti teks desain. Pakai regex:

```js
await expect(
  page.getByText(/Nilai investasi\s*>\s*10M atau nilai pendapatan tahunan\s*>\s*50 M/).first()
).toBeVisible({ timeout: 60000 });
```

---

## 3. Hasil: SKPBKI menerbitkan **dua** dokumen

Ini pembeda utama dari skenario lain. Keduanya harus diverifikasi dalam satu baris
tabel yang sama (nama + status), karena `getByText` bisa cocok ke baris lain:

| No | Nama Dokumen | Status |
| --- | --- | --- |
| 1 | `Persetujuan KKPR Penilaian (Utama)` | `Belum melengkapi persyaratan` |
| 2 | `Pengecualian Berlokasi di Kawasan Industri (Utama)` | `Menunggu Verifikasi K/L` |

```js
const dokumenYangDiharapkan = [
  { nama: "Persetujuan KKPR Penilaian (Utama)", status: "Belum melengkapi persyaratan" },
  { nama: "Pengecualian Berlokasi di Kawasan Industri (Utama)", status: "Menunggu Verifikasi K/L" },
];

for (const { nama, status } of dokumenYangDiharapkan) {
  const barisDokumen = page.getByRole("row").filter({ hasText: nama }).first();
  await expect(barisDokumen).toBeVisible({ timeout: 120000 });
  await expect(barisDokumen).toContainText(status, { timeout: 60000 });
}
```

Catatan: dokumen #1 berstatus `Belum melengkapi persyaratan` (bukan "Menunggu
verifikasi"). Jangan menyalin assertion MBR/Migas ke sini.

---

## 4. Jalur tunggal (jangan buat percabangan)

Beberapa elemen di skenario ini **selalu** ada, sehingga tidak perlu
`if (count())` / `if (muncul)`. Percabangan hanya menambah noise dan menyembunyikan
regresi. Nilai di bawah sudah dikonfirmasi lewat probe pada staging:

| Elemen | Hasil di staging | Perlakuan di spec |
| --- | --- | --- |
| `input[type="file"]` Rencana Teknis | **ada** (count = 1) | `setInputFiles` langsung |
| Modal Pernyataan 7 poin | **muncul** | wajib diisi, tanpa cabang |
| Popup `PENYESUAIAN KBLI` / `RDTR` | kondisional | tetap lewat `tutupPopupJikaMuncul` |

Popup tetap dibuat kondisional karena kemunculannya bergantung data master
(RDTR lokasi bisa tersedia sewaktu-waktu), sedangkan upload dan modal tidak.

---

## 5. Urutan langkah

1. `login(page, { environment: "staging", zoomOut: true })`
2. `Perizinan Berusaha` → `Kelola Usaha` → `Kegiatan Usaha` → `Tambah Kegiatan Usaha`
3. Lokasi `Automation_Darat_NonRDTR`; `Tidak` ×2; radio `value="01"`; `Selanjutnya`
4. `Kegiatan Usaha Utama`; KBLI `15201`; tutup popup penyesuaian KBLI
5. Ruang lingkup `Seluruh`; `Tambah Bidang Usaha`; tutup popup RDTR bila ada
6. Assert baris bidang usaha berisi `15201` dan `Seluruh`
7. Isi `Nama Usaha`
8. **Blok SKPBKI**: radio skala `Ya` → assert keterangan investasi → centang
   checkbox pernyataan industri → penguasaan lahan `Tidak`
9. `Selanjutnya`
10. Rencana Teknis: upload via `input[type="file"]` → `Ya` bangunan baru →
    `Milik Sendiri` → jumlah 1 / lantai 2 / luas 100
11. `tungguUploadSelesai(page)` → `Proses`
12. Centang 7 checkbox modal Pernyataan → `Proses`
13. Assert **dua** dokumen + statusnya (lihat bagian 3)

---

## 6. Jebakan yang sudah terverifikasi

1. **Radio skala tidak bisa di-`check`** → klik label `Ya` di dalam grup.
2. **Spasi pada keterangan investasi** → `> 10M`, bukan `>10M`.
3. **Assertion dokumen pertama bukan "Menunggu"** → statusnya
   `Belum melengkapi persyaratan`.
4. **Dua dokumen, satu tabel** → assert per baris, jangan global `getByText`.
5. **Jangan menyalin blok Migas/MBR** — SKPBKI tidak memakai upload penetapan
   wilayah kerja, dan tidak memakai field `KBLI 2025` kedua.
6. Upload Rencana Teknis tetap wajib ditunggu (`tungguUploadSelesai`) sebelum
   `Proses`, meski memakai `input[type="file"]` langsung.

---

## 7. Checklist selesai

- [ ] `--reporter=line` menunjukkan `1 passed`
- [ ] Tidak ada `console.log` probe / percabangan sisa eksperimen
- [ ] Kedua dokumen + status terverifikasi
- [ ] `docs/SKILL_PKKPR_Scenarios.md` bagian 8 memuat baris SKPBKI
