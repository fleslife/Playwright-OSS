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
const NAMA_USAHA_TEST = `AutomationTest KKPR_Penilaian_${tanggalDdmmyyyy()}`;
const FILE_DOKUMEN = "./tests/UploadFile/SampleDocument.pdf";

/**
 * Menunggu widget upload selesai. Tombol Proses bisa diklik sebelum file selesai
 * diunggah; server lalu menolak validasi tanpa pesan error di UI sehingga
 * halaman tampak "hang" di step yang sama.
 */
async function tungguUploadSelesai(scope) {
  await expect(scope.locator(".v-progress-linear--active")).toHaveCount(0, { timeout: 120000 });
  await expect(scope.locator(".v-input--error")).toHaveCount(0, { timeout: 60000 });
}


test("Positive Case: KKPR Penilaian", async ({ page }) => {
  // Timeout total test dinaikkan karena banyak expect memakai timeout 60s.
  test.setTimeout(300_000);

  await login(page, { environment: "staging", zoomOut: true });

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
  // Input radio native sering tersembunyi di balik styling Vuetify -> pakai force
  await radioPerizinanLama.click({ force: true });
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
  await kbliInput.pressSequentially("56101", { delay: 200 });
  const opsiKbliPertama = page.getByText("56101", { exact: false }).first();
  await expect(opsiKbliPertama).toBeVisible({ timeout: 60000 });
  await opsiKbliPertama.click();
  await page.getByRole("button", { name: "Mengerti" }).last().click();
  const ruangLingkup = page.getByRole("combobox", { name: "Pilih ruang lingkup kegiatan" });
  await expect(ruangLingkup).toBeVisible({ timeout: 60000 });
  await ruangLingkup.click();
  await page.getByText("Restoran", { exact: true }).first().click();
  await page.getByRole("button", { name: "Tambah Bidang Usaha" }).click();

  // Popup peringatan muncul karena lokasi test tidak memiliki dokumen RDTR
  await expect(page.getByText("RDTR Tidak Tersedia", { exact: false })).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: "test-results/screenshot-rdtr-tidak-tersedia.png", fullPage: true });
  await page.getByRole("button", { name: "Mengerti" }).last().click();

  const namaUsaha = page.getByRole("textbox", { name: "Contoh : Restoran" });
  await expect(namaUsaha).toBeVisible({ timeout: 60000 });
  await namaUsaha.click();
  await namaUsaha.fill(NAMA_USAHA_TEST);

  const grupLahan = page.locator("div", { hasText: "Apakah Anda sudah menguasai lahan" }).last();
  const radioTidakLahan = grupLahan.getByRole("radio", { name: "Tidak" });
  await expect(radioTidakLahan).toBeVisible({ timeout: 60000 });
  // Klik label-nya (input native-nya biasanya tersembunyi)
  await grupLahan.getByText("Tidak", { exact: true }).first().click();
  await expect(radioTidakLahan).toBeChecked({ timeout: 60000 });

  // ===== VERIFIKASI POSITIF =====
  await expect(page.getByText("Kegiatan Usaha Utama", { exact: true }).first()).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("56101 - Aktivitas Penyediaan Makanan di Bangunan Tetap").first()).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("Restoran").first()).toBeVisible({ timeout: 60000 });

  await expect(tombolSelanjutnya).toBeVisible({ timeout: 60000 });
  await expect(tombolSelanjutnya).toBeEnabled({ timeout: 60000 });
  await tombolSelanjutnya.click();

  // ===== Form Rencana Teknis Bangunan =====
  const bagianRencanaTeknis = page.locator("div", { hasText: "Rencana Teknis Bangunan/Rencana Induk Kawasan" }).last();
  await expect(bagianRencanaTeknis).toBeVisible({ timeout: 60000 });
  await bagianRencanaTeknis.locator('input[type="file"]').setInputFiles(FILE_DOKUMEN);

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

  // Proses tidak akan berjalan jika upload Rencana Teknis belum selesai.
  await tungguUploadSelesai(page);

  const tombolProses = page.getByRole("button", { name: "Proses", exact: true });
  await expect(tombolProses).toBeEnabled({ timeout: 60000 });
  await tombolProses.click();

  // ===== Pernyataan 7 Points =====
  const modalPernyataan = page.getByRole("dialog").filter({ hasText: "Dengan ini menyatakan dengan sebenar-benarnya dan bertanggung jawab sepenuhnya bahwa:" }).last();
  await expect(modalPernyataan).toBeVisible({ timeout: 60000 });

  const kotakPernyataan = modalPernyataan.getByRole("checkbox");
  await expect(kotakPernyataan).toHaveCount(7, { timeout: 60000 });
  for (let index = 0; index < 7; index += 1) {
    // Checkbox native di modal juga bisa tersembunyi -> check dengan force
    await kotakPernyataan.nth(index).check({ force: true });
    await expect(kotakPernyataan.nth(index)).toBeChecked({ timeout: 60000 });
  }

  const tombolProsesModal = modalPernyataan.getByRole("button", { name: "Proses", exact: true }).last();

  // Klik bisa tertahan overlay/animasi modal atau tombol berubah jadi loading
  // saat diklik -> fallback: force click, lalu dispatch event langsung.
  await tombolProsesModal.scrollIntoViewIfNeeded();
  try {
    await tombolProsesModal.click({ timeout: 15000 });
  } catch {
    try {
      await tombolProsesModal.click({ force: true, timeout: 15000 });
    } catch {
      // Elemen hilang kemungkinan proses sudah terpicu; dispatch hanya bila masih ada.
      if (await tombolProsesModal.count()) {
        await tombolProsesModal.dispatchEvent("click");
      }
    }
  }

  // ===== Verifikasi Dokumen Terbit =====
  await expect(page.getByText("Persetujuan KKPR Penilaian (Utama)", { exact: false })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText(/Menunggu Verifikasi Persyarata/i)).toBeVisible({ timeout: 60000 });
});
