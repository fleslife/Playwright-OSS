# Skill: Otomasi Skenario Migas (KKPR Kondisi Tertentu)

Panduan kerja untuk membuat/memperbaiki spec Playwright pada alur **PKKPR Kondisi Tertentu Migas**
(hulu minyak dan gas bumi) di OSS staging.

- Spec acuan: `tests/Staging/Darat_Migas.spec.js`
- Spec terdekat (paling mirip): `tests/Staging/Darat_MBR.spec.js`
- Prasyarat, cara menjalankan, dan pola locator umum: `docs/SKILL_MBR_KKPR_Automation.md`
- Kerangka semua scenario: `docs/SKILL_PKKPR_Scenarios.md`

---

## 1. Cara menjalankan

```powershell
node ".\node_modules\@playwright\test\cli.js" test tests/Staging/Darat_Migas.spec.js --project=chromium --reporter=line
node ".\node_modules\@playwright\test\cli.js" test tests/Staging/Darat_Migas.spec.js --list
```

Durasi normal: ±40 detik (bukan 5 menit — kalau sampai menggantung, lihat bagian 6).

---

## 2. Perbedaan Migas vs MBR

Migas = MBR **tanpa** blok radio/checkbox MBR, **dengan** upload dokumen penetapan wilayah kerja.

| Aspek | MBR | Migas |
|---|---|---|
| KBLI | `68111` | **`06100`** |
| Nama KBLI | Aktivitas Pengembangan Bangunan dan Lahan Hunian | **Pertambangan Minyak Bumi** |
| Field `KBLI 2020 (Sebelumnya)` + `Pilih KBLI 2025` | **ada, wajib diisi** | **tidak ada** — KBLI 06100 langsung terpetakan ke KBLI 2025 |
| Ruang lingkup | pilih opsi spesifik (`Restoran`/pengembangan hunian) | **opsi pertama** dari daftar |
| Pertanyaan `Apakah Anda melakukan pembangunan rumah bagi MBR` | ada | **tidak ada** |
| Checkbox pernyataan MBR | ada | **tidak ada** |
| Info Pasal 27 | `Anda termasuk Kondisi Tertentu Pasal 27` | sama + `Kegiatan terkait hulu minyak dan gas bumi` |
| Upload di Bidang Usaha | dokumen pendukung sesuai RTR | **`Unggah penetapan wilayah kerja migas`** |
| Field Nama Usaha | `Contoh : Restoran` | placeholder bisa berubah jadi `Contoh : Restoran 777` → pakai regex `/Contoh\s*:\s*Restoran/` |

Label info yang muncul di form (dua baris):

```
Anda termasuk Kondisi Tertentu Pasal 27 - Kegiatan terkait hulu minyak
dan gas bumi
```

Upload section di bawah info tersebut:

```
Unggah penetapan wilayah kerja migas Kontrak Kerja Sama dan Wilayah Usaha
minyak dan gas bumi yang telah ditetapkan oleh pemerintah.
[Pilih atau seret dokumen disini]  PDF (Max. 24 MB)      [Pilih Dokumen]
```

---

## 3. Urutan langkah spec Migas

1. `login(page, { environment: "staging", zoomOut: true })`
2. Navigasi: `Perizinan Berusaha` → `Kelola Usaha` → `Kegiatan Usaha` → `Tambah Kegiatan Usaha`
3. **Data Lokasi Usaha**: lokasi `Automation_Darat_NonRDTR`, `Tidak` ×2, radio `value="01"`, `Selanjutnya`
4. **Bidang Usaha**: `Jenis Kegiatan Usaha` = `Kegiatan Usaha Utama`, isi KBLI `06100`
5. Tutup popup `PENYESUAIAN KBLI 2020 KE KBLI 2025` dengan `Mengerti`
6. Assert `06100 - Pertambangan Minyak Bumi` tampil (tidak ada field KBLI 2025 manual)
7. Ruang lingkup: **opsi pertama** `.v-overlay--active .v-list-item` → `Tambah Bidang Usaha`
8. Tutup popup `RDTR Tidak Tersedia` **jika muncul** (tidak selalu)
9. Isi `Nama Usaha`
10. Assert info Pasal 27 + `Kegiatan terkait hulu minyak dan gas bumi`
11. Upload dokumen penetapan wilayah kerja migas → tunggu upload → **`Lihat Dokumen` → `Kembali`**
12. Verifikasi KBLI & nama usaha → `Selanjutnya`
13. **Data Bangunan**: upload Rencana Teknis → tunggu upload → `Lihat Dokumen` → `Kembali`
14. `Ya` bangunan baru → `Milik Sendiri` → jumlah `1` / lantai `2` / luas `100`
15. `Proses`
16. Assert baris `Persetujuan KKPR Kondisi Tertentu` + `Menunggu verifikasi kondisi`

---

## 4. Pola locator khas Migas

### Ruang lingkup: ambil opsi pertama

Isi daftar bergantung pada KBLI, jadi jangan hardcode teks. Ambil item pertama dari
overlay yang aktif (dropdown lama bisa tertinggal di DOM):

```js
const ruangLingkup = page.getByRole("combobox", { name: "Pilih ruang lingkup kegiatan" });
await expect(ruangLingkup).toBeEnabled({ timeout: 60000 }); // baru aktif setelah KBLI valid
await ruangLingkup.click();
await page.locator(".v-overlay--active .v-list-item").first().click();
```

### Upload dokumen penetapan wilayah kerja

Scope berangkat dari teks label, bukan heading:

```js
const labelDokumenMigas = page.getByText("Unggah penetapan wilayah kerja migas", { exact: false }).first();
const grupDokumenMigas = labelDokumenMigas.locator("xpath=ancestor::*[.//button[normalize-space()='Pilih Dokumen']][1]");
const fileChooser = page.waitForEvent("filechooser", { timeout: 30000 });
await grupDokumenMigas.getByRole("button", { name: "Pilih Dokumen" }).click();
await (await fileChooser).setFiles(FILE_DOKUMEN);
```

### Pratinjau dokumen: `Lihat Dokumen` lalu `Kembali`

Wajib setelah **setiap** upload, sama seperti `unggahDanLihatDokumen` di
`Darat_PenguasaanLahan_MilikSendiri.spec.js`:

```js
async function lihatDokumenDanKembali(page) {
  const tombolLihatDokumen = page.getByRole("button", { name: "Lihat Dokumen" }).last();
  await expect(tombolLihatDokumen).toBeVisible({ timeout: 60000 });
  await tombolLihatDokumen.click();
  const tombolKembali = page.getByRole("button", { name: "Kembali" }).last();
  await tombolKembali.click({ timeout: 120000 });
  // Dialog pratinjau masih beranimasi menutup; klik berikutnya bisa terhalang overlay.
  await expect(tombolKembali).toHaveCount(0, { timeout: 60000 });
  await expect(page.locator(".v-overlay--active")).toHaveCount(0, { timeout: 60000 });
}
```

---

## 5. Jebakan khas Migas

**Blok mapping KBLI 2020 → 2025 tidak muncul**

Kalau langkah `await expect(page.getByText("KBLI 2020 (Sebelumnya)")).toBeVisible()`
dari spec MBR disalin apa adanya, test gagal di situ. Untuk `06100` KBLI langsung
terpetakan sehingga seluruh blok `KBLI 2020 (Sebelumnya)` + `Pilih KBLI 2025` hilang.
Ganti dengan assert hasil akhir:

```js
await expect(page.getByText(`${KBLI_TEST} - Pertambangan Minyak Bumi`, { exact: false }).first()).toBeVisible();
```

**Overlay pratinjau belum tertutup saat klik berikutnya**

Gejala: `locator.check: Clicking the checkbox did not change its state` pada radio
`Apakah Membutuhkan Bangunan Baru ...` tepat setelah `Kembali` diklik. Penyebabnya
dialog masih beranimasi menutup dan menelan klik. Versi `MilikSendiri` tidak
terkena karena urutan field-nya berbeda — **jangan** hilangkan penantian overlay.

**`Pilih Dokumen` hilang setelah upload**

Setelah upload sukses tombol berubah menjadi nama file + `Lihat Dokumen`, sehingga
scope `grupDokumenMigas` berhenti match. Assert nama file di level `page`:

```js
await expect(page.getByText("SampleDocument.pdf", { exact: false }).first()).toBeVisible();
```

Dua upload dalam satu spec → pakai `.first()` untuk upload pertama dan `.last()`
untuk upload Rencana Teknis, karena keduanya menampilkan nama file yang sama.

**Placeholder Nama Usaha berbeda**

`Contoh : Restoran` (MBR) vs `Contoh : Restoran 777` (Migas). Pakai regex agar
tahan perubahan:

```js
const namaUsaha = page.getByRole("textbox", { name: /Contoh\s*:\s*Restoran/ }).first();
```

**Popup RDTR tidak selalu muncul**

Lokasi `Automation_Darat_NonRDTR` umumnya memunculkan `RDTR Tidak Tersedia`, tetapi
perlakukan sebagai opsional supaya spec tidak merah saat popup tidak tampil:

```js
const dialogTerbuka = await popupRdtr.waitFor({ state: "visible", timeout: 20000 })
  .then(() => true).catch(() => false);
if (dialogTerbuka) { await page.screenshot(...); await page.getByRole("button", { name: "Mengerti" }).last().click(); }
```

---

## 6. Diagnosis cepat

| Gejala | Dugaan penyebab |
|---|---|
| Gagal di `KBLI 2020 (Sebelumnya)` | blok mapping tidak ada untuk 06100 → assert hasil akhir saja |
| `Clicking the checkbox did not change its state` | overlay `Lihat Dokumen` belum tertutup |
| Tombol `Selanjutnya`/`Proses` tidak memajukan step | upload belum selesai → `tungguUploadSelesai(page)` |
| Ruang lingkup tidak bisa diklik | KBLI belum tervalidasi; tunggu `toBeEnabled` |
| `getByRole("option")` tidak terlihat | opsi dari overlay lama → `.v-overlay--active .v-list-item` |

---

## 7. Checklist sebelum menyatakan spec selesai

- [ ] `--reporter=line` menunjukkan `1 passed`
- [ ] Upload PDF (wilayah kerja & Rencana Teknis) diikuti `Lihat Dokumen` + `Kembali`
- [ ] Tidak ada sisa blok mapping KBLI 2020/2025 dari MBR
- [ ] Tidak ada `console.log` / variabel perantara yang tidak dipakai
- [ ] `docs/SKILL_PKKPR_Scenarios.md` tabel status sudah mencatat Migas = Lolos
