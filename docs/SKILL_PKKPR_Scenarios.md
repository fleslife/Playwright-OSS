# Skill: PKKPR / KKPR Automation Scenarios (OSS Darat)

Dokumen ini merangkum scenario otomasi PKKPR/KKPR yang **sudah terbukti lolos**
di repo ini, beserta pola locator dan jebakan yang sudah terverifikasi.

Prasyarat & cara menjalankan Playwright ada di `docs/SKILL_MBR_KKPR_Automation.md`
bagian 1 (perintah `node .\node_modules\@playwright\test\cli.js ...`, bukan `npx`).

---

## 1. Status scenario

| Spec | Environment | KBLI | Status |
| --- | --- | --- | --- |
| `tests/Staging/Darat_KKPR_Penilaian.spec.js` | staging | `56101` | Lolos |
| `tests/Staging/Darat_MBR.spec.js` | staging | `68111v2025` | Lolos |
| `tests/Staging/Darat_Migas.spec.js` | staging | `06100` | Lolos |
| `tests/Staging/Darat_SKPBKI.spec.js` | staging | `15201` | Lolos |
| `tests/Staging/Darat_WIUP_05101.spec.js` | staging | `05101` | Lolos |
| `tests/Staging/Darat_WIUP_06202.spec.js` | staging | `06202` | Lolos |
| `tests/Staging/Darat_PenguasaanLahan_MilikSendiri.spec.js` | staging | `56101` | Lolos |
| `tests/Staging/Darat_PenguasaanLahan_NonKondisi.spec.js` | staging | `56101` | Lolos |
| `tests/Staging/Darat_UUCK.spec.js` | staging | `56101` | Lolos |
| `tests/Production/Darat_KKPR_Penilaian.spec.js` | production | `56101` | Lolos |
| `tests/Production/Darat_PenguasaanLahan.spec.js` | production | `56101` | Lolos |

### Belum diimplementasikan (file 0 byte)

`Darat_RDTR`, `Darat_Mikro`, `Darat_SatuLini`, `Darat_WIUP_WIUPK`,
`Darat_IKN`, `Darat_KI`, `Darat_KEK`, `Darat_Kolektif`,
`Darat_KPBPB_Batam`. Jangan diasumsikan sudah berjalan.

---

## 2. Kerangka (skeleton) yang dipakai semua scenario

Urutan blok yang sama di semua spec staging:

```
login(page, { environment: "staging", zoomOut: true })
  → menu "Perizinan Berusaha" → "Kelola Usaha" → "Kegiatan Usaha" → "Tambah Kegiatan Usaha"
  → [A] Data Lokasi Usaha
  → [B] Kegiatan Usaha Utama (Jenis Kegiatan + Bidang Usaha/KBLI + Ruang Lingkup)
  → [C] Penguasaan Lahan            (kecuali MBR & WIUP)
  → [D] Rencana Teknis Bangunan
  → [E] Pernyataan / Proses
  → [F] Verifikasi hasil di tabel permohonan
```

Semua spec memakai:

```js
const NAMA_LOKASI_TEST = "Automation_Darat_NonRDTR";
const FILE_DOKUMEN = "./tests/UploadFile/SampleDocument.pdf";
test.setTimeout(300_000);
```

`NAMA_USAHA_TEST` sengaja dibedakan per spec agar mudah dilacak di tabel permohonan, dan
selalu diberi akhiran tanggal run (`_ddMMyyyy`) supaya unik per eksekusi:

```js
/** Akhiran nama usaha memakai tanggal run dengan format ddMMyyyy, contoh: 24112026. */
function tanggalDdmmyyyy() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${dd}${mm}${now.getFullYear()}`;
}

const NAMA_USAHA_TEST = `AutomationTest MBR_${tanggalDdmmyyyy()}`;
```

---

## 3. Blok [A] Data Lokasi Usaha

```js
const lokasiUsaha = page.getByRole("combobox", { name: "Pilih lokasi usaha" });
await lokasiUsaha.click();
// delay 200ms wajib: autocomplete memanggil server, jika terlalu cepat hasil kosong
await lokasiUsaha.pressSequentially(NAMA_LOKASI_TEST, { delay: 200 });
await page.getByText(`Darat - ${NAMA_LOKASI_TEST}, Jawa Barat`, { exact: false }).first().click();

// Tiga pertanyaan radio "Tidak"
const radioTidakList = page.getByRole("radio", { name: "Tidak" });
await page.getByText("Tidak", { exact: true }).nth(0).click();
await expect(radioTidakList.nth(0)).toBeChecked();
await page.getByText("Tidak", { exact: true }).nth(1).click();
await expect(radioTidakList.nth(1)).toBeChecked();

// Radio ketiga memakai value, bukan label
const radioPerizinanLama = page.locator('//input[@type="radio" and @value="01"]');
await radioPerizinanLama.scrollIntoViewIfNeeded();
await radioPerizinanLama.click();
```

**Varian UUCK**: pertanyaan "Apakah sudah memiliki perizinan berusaha yang
Berlaku Efektif sebelum implementasi UU No. 11 Tahun 2020 tentang Cipta Kerja?"
dijawab **Ya** (`value="02"`, bukan `01`). Locator grup via xpath ancestor:

```js
const grupUuck = page
  .getByText("Apakah sudah memiliki perizinan berusaha yang Berlaku Efektif", { exact: false })
  .first()
  .locator("xpath=ancestor::*[.//input[@type='radio']][1]");
await grupUuck.getByText("Ya", { exact: true }).first().click();
await expect(grupUuck.getByRole("radio", { name: "Ya", exact: true })).toBeChecked();
```

Konsekuensi: form step 2 menampilkan blok "Perizinan Berusaha yang Berlaku
Efektif Sebelum Implementasi UU No. 11 Tahun 2020" berisi Penerbit Izin,
Nomor Izin, Tanggal Terbit, dan upload Dokumen izin — lihat bagian 4.3.

Catatan: radio `Tidak` harus diklik lewat `getByText(...).nth(n)` karena input
native-nya tertutup Vuetify; `toBeChecked` tetap bisa dipakai untuk verifikasi.

---

## 4. Blok [B] Kegiatan Usaha Utama & KBLI

```js
const jenisKegiatanInput = page.locator('div:has(> .v-input):has-text("Jenis Kegiatan Usaha") input');
await jenisKegiatanInput.click();
await page.getByText("Kegiatan Usaha Utama", { exact: true }).last().click();

const kbliInput = page.locator('div:has(> .v-input):has-text("Bidang Usaha") input');
await kbliInput.click();
await kbliInput.pressSequentially("56101", { delay: 200 });
await page.getByText("56101", { exact: false }).first().click();
await page.getByRole("button", { name: "Mengerti" }).last().click();   // popup penyesuaian KBLI

const ruangLingkup = page.getByRole("combobox", { name: "Pilih ruang lingkup kegiatan" });
await ruangLingkup.click();
await page.getByText("Restoran", { exact: true }).first().click();

await page.getByRole("button", { name: "Tambah Bidang Usaha" }).click();
await expect(page.getByText("RDTR Tidak Tersedia", { exact: false })).toBeVisible();
await page.getByRole("button", { name: "Mengerti" }).last().click();   // popup RDTR
```

Popup **"PENYESUAIAN KBLI 2020 KE KBLI 2025"** (muncul setelah Bidang Usaha
dipilih) harus ditutup dengan `Mengerti` **sebelum** menyentuh field berikutnya.
Untuk MBR ada dua field KBLI — lihat `docs/SKILL_MBR_KKPR_Automation.md`.

### 4.1 Blok khusus WIUP/WIUPK (KBLI 05xxx)

Berlaku untuk `Darat_WIUP_05101.spec.js` — varian yang **radio-nya masih bisa
diubah**. Blok ini berada di langkah 2, setelah field `Nama Usaha`, dan hanya
muncul bila KBLI kelompok pertambangan dipilih. Untuk KBLI `06202` lihat 4.2.
Durasi normal `05101`: ±55–58 detik per run chromium (setelah helper popup
dipisah; sebelumnya ±82 detik).

```js
const pertanyaanWiup = page.getByText("Apakah Sudah Memiliki WIUP/WIUPK/WIP?", { exact: false }).first();
// Teks pertanyaan di luar wrapper radio -> naik ke ancestor terdekat yang punya radio.
const grupWiup = pertanyaanWiup.locator("xpath=ancestor::*[.//input[@type='radio']][1]");
const radioSudahWiup = grupWiup.getByRole("radio", { name: "Sudah", exact: true });
// Klik label teksnya; check({ force: true }) gagal ("did not change its state").
await grupWiup.getByText("Sudah", { exact: true }).first().click();
await expect(radioSudahWiup).toBeChecked({ timeout: 60000 });

// Pilihan ini baru ada di DOM setelah "Sudah" dipilih.
const radioLuarOss = page.getByRole("radio", { name: "Terbit di luar sistem OSS", exact: true });
await expect(radioLuarOss).toBeVisible({ timeout: 60000 });
await page.getByText("Terbit di luar sistem OSS", { exact: true }).first().click();
await expect(radioLuarOss).toBeChecked({ timeout: 60000 });

await page.getByRole("textbox", { name: /Nomor WIUP\/WIUPK\/WIP/ }).first().fill(NOMOR_WIUP_TEST);

// Upload memakai tombol "Pilih Dokumen" (file chooser), bukan input file.
const labelDokumenWiup = page.getByText("Unggah Dokumen WIUP/WIUPK/WIP", { exact: false }).first();
const grupDokumenWiup = labelDokumenWiup.locator("xpath=ancestor::*[.//button[normalize-space()='Pilih Dokumen']][1]");
const fileChooserWiup = page.waitForEvent("filechooser", { timeout: 30000 });
await grupDokumenWiup.getByRole("button", { name: "Pilih Dokumen" }).click();
await (await fileChooserWiup).setFiles(FILE_DOKUMEN);
await expect(page.getByText("SampleDocument.pdf", { exact: false }).first()).toBeVisible({ timeout: 60000 });
await tungguUploadSelesai(page);
await lihatDokumenDanKembali(page);
```

Nomor WIUP dibangkitkan dari tanggal run supaya unik per eksekusi:

```js
/** Nomor WIUP memakai tanggal run dengan format ddMMyyyy numerik, contoh: 24112026. */
function tanggalDdmmyyyy() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${dd}${mm}${now.getFullYear()}`;
}

const NOMOR_WIUP_TEST = tanggalDdmmyyyy();
```

`padStart(2, "0")` menjaga hari/bulan tetap 2 digit dan `getFullYear()` selalu
4 digit, sehingga hasilnya murni numerik tanpa pemisah.

### 4.2 Varian WIUP 06202: "Belum" terkunci

`Darat_WIUP_06202.spec.js` (Pertambangan Panas Bumi, ruang lingkup
`Tahap Eksplorasi`) memakai blok yang sama, tetapi kedua radio **tidak bisa
diubah**: `Belum` sudah terpilih dan kedua opsi `disabled`. Tidak ada field
`Nomor WIUP/WIUPK/WIP` maupun upload `Unggah Dokumen WIUP/WIUPK/WIP`, jadi
jangan salin bagian itu dari `05101`.

```js
const grupWiup = page
  .getByText("Apakah Sudah Memiliki WIUP/WIUPK/WIP?", { exact: false })
  .first()
  .locator("xpath=ancestor::*[.//input[@type='radio']][1]");
const radioBelumWiup = grupWiup.getByRole("radio", { name: "Belum", exact: true });

await expect(radioBelumWiup).toBeChecked({ timeout: 60000 });
await expect(radioBelumWiup).toBeDisabled({ timeout: 60000 });
await expect(grupWiup.getByRole("radio", { name: "Sudah", exact: true })).toBeDisabled({ timeout: 60000 });
```

Jangan memakai `check()`/`click()` di sini — state-nya sudah final, cukup
assert `toBeChecked` + `toBeDisabled`. Karena tidak ada upload dokumen WIUP,
helper `lihatDokumenDanKembali` di spec ini **tidak dipakai** dan sudah dihapus.

Ruang lingkup `Tahap Eksplorasi` dipilih eksplisit (bukan opsi pertama):
`page.locator(".v-overlay--active .v-list-item").filter({ hasText: "Tahap Eksplorasi" })`.
Langkah 3 dan dialog akhir sama dengan 05101 — lihat "Varian WIUP: step 3 hanya
upload Rencana Teknis" dan "Varian WIUP: konfirmasi ESDM di akhir langkah 2".
Durasi normal: ±50 detik per run chromium (setelah helper popup dipisah).

---

### 4.3 Varian UUCK: blok Perizinan efektif sebelum UU Cipta Kerja

UUCK adalah varian paling pendek: **hanya 2 langkah**. Yang tidak ada di spec ini:

- blok Penguasaan Lahan (bagian 5) — tidak ada pertanyaan lahan;
- blok Rencana Teknis Bangunan (bagian 6) — tidak ada upload kedua;
- modal Pernyataan 7 poin (bagian 7.1) — `Proses` langsung ke dialog konfirmasi.

Urutan lengkap `Darat_UUCK.spec.js` (referensi cepat):

```
login -> Perizinan Berusaha -> Kelola Usaha -> Kegiatan Usaha -> Tambah Kegiatan Usaha
[1] Data Lokasi Usaha: pilih lokasi, Obvitnas/PSN "Tidak", pertanyaan UUCK "Ya"  -> Selanjutnya
[2] Kegiatan Usaha Utama -> KBLI 56101 -> popup penyesuaian KBLI (Mengerti)
    -> ruang lingkup Restoran -> Tambah Bidang Usaha -> popup RDTR (Mengerti)
    -> Nama Usaha -> blok Perizinan efektif (Penerbit, Nomor, Tanggal 1, upload + pratinjau)
    -> Proses -> dialog "Yakin Melanjutkan Permohonan Ini?" (Mengerti)
[3] Detail Perizinan: tab Persyaratan Dasar, tabel Tata Ruang & Lingkungan kosong
```

Blok Perizinan efektif muncul otomatis setelah Nama Usaha diisi (tidak perlu radio
pemicu tambahan). Isinya: Penerbit Izin, Nomor Izin, Tanggal Terbit, upload
Dokumen izin.

```js
await expect(
  page.getByText("Perizinan Berusaha yang Berlaku Efektif Sebelum Implementasi UU No. 11 Tahun 2020", { exact: false }).first()
).toBeVisible({ timeout: 60000 });

// Placeholder yang sama muncul 2x (label + input) -> wajib .first()
await page.locator("input[placeholder='Masukan Penerbit Izizn']").first().fill(NAMA_USAHA_TEST);
await page.locator("input[placeholder='Masukan Nomor Izin']").first().fill(NAMA_USAHA_TEST);

// Tanggal Terbit = tanggal 1 bulan berjalan
const tanggalTerbit = page.locator("input[name='date']").first();
await tanggalTerbit.click();
await page.locator(XPATH_TANGGAL_01).click();
await expect(tanggalTerbit).toHaveValue(/^01\/\d{2}\/\d{4}$/);

const grupDokumen = page
  .getByText("Dokumen izin", { exact: true })
  .first()
  .locator("xpath=ancestor::*[.//button[normalize-space()='Pilih Dokumen']][1]");
const fileChooser = page.waitForEvent("filechooser");
await grupDokumen.getByRole("button", { name: "Pilih Dokumen" }).click();
await (await fileChooser).setFiles(FILE_DOKUMEN);
```

`XPATH_TANGGAL_01` sama dengan date picker Penguasaan Lahan:

```js
const XPATH_TANGGAL_01 =
  "(//div[substring(@data-v-date, string-length(@data-v-date) - string-length('-01') + 1) = '-01'])[1]";
```

Perhatikan typo asli aplikasi: placeholder-nya `Masukan Penerbit Izizn`
(bukan "Izin") — jangan diperbaiki.

Setelah upload sukses, **wajib** pratinjau dokumen dulu (lihat 5.2) sebelum
`Proses` — helper `lihatDokumenDanKembali(page)`:

```js
await expect(page.getByText("SampleDocument.pdf", { exact: false }).first()).toBeVisible();
await tungguUploadSelesai(page);
await lihatDokumenDanKembali(page);
```

Popup `RDTR Tidak Tersedia` bisa muncul **lagi** setelah panel pratinjau ditutup,
jadi panggil `tutupPopupJikaMuncul` sekali lagi dengan budget pendek (5000 ms)
tepat sebelum `Proses`.

Tombol akhir bernama **`Proses`** (bukan `Selanjutnya`) dan memunculkan dialog
**"Yakin Melanjutkan Permohonan Ini?"** dengan teks "dikirim ke Verifikator" +
tombol `Kembali` / `Mengerti`. Berbeda dari WIUP yang memakai "Yakin Memproses
Permohonan Ini?" + tombol `Kembali` / `Mengerti` di dalam konteks ESDM.

### 4.4 Helper popup dengan budget pendek

`tutupPopupJikaMuncul` sengaja **tidak** memakai `expect(...).toBeVisible()`
sebagai penentu: bila popup memang tidak muncul, assertion akan menghabiskan
timeout penuh. Pola yang dipakai (waitFor + catch) langsung lanjut:

```js
async function tutupPopupJikaMuncul(page, teksPopup, timeout = 10000) {
  const popup = page.getByText(teksPopup, { exact: false }).first();
  const muncul = await popup
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
  if (muncul) {
    await page.getByRole("button", { name: "Mengerti" }).last().click();
    await expect(popup).toHaveCount(0, { timeout: 60000 });
  }
}
```

Default `10000` ms: popup di alur UUCK tampil maksimal ±4 detik setelah aksi
pemicunya, jadi 10 detik memberi ±2,5x headroom sekaligus menghemat ±10 detik per
call site yang popup-nya tidak muncul. Jangan turunkan di bawah 8000 — kalau
staging sedang lambat, popup bisa terlewat dan error muncul di langkah
berikutnya (dropdown ruang lingkup gagal dibuka), bukan di helper ini.

---

## 5. Blok [C] Penguasaan Lahan (khas PKKPR Tanpa Penilaian)

Hanya ada di 3 spec PenguasaanLahan. MBR **tidak** punya pertanyaan ini.

### 5.1 Helper tanggal

```js
const XPATH_TANGGAL_AWAL = "(//div[substring(@data-v-date, string-length(@data-v-date) - string-length('-01') + 1) = '-01'])[1]";
const XPATH_TANGGAL_AKHIR =
  "(//div[substring(@data-v-date, string-length(@data-v-date) - string-length('-28') + 1) = '-28' or ... '-31' ...])[1]";

async function isiRentangTanggal(page, indexAwal, indexAkhir) {
  await page.locator(`(//input[@name='date'])[${indexAwal}]`).click();
  await page.locator(XPATH_TANGGAL_AWAL).click();
  await page.locator(`(//input[@name='date'])[${indexAkhir}]`).click();
  await page.locator(XPATH_TANGGAL_AKHIR).click();
}
```

Date picker Vuetify tidak memakai `type="date"`; sel tiap hari punya atribut
`data-v-date` (mis. `2026-03-01`). Karena itu pemilihan tanggal memakai
substring match pada akhiran `-01` dan `-28..-31`, bukan `getByRole("gridcell")`.
Index `(//input[@name='date'])[n]` membedakan field tanggal ke-1, ke-2, dst.
(`isiRentangTanggal(page, 1, 2)` untuk dokumen utama, `(3, 4)` untuk dokumen alih.)

### 5.2 Helper unggah + pratinjau

```js
async function unggahDanLihatDokumen(page) {
  await page.getByLabel("Pilih Dokumen").setInputFiles(FILE_DOKUMEN);
  await page.getByRole("button", { name: "Lihat Dokumen" }).click();
  await page.getByRole("button", { name: "Kembali" }).click({ timeout: 120000 });
}
```

`Kembali` butuh timeout besar karena viewer PDF memuat file dari server.
Di blok Penguasaan Lahan, `setInputFiles` bisa langsung ke label "Pilih Dokumen";
di MBR harus lewat `waitForEvent("filechooser")`:

```js
async function unggahDanLihatDokumen(page, tombolPilihDokumen) {
  const fileChooser = page.waitForEvent("filechooser", { timeout: 30000 });
  await tombolPilihDokumen.click();
  const chooser = await fileChooser;
  await chooser.setFiles(FILE_DOKUMEN);
  await expect(page.getByText("SampleDocument.pdf", { exact: false }).first()).toBeVisible({ timeout: 60000 });

  await page.getByRole("button", { name: "Lihat Dokumen" }).click();
  await page.getByRole("button", { name: "Kembali" }).click({ timeout: 120000 });
  // Panel pratinjau bukan v-overlay, jadi ditunggu lewat tombol Kembali yang hilang.
  await expect(page.getByRole("button", { name: "Kembali" })).toBeHidden({ timeout: 60000 });
}
```

**Selalu lakukan `Lihat Dokumen` → `Kembali` setelah upload**, walau test hanya
butuh file terunggah. Panel pratinjau menutupi form sehingga klik berikutnya
(radio, checkbox) akan mengenai panel, bukan field — gejalanya
`locator.check: Clicking the checkbox did not change its state` padahal elemen
terlihat ter-resolve. Menunggu `.v-overlay--active` hilang **tidak** cukup:
panel pratinjau bukan Vuetify overlay, jadi tunggu tombol `Kembali` benar-benar
hidden.

### 5.3 Tiga cabang status lahan

| Cabang | Locator | Assertion pembeda |
| --- | --- | --- |
| Milik Sendiri | `getByRole("radio", { name: "Milik Sendiri" }).check()` | muncul field `Nama Penerbit Dokumen` |
| Sewa | `getByRole("radio", { name: "Sewa" }).check()` | muncul `Nama Pemilik lahan`, `Nomor Perjanjian` |
| Non-Kondisi | `getByRole("radio", { name: "Tidak termasuk kondisi di atas" }).check()` | teks `Permohonan Anda termasuk Penilaian KKPR` |

Cabang Milik Sendiri & Sewa masing-masing punya pertanyaan lanjutan
"Telah dikuasai Pelaku Usaha Lain ..." yang memunculkan Pasal 27:

```js
// alihkan (jual beli) → 2.c.
await page.getByRole("radio", { name: "Telah dikuasai Pelaku Usaha Lain dan dialihkan ke Pelaku Usaha Baru dengan jenis kegiatan usaha yang sama." }).check();
await expect(page.getByText("Kondisi Tertentu Pasal 27 ayat 2.c.")).toBeVisible();

// disewakan/pinjam pakai → 2.d.
await page.getByRole("radio", { name: "Telah dikuasai Pelaku Usaha Lain dan disewakan/pinjam pakai dengan jenis kegiatan usaha yang sama." }).check();
await expect(page.getByText("Kondisi Tertentu Pasal 27 ayat 2.d.")).toBeVisible();
```

`NonKondisi.spec.js` menguji **ketiga cabang berurutan** dalam satu test,
sedangkan `MilikSendiri.spec.js` hanya cabang pertama.

Beberapa field bernama sama dibedakan lewat index placeholder:

```js
await page.locator("(//input[@placeholder='Luas Lahan'])[1]").fill("1.234,56");
await page.locator("(//input[@placeholder='Luas Lahan'])[2]").fill("1.234,56");
```

Dropdown jenis dokumen pada cabang Sewa memakai combobox tanpa label:

```js
await page.locator("(//input[@role='combobox' and @inline='true'])[2]").click();
await page.getByRole("option", { name: "Dokumen perjanjian sewa", exact: false }).first().click();
```

---

## 6. Blok [D] Rencana Teknis Bangunan

```js
const bagianRencanaTeknis = page.locator("div", { hasText: "Rencana Teknis Bangunan/Rencana Induk Kawasan" }).last();
await expect(bagianRencanaTeknis).toBeVisible({ timeout: 60000 });
await bagianRencanaTeknis.locator('input[type="file"]').setInputFiles(FILE_DOKUMEN);

const grupBangunanBaru = page.locator("div", { hasText: "Apakah Membutuhkan Bangunan Baru Pada Kegiatan Usaha ini ?" }).last();
const radioYaBangunanBaru = grupBangunanBaru.getByRole("radio", { name: "Ya" });
await radioYaBangunanBaru.check({ force: true });

const grupStatusBangunan = page.locator("div", { hasText: "Status Bangunan" }).last();
await grupStatusBangunan.getByRole("radio", { name: /Milik\s*Sendiri/i }).check({ force: true });

await page.locator("//input[@placeholder='Rencana Jumlah Bangunan']").fill("1");
await page.locator("//input[@placeholder='Rencana Jumlah Lantai Bangunan']").fill("2");
await page.locator("//input[@placeholder='Rencana Luas Lantai Bangunan']").fill("100");
```

Di spec PenguasaanLahan upload memakai `input[type="file"]` langsung; di MBR
tombol "Pilih Dokumen" yang membuka file chooser. Keduanya valid — pilih
berdasarkan apa yang benar-benar ada di DOM saat spec dijalankan.

### Varian WIUP: step 3 hanya upload Rencana Teknis

`Darat_WIUP_05101.spec.js` memakai varian paling ringkas: radio
"Apakah Membutuhkan Bangunan Baru Pada Kegiatan Usaha ini ?" **sudah terpilih
"Tidak" secara default**, sehingga tidak ada `Status Bangunan` maupun field
`Rencana Jumlah Bangunan`. Cukup upload Rencana Teknis lalu `Proses`:

```js
await expect(page.getByText("Data Bangunan", { exact: true }).first()).toBeVisible({ timeout: 120000 });
await page.locator('input[type="file"]').last().setInputFiles(FILE_DOKUMEN);
await expect(page.getByText("SampleDocument.pdf", { exact: false }).first()).toBeVisible({ timeout: 60000 });
await tungguUploadSelesai(page);

const tombolProses = page.getByRole("button", { name: "Proses", exact: true });
await expect(tombolProses).toBeEnabled({ timeout: 60000 });
await tombolProses.first().click();
```

Step ini muncul **setelah** dialog `Yakin Memproses Permohonan Ini?`, bukan
setelah `Selanjutnya` di langkah 2. `Proses` tidak melakukan apa pun (tanpa
dialog, tanpa error) bila Rencana Teknis belum terunggah.

### Varian WIUP: konfirmasi ESDM di akhir langkah 2

`Selanjutnya` pada langkah 2 memunculkan dialog yang berbeda dari spec lain:

```js
const dialogKonfirmasi = page.getByRole("dialog").filter({ hasText: "Yakin Memproses Permohonan Ini?" }).last();
await expect(dialogKonfirmasi).toContainText("Kementerian ESDM", { timeout: 60000 });
await dialogKonfirmasi.getByRole("button", { name: "Mengerti" }).click();
```

Setelah `Mengerti`, aplikasi berpindah ke step 3 Data Bangunan — tidak langsung
menampilkan tabel hasil.

### Dua popup berurutan (khusus KBLI yang dikecualikan dari KKPR)

Untuk KBLI yang dikecualikan dari KKPR (mis. `05101`), `Tambah Bidang Usaha`
memicu **dua** dialog: `RDTR Tidak Tersedia` (`Mengerti`) ±4 detik kemudian
disusul `Kegiatan Usaha Tidak Memerlukan Izin KKPR` (`Lanjutkan`). Untuk `06202`
biasanya hanya dialog pertama yang muncul, sehingga helper harus tetap lulus
ketika rangkaian popup berakhir lebih cepat. Karena dialog berikutnya bisa
langsung menggantikan yang baru ditutup,
`expect(getByRole("dialog")).toHaveCount(0)` **tidak reliabel**.

**Jangan** memakai loop dengan satu `timeout` panjang untuk semua iterasi. Di
`06202` hanya satu dialog yang muncul, sehingga iterasi kedua membuang penuh
`timeout` (30 detik) sebelum menyerah — ini penyebab run 06202 sebelumnya 82 detik.
Pisahkan jendela tunggu dialog pertama dan dialog lanjutan:

```js
/** Teks semua dialog yang terbuka, digabung; null bila tidak ada. */
async function teksDialog(page) {
  const dialogs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="dialog"]')).map((el) =>
      (el.innerText || "").replace(/\s+/g, " ")
    )
  );
  return dialogs.length ? dialogs.join(" ") : null;
}

/** Polling sampai dialog muncul; null bila tidak ada dalam batas waktu. */
async function tungguDialog(page, timeout) {
  const selesai = Date.now() + timeout;
  for (;;) {
    const teks = await teksDialog(page);
    if (teks || Date.now() >= selesai) return teks;
    await page.waitForTimeout(300);
  }
}

async function tutupPopupBidangUsaha(page, timeoutPertama = 30000, timeoutLanjutan = 3000, batas = 3) {
  let teks = await tungguDialog(page, timeoutPertama);

  for (let i = 0; i < batas && teks; i += 1) {
    const tombol = /Tidak Memerlukan Izin KKPR/.test(teks) ? "Lanjutkan" : "Mengerti";
    await page.getByRole("button", { name: tombol }).last().click();

    // Tunggu dialog tertutup atau digantikan dialog lain sebelum membaca ulang.
    const selesai = Date.now() + 30000;
    while ((await teksDialog(page)) === teks && Date.now() < selesai) {
      await page.waitForTimeout(300);
    }
    teks = await tungguDialog(page, timeoutLanjutan);
  }
}
```

Angka `timeoutLanjutan` berasal dari pengukuran trace: dialog lanjutan selalu
muncul <1 detik (05101: ±0,1 detik; 06202: <1 detik) setelah dialog sebelumnya
ditutup, jadi 3 detik sudah 3× lipat. Hasil: 05101 ±82 dtk → ±55–58 dtk, 06202
±82 dtk → ±49 dtk (wall time). Kalau di kemudian hari ada run yang melewatkan
dialog lanjutan, naikkan `timeoutLanjutan` ke 5000–8000 — jangan kembalikan
satu `timeout` panjang untuk semua iterasi.

Membiarkan salah satu dialog terbuka membuat klik berikutnya tidak berpengaruh
dan test menggantung sampai timeout.

### Wajib: tunggu upload selesai sebelum `Proses`

```js
async function tungguUploadSelesai(scope) {
  await expect(scope.locator(".v-progress-linear--active")).toHaveCount(0, { timeout: 120000 });
  await expect(scope.locator(".v-input--error")).toHaveCount(0, { timeout: 60000 });
}
```

**Ini penyebab kegagalan paling sering dan paling sulit dilacak.** Klik
`Selanjutnya`/`Proses` saat file masih diunggah membuat server menolak validasi
**tanpa pesan error**: tidak ada toast, tidak ada error console, tidak ada HTTP
4xx. Step hanya tidak maju, lalu locator berikutnya menggantung sampai timeout
test (300s) — terlihat seperti "load lama". Kehadiran nama file di form
**bukan** bukti upload sukses (`<input name="oss-upload">` tetap menyimpan
`value="C:\fakepath\..."` walau gagal).

---

## 7. Blok [E] Pernyataan & Proses

Ada dua varian UI yang sudah terverifikasi:

**7.1 Modal "Pernyataan 7 Points"** (KKPR Penilaian & PenguasaanLahan Non-Kondisi)

```js
const modalPernyataan = page.getByRole("dialog")
  .filter({ hasText: "Dengan ini menyatakan dengan sebenar-benarnya dan bertanggung jawab sepenuhnya bahwa:" })
  .last();
await expect(modalPernyataan).toBeVisible({ timeout: 60000 });

const kotakPernyataan = modalPernyataan.getByRole("checkbox");
await expect(kotakPernyataan).toHaveCount(7);
for (let i = 0; i < 7; i += 1) {
  await kotakPernyataan.nth(i).check({ force: true });
}

await page.getByTestId("modal-proses").getByRole("button", { name: "Proses" }).click();
```

`NonKondisi.spec.js` memilih 7 checkbox itu satu per satu dengan nama spesifik
(`"Bidang tanah tidak dalam"`, `"Bahwa apabila di kemudian"`, dst.) — lebih tahan
terhadap perubahan urutan, tapi lebih rapuh terhadap perubahan teks.

**7.2 Tanpa modal** (MBR) — cukup satu checkbox lalu tombol `Proses` di halaman.

**7.3 UUCK** — tidak ada modal Pernyataan 7 poin (form hanya 2 langkah). `Proses`
langsung memunculkan dialog konfirmasi "Yakin Melanjutkan Permohonan Ini?"
lalu redirect ke halaman `detail-kegiatan`.

---

## 8. Blok [F] Verifikasi hasil

Teks kolom status terpotong ellipsis di tabel, jadi **jangan** assert teks penuh:

| Scenario | Assertion |
| --- | --- |
| KKPR Penilaian | `Persetujuan KKPR Penilaian (` + `Menunggu Verifikasi Persyarata…` |
| MBR | `Persetujuan KKPR Kondisi Tertentu (Utama)` + `Menunggu verifikasi kondisi` |
| Migas | `Persetujuan KKPR Kondisi Tertentu` + `Menunggu verifikasi kondisi` |
| PenguasaanLahan Milik Sendiri | `Persetujuan KKPR Kondisi` + `Menunggu verifikasi kondisi` |
| SKPBKI | dua dokumen: `Persetujuan KKPR Penilaian (Utama)` + `Belum melengkapi persyaratan`, dan `Pengecualian Berlokasi di Kawasan Industri (Utama)` + `Menunggu Verifikasi K/L` |
| WIUP 05101 | `Tanpa KKPR (Utama)` + `Terbit Otomatis` (satu baris, keduanya difilter sekaligus) |
| WIUP 06202 | `Tanpa KKPR (Utama)` + `Terbit Otomatis` (sama seperti 05101) |
| UUCK | tidak ada dokumen: `Detail Perizinan` tampil, tab `Persyaratan Dasar` ber-`aria-selected=true`, lalu per bagian (`Tata Ruang`, `Lingkungan`) heading terlihat + tabel `Status Pengiriman` hanya berisi `Data tidak ditemukan` dengan jumlah `row` = 2 (header + empty state) |

Gunakan `toContainText` dengan prefiks stabil, atau sertakan karakter `…`
apa adanya bila memakai `getByText`.

---

## 9. Jebakan umum (ringkas)

1. `npx` rusak di repo ini → pakai `node .\node_modules\@playwright\test\cli.js`.
2. Tidak ada `actionTimeout` di `playwright.config.js`; locator gagal akan
   retry sampai timeout test → selalu set timeout eksplisit per `expect`.
3. Elemen radio/checkbox Vuetify tersembunyi → `check({ force: true })` /
   `click({ force: true })`.
4. `page.locator("div").filter({ hasText }).last()` sangat lambat (scan seluruh
   subtree, tanpa short-circuit). Ganti dengan `div:has(> .v-input):has-text(...)`
   atau anchor teks + `xpath=ancestor::*[...][1]`.
5. `getByRole("option")` bisa mengambil opsi dari dropdown yang sudah tertutup →
   batasi ke `.v-overlay--active .v-list-item`.
6. Teks di dalam atribut `value` tidak terlihat oleh `getByText` → `toHaveValue()`.
7. Setelah upload sukses tombol "Pilih Dokumen" hilang, jadi locator yang
   di-scope oleh ancestor tombol itu berhenti match → assert nama file di level
   `page`.
8. Pilihan radio yang bergantung pada jawaban lain (mis. "Terbit di luar sistem
   OSS" setelah `Sudah`) belum ada di DOM saat halaman dimuat → pasang locator
   setelah jawaban pemicunya diklik.
9. `check({ force: true })` pada radio Vuetify bisa gagal dengan
   `Clicking the checkbox did not change its state` walau elemen ter-resolve;
   klik label teksnya lalu verifikasi dengan `toBeChecked()`.
10. Tab pada halaman `detail-kegiatan` ber-role **`tab`**, bukan `button`
    (`getByRole("button", { name: "Persyaratan Dasar" })` tidak match sama sekali).
11. Pertanyaan UUCK memakai `value="02"` untuk **Ya**; `value="01"` adalah
    jawaban "Tidak" milik pertanyaan lain. Jangan copy-paste dari SKPBKI.
12. State tanggal yang sudah terisi jangan diverifikasi dengan
    `not.toHaveValue("")` (lolos walau nilainya salah). Pakai pola
    `toHaveValue(/^01\/\d{2}\/\d{4}$/)`.