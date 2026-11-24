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
const NAMA_USAHA_TEST = `AutomationTest Migas_${tanggalDdmmyyyy()}`;
const KBLI_TEST = "06100";
const FILE_DOKUMEN = "./tests/UploadFile/SampleDocument.pdf";

/** Jika di-click saat upload belum selesai, server menolak validasi tanpa pesan error di UI. */
async function tungguUploadSelesai(scope) {
  await expect(scope.locator(".v-progress-linear--active")).toHaveCount(0, { timeout: 120000 });
  await expect(scope.locator(".v-input--error")).toHaveCount(0, { timeout: 60000 });
}

/** Buka pratinjau dokumen yang baru diunggah, lalu kembali ke form. */
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

test("Positive Case: Migas", async ({ page }) => {
  test.setTimeout(300_000);

  await login(page, { environment: "staging", zoomOut: true });

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
  // Autocomplete memanggil server; mengetik terlalu cepat membuat hasil kosong.
  await lokasiUsaha.pressSequentially(NAMA_LOKASI_TEST, { delay: 200 });
  const opsiLokasiPertama = page.getByText(`Darat - ${NAMA_LOKASI_TEST}, Jawa Barat`, { exact: false }).first();
  await expect(opsiLokasiPertama).toBeVisible({ timeout: 60000 });
  await opsiLokasiPertama.click();

  // Obvitnas, PSN, dan perizinan lama dijawab "Tidak".
  const radioTidakList = page.getByRole("radio", { name: "Tidak" });
  await expect(radioTidakList.first()).toBeVisible({ timeout: 60000 });

  await page.getByText("Tidak", { exact: true }).nth(0).click();
  await expect(radioTidakList.nth(0)).toBeChecked({ timeout: 60000 });

  await page.getByText("Tidak", { exact: true }).nth(1).click();
  await expect(radioTidakList.nth(1)).toBeChecked({ timeout: 60000 });

  const radioPerizinanLama = page.locator('//input[@type="radio" and @value="01"]');
  await radioPerizinanLama.scrollIntoViewIfNeeded();
  await radioPerizinanLama.click({ force: true });
  await expect(radioPerizinanLama).toBeChecked({ timeout: 60000 });

  const tombolSelanjutnya = page.getByRole("button", { name: "Selanjutnya" });
  await expect(tombolSelanjutnya).toBeEnabled({ timeout: 60000 });
  await tombolSelanjutnya.click();

  // ===== Form Kegiatan Usaha Utama =====
  const jenisKegiatanInput = page.locator('div:has(> .v-input):has-text("Jenis Kegiatan Usaha") input');
  await expect(jenisKegiatanInput).toBeVisible({ timeout: 60000 });
  await jenisKegiatanInput.click();
  await page.getByText("Kegiatan Usaha Utama", { exact: true }).last().click();

  const kbliInput = page.locator('div:has(> .v-input):has-text("Bidang Usaha") input').first();
  await expect(kbliInput).toBeVisible({ timeout: 60000 });
  await kbliInput.click();
  await kbliInput.pressSequentially(KBLI_TEST, { delay: 200 });
  const opsiKbliPertama = page.getByRole("option").filter({ hasText: KBLI_TEST }).first();
  await expect(opsiKbliPertama).toBeVisible({ timeout: 60000 });
  await opsiKbliPertama.click();

  // Popup "PENYESUAIAN KBLI 2020 KE KBLI 2025" menutupi dropdown berikutnya -> wajib ditutup lebih dulu.
  const popupPenyesuaianKbli = page.getByText("PENYESUAIAN KBLI 2020 KE KBLI 2025", { exact: false });
  await expect(popupPenyesuaianKbli).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Mengerti" }).last().click();
  await expect(popupPenyesuaianKbli).toHaveCount(0, { timeout: 60000 });

  // KBLI 06100 langsung terpetakan ke KBLI 2025, tanpa blok mapping manual.
  await expect(page.getByText(`${KBLI_TEST} - Pertambangan Minyak Bumi`, { exact: false }).first()).toBeVisible({ timeout: 60000 });

  // Ambil opsi pertama dari overlay yang aktif; dropdown lama bisa tertinggal di DOM.
  const ruangLingkup = page.getByRole("combobox", { name: "Pilih ruang lingkup kegiatan" });
  await expect(ruangLingkup).toBeVisible({ timeout: 60000 });
  await expect(ruangLingkup).toBeEnabled({ timeout: 60000 });
  await ruangLingkup.click();
  const opsiRuangLingkup = page.locator(".v-overlay--active .v-list-item").first();
  await expect(opsiRuangLingkup).toBeVisible({ timeout: 60000 });
  await opsiRuangLingkup.click();
  await page.getByRole("button", { name: "Tambah Bidang Usaha" }).click();

  // Popup peringatan RDTR tidak selalu muncul.
  const popupRdtr = page.getByText("RDTR Tidak Tersedia", { exact: false });
  const dialogTerbuka = await popupRdtr
    .waitFor({ state: "visible", timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (dialogTerbuka) {
    await page.screenshot({ path: "test-results/screenshot-rdtr-tidak-tersedia-migas.png", fullPage: true });
    await page.getByRole("button", { name: "Mengerti" }).last().click();
  }

  const namaUsaha = page.getByRole("textbox", { name: /Contoh\s*:\s*Restoran/ }).first();
  await expect(namaUsaha).toBeVisible({ timeout: 60000 });
  await namaUsaha.click();
  await namaUsaha.fill(NAMA_USAHA_TEST);

  // ===== Object khusus Migas: info Kondisi Tertentu Pasal 27 + unggah dokumen penetapan wilayah kerja =====
  await expect(page.getByText("Anda termasuk Kondisi Tertentu Pasal 27", { exact: false }).first()).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("Kegiatan terkait hulu minyak dan gas bumi", { exact: false }).first()).toBeVisible({ timeout: 60000 });

  // Tombol "Pilih Dokumen" membuka file chooser, bukan <input type="file">.
  const labelDokumenMigas = page.getByText("Unggah penetapan wilayah kerja migas", { exact: false }).first();
  await expect(labelDokumenMigas).toBeVisible({ timeout: 60000 });
  const grupDokumenMigas = labelDokumenMigas.locator("xpath=ancestor::*[.//button[normalize-space()='Pilih Dokumen']][1]");
  const fileChooserMigas = page.waitForEvent("filechooser", { timeout: 30000 });
  await grupDokumenMigas.getByRole("button", { name: "Pilih Dokumen" }).click();
  await (await fileChooserMigas).setFiles(FILE_DOKUMEN);
  // Setelah upload tombol "Pilih Dokumen" hilang sehingga scope grup tidak match lagi.
  await expect(page.getByText("SampleDocument.pdf", { exact: false }).first()).toBeVisible({ timeout: 60000 });
  await tungguUploadSelesai(page);
  await lihatDokumenDanKembali(page);

  // ===== Verifikasi Bidang Usaha =====
  await expect(page.getByText("Kegiatan Usaha Utama", { exact: true }).first()).toBeVisible({ timeout: 60000 });
  await expect(page.getByText(KBLI_TEST, { exact: false }).first()).toBeVisible({ timeout: 60000 });

  await expect(tombolSelanjutnya).toBeVisible({ timeout: 60000 });
  await expect(tombolSelanjutnya).toBeEnabled({ timeout: 60000 });
  await tombolSelanjutnya.click();

  // ===== Form Rencana Teknis Bangunan =====
  const headingRencanaTeknis = page.getByRole("heading", { name: "Rencana Teknis Bangunan/Rencana Induk Kawasan", exact: true });
  await expect(headingRencanaTeknis).toBeVisible({ timeout: 120000 });
  const grupRencanaTeknis = headingRencanaTeknis.locator("xpath=ancestor::*[.//button[normalize-space()='Pilih Dokumen']][1]");
  const fileChooserRencana = page.waitForEvent("filechooser", { timeout: 30000 });
  await grupRencanaTeknis.getByRole("button", { name: "Pilih Dokumen" }).click();
  await (await fileChooserRencana).setFiles(FILE_DOKUMEN);
  await expect(page.getByText("SampleDocument.pdf", { exact: false }).last()).toBeVisible({ timeout: 60000 });
  await tungguUploadSelesai(page);
  await lihatDokumenDanKembali(page);

  const grupBangunanBaru = page.locator("div", { hasText: "Apakah Membutuhkan Bangunan Baru Pada Kegiatan Usaha ini ?" }).last();
  const radioYaBangunanBaru = grupBangunanBaru.getByRole("radio", { name: "Ya" });
  await radioYaBangunanBaru.check({ force: true });
  await expect(radioYaBangunanBaru).toBeChecked({ timeout: 60000 });

  const grupStatusBangunan = page.locator("div", { hasText: "Status Bangunan" }).last();
  const radioMilikSendiri = grupStatusBangunan.getByRole("radio", { name: /Milik\s*Sendiri/i });
  await radioMilikSendiri.check({ force: true });
  await expect(radioMilikSendiri).toBeChecked({ timeout: 60000 });

  await page.locator("//input[@placeholder='Rencana Jumlah Bangunan']").fill("1");
  await page.locator("//input[@placeholder='Rencana Jumlah Lantai Bangunan']").fill("2");
  await page.locator("//input[@placeholder='Rencana Luas Lantai Bangunan']").fill("100");

  const tombolProses = page.getByRole("button", { name: "Proses", exact: true });
  await expect(tombolProses).toBeEnabled({ timeout: 60000 });
  await tombolProses.click();

  // ===== Verifikasi Dokumen Terbit =====
  const barisDokumen = page.getByRole("row").filter({ hasText: "Persetujuan KKPR Kondisi Tertentu" }).first();
  await expect(barisDokumen).toBeVisible({ timeout: 60000 });
  // Status di kolom tabel dipotong elipsis ("Menunggu verifikasi kondisi te…")
  await expect(barisDokumen).toContainText("Menunggu verifikasi kondisi", { timeout: 60000 });
  await expect(barisDokumen.getByRole("button", { name: "Menunggu Verifikasi" })).toBeVisible({ timeout: 60000 });
});
