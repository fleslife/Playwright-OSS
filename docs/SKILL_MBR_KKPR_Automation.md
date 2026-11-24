# Skill: Otomasi Skenario MBR (KKPR Kondisi Tertentu)

Panduan kerja untuk membuat/memperbaiki spec Playwright pada alur **PKKPR Kondisi Tertentu MBR** di OSS staging.

- Spec acuan: `tests/Staging/Darat_MBR.spec.js`
- Spec dasar (non-MBR): `tests/Staging/Darat_KKPR_Penilaian.spec.js`
- Helper login: `tests/helpers/login.js`
- File upload uji: `tests/UploadFile/SampleDocument.pdf`

---

## 1. Cara menjalankan

`npx` rusak di environment ini (`.bin\` tidak dikenali). Selalu pakai CLI langsung:

```powershell
node ".\node_modules\@playwright\test\cli.js" test tests/Staging/Darat_MBR.spec.js --project=chromium --reporter=line
```

Untuk daftar test tanpa eksekusi:

```powershell
node ".\node_modules\@playwright\test\cli.js" test tests/Staging/Darat_MBR.spec.js --list
```

Spec memakai sintaks ESM (`import`) sementara `package.json` ber-`"type": "commonjs"`.
Untuk cek sintaks tanpa menjalankan browser, salin ke `.mjs` lalu `node --check`.

---

## 2. Perbedaan MBR vs KKPR_Penilaian

Ini yang wajib diperhatikan saat menyalin spec dasar.

| Aspek | KKPR_Penilaian | MBR |
|---|---|---|
| KBLI | 56101 | **68111** |
| Field KBLI | satu | **dua**: `KBLI 2020 (Sebelumnya)` (readonly) + `Pilih KBLI 2025` (wajib) |
| Popup penyesuaian KBLI | tidak ada | **ada**, memblokir klik sampai ditutup "Mengerti" |
| Pertanyaan `Apakah Anda sudah menguasai lahan` | ada | **tidak ada** — jangan disalin |
| Blok khusus | — | radio Ya/Tidak + checkbox pernyataan + info Pasal 27 + upload RTR |
| Modal "Pernyataan 7 Points" | ada | **tidak ada** |
| Judul dokumen hasil | Persetujuan KKPR | `Persetujuan KKPR Kondisi Tertentu (Utama)` |

Pemetaan KBLI 68111:

- 2020 → `Real Estat Yang Dimiliki Sendiri Atau Disewa`
- 2025 → `Aktivitas Pengembangan Bangunan dan Lahan Hunian`

Ruang lingkup yang terpilih otomatis: `Pengembangan Hunian dan/atau hunian campuran: ...`

---

## 3. Urutan langkah spec MBR

1. `login(page, { environment: "staging", zoomOut: true })`
2. Navigasi: `Perizinan Berusaha` → `Kelola Usaha` → `Kegiatan Usaha` → `Tambah Kegiatan Usaha`
3. **Data Lokasi Usaha**: pilih lokasi (`Automation_Darat_NonRDTR`), jawab `Tidak` ×2, radio `value="01"`, klik `Selanjutnya`
4. **Bidang Usaha**: `Jenis Kegiatan Usaha` = `Kegiatan Usaha Utama`, isi KBLI `68111`
5. Tutup popup `PENYESUAIAN KBLI 2020 KE KBLI 2025` (**harus sebelum** menyentuh KBLI 2025)
6. Assert KBLI 2020 readonly via `toHaveValue(/^68111/)`
7. Pilih `Pilih KBLI 2025` → assert opsi `68111 - Aktivitas Pengembangan Bangunan dan Lahan Hunian`
8. Pilih ruang lingkup → `Tambah Bidang Usaha`
9. Isi `Nama Usaha`
10. **Blok MBR**: radio `Ya` → assert info Pasal 27 → centang checkbox pernyataan → upload RTR
11. Verifikasi positif (KBLI + nama usaha) → `Selanjutnya`
12. **Data Bangunan**: upload Rencana Teknis → `Ya` bangunan baru → `Milik Sendiri` → isi jumlah/lantai/luas
13. `Proses`
14. Assert dokumen `Persetujuan KKPR Kondisi Tertentu (Utama)` + status `Menunggu verifikasi kondisi`

---

## 4. Pola locator yang sudah terbukti

### Radio / checkbox Vuetify

Input native tersembunyi di balik styling Vuetify → selalu `force: true`.

```js
await radio.check({ force: true, timeout: 30000 });
await expect(radio).toBeChecked({ timeout: 60000 });
```

Checkbox pernyataan MBR — pakai xpath ini (paling stabil, tidak bergantung teks):

```js
const checkboxPernyataanMbr = page.locator("//input[starts-with(@id,'checkbox-v-')]");
await checkboxPernyataanMbr.check({ force: true, timeout: 30000 });
```

### Teks pertanyaan sebagai jangkar

Teks pertanyaan **bukan** parent dari wrapper radio. Jangan pakai `hasText` pada
`.v-input--radio-group` (hasilnya nol match). Naik dari teks ke ancestor:

```js
const pertanyaan = page.getByText("Apakah Anda melakukan pembangunan rumah bagi masyarakat berpenghasilan rendah", { exact: false }).first();
const grup = pertanyaan.locator("xpath=ancestor::*[.//input[@type='radio']][1]");
```

### Upload file

UI memakai tombol **`Pilih Dokumen`** yang membuka file chooser, **bukan**
`<input type="file">` yang bisa di-`setInputFiles` langsung.

```js
const heading = page.getByRole("heading", { name: "Rencana Teknis Bangunan/Rencana Induk Kawasan", exact: true });
const grup = heading.locator("xpath=ancestor::*[.//button[normalize-space()='Pilih Dokumen']][1]");
const chooserPromise = page.waitForEvent("filechooser", { timeout: 30000 });
await grup.getByRole("button", { name: "Pilih Dokumen" }).click();
(await chooserPromise).setFiles(FILE_DOKUMEN);
```

Penting: setelah upload berhasil tombol `Pilih Dokumen` **hilang**, sehingga scope
`grup` tidak lagi match. Verifikasi nama file di level `page`, bukan di dalam `grup`.

### Dropdown option

`getByRole("option")` bisa mengambil opsi dari dropdown lama yang sudah tertutup
(`element is not visible`). Scope ke overlay aktif:

```js
page.locator(".v-overlay--active .v-list-item").first()
```

### Teks di dalam atribut

Nilai readonly seperti `68111 - Real Estat ...` ada di atribut `value`, bukan text node.
`getByText` tidak akan menemukannya — pakai `toHaveValue()`.

### Tabel hasil

Kolom status dipotong elipsis (`Menunggu verifikasi kondisi te…`), jadi jangan assert
string penuh. Scope ke baris lalu pakai prefix:

```js
const baris = page.getByRole("row").filter({ hasText: "Persetujuan KKPR Kondisi Tertentu" }).first();
await expect(baris).toContainText("Menunggu verifikasi kondisi");
```

---

## 5. Jebakan yang pernah memakan waktu

**Tombol `Selanjutnya` tidak memproses apa pun (terlihat seperti hang 5 menit)**

Penyebab: upload RTR belum selesai. `<input name="oss-upload">` masih berstatus
`v-input--error` dengan progress bar aktif; server menolak validasi **tanpa pesan
error di UI**, jadi step tidak maju dan `getByText` berikutnya menggantung sampai
timeout test.

Solusi — tunggu upload benar-benar selesai sebelum klik:

```js
await expect(page.locator(".wrapper-input-upload .v-progress-linear--active")).toHaveCount(0, { timeout: 120000 });
await expect(page.locator(".wrapper-input-upload.v-input--error")).toHaveCount(0, { timeout: 60000 });
```

**`actionTimeout` tidak diset di `playwright.config.js`**

Artinya action yang gagal akan retry tanpa batas sampai timeout test (300s di spec ini).
Saat mendiagnosis, selalu kirim `timeout` eksplisit ke action, dan pertimbangkan
menambah `actionTimeout: 30_000` / `navigationTimeout: 60_000` di config
(mempengaruhi seluruh suite — butuh persetujuan).

**Locator `page.locator("div").filter({ hasText: ... }).last()` sangat lambat**

`hasText` mencocokkan seluruh subtree teks dan `.last()` tidak bisa short-circuit,
sehingga Playwright memindai DOM penuh setiap retry (dan `scrollIntoViewIfNeeded`
me-resolve ulang seluruh chain). Ganti dengan scope yang lebih sempit, misalnya
berangkat dari heading/label lalu naik ke ancestor.

---

## 6. Saat staging bermasalah

Gejala: login sukses tapi halaman blank (`body` length 0), console error
`CORS policy: Permission was denied` pada `api-stg.oss.go.id/stg/v1/sso/users/userinfo-token`
dan `/revoke-token`, plus `[authRedirect] Role not available after retries`.

Cara memastikan ini masalah infra, bukan kode: jalankan `Darat_KKPR_Penilaian.spec.js`.
Kalau ikut gagal di titik yang sama, environment-nya yang bermasalah.

---

## 7. Checklist sebelum menyatakan spec selesai

- [ ] `--reporter=line` menunjukkan `1 passed`
- [ ] Tidak ada sisa `console.log` / `return;` debug di spec
- [ ] Tidak ada file probe sementara (`probe*.tmp.mjs`) tertinggal
- [ ] Assertion memakai teks yang benar-benar ada di UI (cek `error-context.md`)
