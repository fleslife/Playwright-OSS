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
const NAMA_USAHA_TEST = `AutomationTest MBR_${tanggalDdmmyyyy()}`;
const KBLI_TEST = "68111";
const FILE_DOKUMEN = "./tests/UploadFile/SampleDocument.pdf";

/** Jika di-click saat upload belum selesai, server menolak validasi tanpa pesan error di UI. */
async function tungguUploadSelesai(scope) {
  await expect(scope.locator(".v-progress-linear--active")).toHaveCount(0, { timeout: 120000 });
  await expect(scope.locator(".v-input--error")).toHaveCount(0, { timeout: 60000 });
}

/** Unggah lewat tombol "Pilih Dokumen", buka pratinjau, lalu kembali ke form. */
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

test("Positive Case: MBR", async ({ page }) => {
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
  // Autocomplete memanggil server, delay diperlukan agar hasil tidak kosong.
  await lokasiUsaha.pressSequentially(NAMA_LOKASI_TEST, { delay: 200 });
  const opsiLokasiPertama = page.getByText(`Darat - ${NAMA_LOKASI_TEST}, Jawa Barat`, { exact: false }).first();
  await expect(opsiLokasiPertama).toBeVisible({ timeout: 60000 });
  await opsiLokasiPertama.click();

  // Jawab "Tidak" untuk Obvitnas, PSN, dan perizinan lama.
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

  await expect(page.getByText("KBLI 2020 (Sebelumnya)", { exact: false })).toBeVisible({ timeout: 60000 });
  // Nilainya ada di value input readonly, bukan text node.
  const kbli2020Value = page.getByText("KBLI 2020 (Sebelumnya)", { exact: false }).locator("xpath=following::input[1]");
  await expect(kbli2020Value).toHaveValue(new RegExp(`^${KBLI_TEST}`), { timeout: 60000 });

  // MBR wajib memilih KBLI 2025 sebelum Ruang Lingkup Kegiatan aktif.
  const kbli2025Input = page.locator('div:has(> .v-input):has-text("Pilih KBLI 2025") input').last();
  await expect(kbli2025Input).toBeVisible({ timeout: 60000 });
  await kbli2025Input.click();
  const opsiKbli2025 = page.getByRole("option").filter({ hasText: KBLI_TEST }).first();
  await expect(opsiKbli2025).toBeVisible({ timeout: 60000 });
  await opsiKbli2025.click();
  await expect(page.getByText(`${KBLI_TEST} - Aktivitas Pengembangan Bangunan dan Lahan Hunian`, { exact: false }).first()).toBeVisible({ timeout: 60000 });

  // Ambil opsi dari overlay yang aktif; dropdown lama bisa tertinggal di DOM.
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
    await page.screenshot({ path: "test-results/screenshot-rdtr-tidak-tersedia-mbr.png", fullPage: true });
    await page.getByRole("button", { name: "Mengerti" }).last().click();
  }

  const namaUsaha = page.getByRole("textbox", { name: "Contoh : Restoran" });
  await expect(namaUsaha).toBeVisible({ timeout: 60000 });
  await namaUsaha.click();
  await namaUsaha.fill(NAMA_USAHA_TEST);

  // ===== Object khusus MBR: pertanyaan, info Kondisi Tertentu, unggah dokumen RTR =====
  // Teks pertanyaan berada di luar wrapper radio Vuetify -> naik ke ancestor terdekat yang punya radio.
  const pertanyaanMbr = page
    .getByText("Apakah Anda melakukan pembangunan rumah bagi masyarakat berpenghasilan rendah", { exact: false })
    .first();
  await expect(pertanyaanMbr).toBeVisible({ timeout: 60000 });
  const grupMbr = pertanyaanMbr.locator("xpath=ancestor::*[.//input[@type='radio']][1]");
  const radioYaMbr = grupMbr.getByRole("radio", { name: "Ya", exact: true });
  await radioYaMbr.check({ force: true, timeout: 30000 });
  await expect(radioYaMbr).toBeChecked({ timeout: 60000 });

  await expect(page.getByText("Anda termasuk Kondisi Tertentu Pasal 27", { exact: false })).toBeVisible({ timeout: 60000 });

  // Muncul setelah radio "Ya" dipilih; tanpa dicentang tombol Selanjutnya tidak bisa lanjut.
  const checkboxPernyataanMbr = page.locator("//input[starts-with(@id,'checkbox-v-')]");
  await expect(checkboxPernyataanMbr).toBeVisible({ timeout: 60000 });
  await checkboxPernyataanMbr.check({ force: true, timeout: 30000 });
  await expect(checkboxPernyataanMbr).toBeChecked({ timeout: 60000 });

  // Upload memakai tombol "Pilih Dokumen" yang membuka file chooser, bukan <input type="file">.
  const labelDokumenRtr = page.getByText("Unggah dokumen pendukung sesuai RTR", { exact: true }).first();
  await expect(labelDokumenRtr).toBeVisible({ timeout: 60000 });
  const grupDokumenRtr = labelDokumenRtr.locator("xpath=ancestor::*[.//button[normalize-space()='Pilih Dokumen']][1]");
  await unggahDanLihatDokumen(page, grupDokumenRtr.getByRole("button", { name: "Pilih Dokumen" }));
  await tungguUploadSelesai(page);

  // ===== VERIFIKASI POSITIF =====
  await expect(page.getByText("Kegiatan Usaha Utama", { exact: true }).first()).toBeVisible({ timeout: 60000 });
  await expect(page.getByText(KBLI_TEST, { exact: false }).first()).toBeVisible({ timeout: 60000 });

  await expect(tombolSelanjutnya).toBeVisible({ timeout: 60000 });
  await expect(tombolSelanjutnya).toBeEnabled({ timeout: 60000 });
  await tombolSelanjutnya.click();

  // ===== Form Rencana Teknis Bangunan =====
  const headingRencanaTeknis = page.getByRole("heading", { name: "Rencana Teknis Bangunan/Rencana Induk Kawasan", exact: true });
  await expect(headingRencanaTeknis).toBeVisible({ timeout: 120000 });
  const grupRencanaTeknis = headingRencanaTeknis.locator("xpath=ancestor::*[.//button[normalize-space()='Pilih Dokumen']][1]");
  await unggahDanLihatDokumen(page, grupRencanaTeknis.getByRole("button", { name: "Pilih Dokumen" }));
  await tungguUploadSelesai(page);

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
