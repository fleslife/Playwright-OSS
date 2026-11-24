import { test, expect } from "@playwright/test";
import { login } from "../helpers/login.js";

/** Akhiran nama usaha memakai tanggal run dengan format ddMMyyyy, contoh: 24112026. */
function tanggalDdmmyyyy() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${dd}${mm}${now.getFullYear()}`;
}

const NAMA_LOKASI_TEST = "Automation_Darat_NonRDTR";
const NAMA_USAHA_TEST = `AutomationTest PKKPR_TanpaPenilaian_PenguasaanLahan_${tanggalDdmmyyyy()}`;
const FILE_DOKUMEN = "./tests/uploadFile/SampleDocument.pdf";

// Tanggal awal bulan (01) dan tanggal akhir bulan (28-31) pada date picker.
const XPATH_TANGGAL_AWAL = "(//div[substring(@data-v-date, string-length(@data-v-date) - string-length('-01') + 1) = '-01'])[1]";
const XPATH_TANGGAL_AKHIR =
  "(//div[substring(@data-v-date, string-length(@data-v-date) - string-length('-28') + 1) = '-28' or substring(@data-v-date, string-length(@data-v-date) - string-length('-29') + 1) = '-29' or substring(@data-v-date, string-length(@data-v-date) - string-length('-30') + 1) = '-30' or substring(@data-v-date, string-length(@data-v-date) - string-length('-31') + 1) = '-31'])[1]";

/** Isi pasangan tanggal (terbit/perjanjian lalu habis masa berlaku) pada date picker. */
async function isiRentangTanggal(page, indexAwal, indexAkhir) {
  await page.locator(`(//input[@name='date'])[${indexAwal}]`).click();
  await page.locator(XPATH_TANGGAL_AWAL).click();
  await page.locator(`(//input[@name='date'])[${indexAkhir}]`).click();
  await page.locator(XPATH_TANGGAL_AKHIR).click();
}

/** Unggah dokumen, buka pratinjau, lalu kembali ke form. */
async function unggahDanLihatDokumen(page) {
  await page.getByLabel("Pilih Dokumen").setInputFiles(FILE_DOKUMEN);
  await page.getByRole("button", { name: "Lihat Dokumen" }).click();
  await page.getByRole("button", { name: "Kembali" }).click({ timeout: 120000 });
}

test("Positive Case: PKKPR Tanpa Penilaian - Penguasaan Lahan", async ({ page }) => {
  test.setTimeout(300_000);

  await login(page, { zoomOut: true });

  // ===== Navigasi ke halaman Tambah Kegiatan Usaha =====
  const menuPerizinan = page.getByText(" Perizinan Berusaha ", { exact: true });
  await expect(menuPerizinan).toBeVisible({ timeout: 60000 });
  await menuPerizinan.click();
  await page.getByText("Kelola Usaha").click();

  const menuKegiatanUsaha = page.getByText("Kegiatan Usaha", { exact: true }).first();
  await expect(menuKegiatanUsaha).toBeVisible({ timeout: 60000 });
  await menuKegiatanUsaha.click();
  await page.getByRole("button", { name: "Tambah Kegiatan Usaha" }).click();

  // ===== Form Data Lokasi Usaha =====
  const lokasiUsaha = page.getByRole("combobox", { name: "Pilih lokasi usaha" });
  await expect(lokasiUsaha).toBeVisible({ timeout: 60000 });
  await lokasiUsaha.click();
  // Ketik lambat agar autocomplete sempat memuat hasil dari server
  await lokasiUsaha.pressSequentially(NAMA_LOKASI_TEST, { delay: 200 });

  const opsiLokasi = page.getByText(`Darat - ${NAMA_LOKASI_TEST}, Jawa Barat`);
  await expect(opsiLokasi).toBeVisible({ timeout: 60000 });
  await opsiLokasi.first().click();

  // Jawab "Tidak" untuk Obvitnas, PSN, dan perizinan lama.
  const radioTidakList = page.getByRole("radio", { name: "Tidak" });
  await expect(radioTidakList.first()).toBeVisible({ timeout: 60000 });

  await page.getByText("Tidak", { exact: true }).nth(0).click();
  await expect(radioTidakList.nth(0)).toBeChecked({ timeout: 60000 });

  await page.getByText("Tidak", { exact: true }).nth(1).click();
  await expect(radioTidakList.nth(1)).toBeChecked({ timeout: 60000 });

  const radioPerizinanLama = page.locator('//input[@type="radio" and @value="01"]');
  await radioPerizinanLama.scrollIntoViewIfNeeded();
  await radioPerizinanLama.click();
  await expect(radioPerizinanLama).toBeChecked({ timeout: 60000 });

  const tombolSelanjutnya = page.getByRole("button", { name: "Selanjutnya" });
  // Validasi form ke server bisa lambat (async); beri toleransi lebih besar.
  await expect(tombolSelanjutnya).toBeEnabled({ timeout: 60000 });
  await tombolSelanjutnya.click();

  // ===== Form Kegiatan Usaha Utama =====
  const jenisKegiatanInput = page.locator('div:has(> .v-input):has-text("Jenis Kegiatan Usaha") input');
  await expect(jenisKegiatanInput).toBeVisible({ timeout: 60000 });
  await jenisKegiatanInput.click();
  await page.getByText("Kegiatan Usaha Utama", { exact: true }).last().click();

  const kbliInput = page.locator('div:has(> .v-input):has-text("Bidang Usaha") input');
  await expect(kbliInput).toBeVisible({ timeout: 60000 });
  await kbliInput.click();
  await page.getByText("- Periklanan").first().click();
  await page.getByRole("button", { name: "Mengerti" }).last().click();

  const ruangLingkup = page.getByRole("combobox", { name: "Pilih ruang lingkup kegiatan" });
  await expect(ruangLingkup).toBeVisible({ timeout: 60000 });
  await ruangLingkup.click();
  await page.getByText("Seluruh", { exact: true }).first().click();
  await page.getByRole("button", { name: "Tambah Bidang Usaha" }).click();

  // Verifikasi positif: popup muncul dengan peringatan "RDTR Tidak Tersedia"
  // (dikarenakan lokasi usaha test tidak memiliki dokumen RDTR)
  await expect(page.getByText("RDTR Tidak Tersedia", { exact: false })).toBeVisible({ timeout: 60000 });

  await page.getByRole("button", { name: "Mengerti" }).last().click();

  const namaUsaha = page.getByRole("textbox", { name: "Contoh : Restoran" });
  await expect(namaUsaha).toBeVisible({ timeout: 60000 });
  await namaUsaha.click();
  await namaUsaha.fill(NAMA_USAHA_TEST);

  const grupLahan = page.locator("div", { hasText: "Apakah Anda sudah menguasai lahan" }).last();
  const radioYaLahan = grupLahan.getByRole("radio", { name: "Ya" });
  await expect(radioYaLahan).toBeVisible({ timeout: 60000 });
  await radioYaLahan.click();

  // ===== Penguasaan Lahan: Milik Sendiri =====
  await page.getByRole("radio", { name: "Milik Sendiri" }).check();
  await expect(page.getByText("Nama Penerbit Dokumen")).toBeVisible();
  await page.getByRole("textbox", { name: "Nama Penerbit Dokumen" }).fill(NAMA_USAHA_TEST);
  await expect(page.getByText("Nomor Dokumen")).toBeVisible();
  await page.getByRole("textbox", { name: "Nomor Dokumen" }).fill(NAMA_USAHA_TEST);
  await expect(page.getByText("Tanggal Terbit Dokumen")).toBeVisible();
  await isiRentangTanggal(page, 1, 2);
  await unggahDanLihatDokumen(page);
  await page.locator("(//input[@placeholder='Luas Lahan'])[1]").fill("1.234,56");
  await page.getByRole("radio", { name: "Telah dikuasai Pelaku Usaha Lain dan dialihkan ke Pelaku Usaha Baru dengan jenis kegiatan usaha yang sama." }).check();
  await expect(page.getByText("Kondisi Tertentu Pasal 27 ayat 2.c.")).toBeVisible();
  await page.getByRole("combobox", { name: "Pilih jenis dokumen" }).click();
  await page.getByText("Akta jual beli, dokumen").click();
  await page.getByRole("textbox", { name: "Contoh:" }).fill(NAMA_USAHA_TEST);
  await page.locator("(//input[@placeholder='Luas Lahan'])[2]").fill("1.234,56");
  await page.getByRole("textbox", { name: "Masukkan nama sesuai data" }).fill(NAMA_USAHA_TEST);
  await isiRentangTanggal(page, 3, 4);
  await unggahDanLihatDokumen(page);

  // ===== Penguasaan Lahan: Sewa =====
  await page.getByRole("radio", { name: "Sewa" }).check();
  await expect(page.getByText("Nama Pemilik lahan")).toBeVisible();
  await expect(page.getByText("Nomor Perjanjian")).toBeVisible();
  await expect(page.getByText("Tanggal Perjanjian")).toBeVisible();
  await page.getByRole("radio", { name: "Telah dikuasai Pelaku Usaha Lain dan disewakan/pinjam pakai dengan jenis kegiatan usaha yang sama." }).check();
  await expect(page.getByText("Kondisi Tertentu Pasal 27 ayat 2.d.")).toBeVisible();
  await page.locator("(//input[@role='combobox' and @inline='true'])[2]").click();
  await page.getByRole("option", { name: "Dokumen perjanjian sewa" }).click();

  // ===== Penguasaan Lahan: Non Kondisi =====
  await page.getByRole("radio", { name: "Tidak termasuk kondisi di atas" }).check();
  await expect(page.getByText("Permohonan Anda termasuk Penilaian KKPR yang akan diverifikasi oleh Dinas Tata Ruang.")).toBeVisible();

  // ===== Verifikasi Positif =====
  const barisBidangUsaha = page.locator("table").filter({ hasText: "Periklanan" }).locator("tbody tr").filter({ hasText: "Periklanan" });
  await expect(barisBidangUsaha.first()).toBeVisible({ timeout: 60000 });

  await expect(page.getByText("Kegiatan Usaha Utama", { exact: true }).first()).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("73100 - Aktivitas Periklanan").first()).toBeVisible({ timeout: 60000 });

  const tombolSelanjutnyaForm = page.getByRole("button", { name: "Selanjutnya" });
  await expect(tombolSelanjutnyaForm).toBeVisible({ timeout: 60000 });
  await expect(tombolSelanjutnyaForm).toBeEnabled({ timeout: 60000 });

  // ===== Cleanup: hapus data yang baru dibuat =====
  await page.getByTestId("stepper-dynamic").getByText("Perizinan Berusaha", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Daftar Kegiatan Usaha" })).toBeVisible({ timeout: 60000 });

  const barisTeratas = page.locator("table tr").nth(1);
  await expect(barisTeratas).toBeVisible({ timeout: 60000 });
  const teksBaris = (await barisTeratas.innerText()).trim();
  const nomorKegiatan = teksBaris.match(/Nomor Kegiatan Usaha:\s*([\w-]+)/i)?.[1];

  const tombolHapusAtas = barisTeratas.getByRole("button", { name: /hapus/i });
  await expect(tombolHapusAtas).toBeVisible({ timeout: 60000 });
  await tombolHapusAtas.click();

  await expect(page.getByRole("heading", { name: "Konfirmasi Hapus Data" })).toBeVisible({ timeout: 60000 });
  await page
    .locator("button")
    .filter({ hasText: /^Hapus$/ })
    .last()
    .click();

  await expect(page.getByRole("heading", { name: "Konfirmasi Hapus Data" })).toHaveCount(0, { timeout: 60000 });
  await expect(page.getByText("Berhasil menghapus data", { exact: false })).toBeVisible({ timeout: 60000 });
  if (nomorKegiatan) {
    await expect(page.locator("table tr").filter({ hasText: nomorKegiatan })).toHaveCount(0, { timeout: 60000 });
  }
});
