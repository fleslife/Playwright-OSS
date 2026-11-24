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
const NAMA_USAHA_TEST = `AutomationTest SKPBKI_${tanggalDdmmyyyy()}`;
const KBLI_TEST = "15201";
const RUANG_LINGKUP_TEST = "Seluruh";
const FILE_DOKUMEN = "./tests/UploadFile/SampleDocument.pdf";

/** Jika di-click saat upload belum selesai, server menolak validasi tanpa pesan error di UI. */
async function tungguUploadSelesai(scope) {
  await expect(scope.locator(".v-progress-linear--active")).toHaveCount(0, { timeout: 120000 });
  await expect(scope.locator(".v-input--error")).toHaveCount(0, { timeout: 60000 });
}

/** Popup informasi (penyesuaian KBLI / RDTR) tidak selalu muncul, tergantung data master. */
async function tutupPopupJikaMuncul(page, teksPopup, timeout = 20000) {
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

test("Positive Case: SKPBKI", async ({ page }) => {
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

  // ===== Data Lokasi Usaha =====
  const lokasiUsaha = page.getByRole("combobox", { name: "Pilih lokasi usaha" });
  await expect(lokasiUsaha).toBeVisible({ timeout: 60000 });
  await lokasiUsaha.click();
  // Autocomplete memanggil server; mengetik terlalu cepat membuat hasil kosong.
  await lokasiUsaha.pressSequentially(NAMA_LOKASI_TEST, { delay: 200 });
  const opsiLokasiPertama = page.getByText(`Darat - ${NAMA_LOKASI_TEST}, Jawa Barat`, { exact: false }).first();
  await expect(opsiLokasiPertama).toBeVisible({ timeout: 60000 });
  await opsiLokasiPertama.click();

  // Obvitnas dan PSN dijawab "Tidak"; radio ketiga memakai value, bukan label.
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

  // ===== Kegiatan Usaha Utama =====
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

  // Popup ini menutupi dropdown berikutnya bila dibiarkan terbuka.
  await tutupPopupJikaMuncul(page, "PENYESUAIAN KBLI 2020 KE KBLI 2025");

  // Ambil opsi dari overlay aktif; dropdown lama bisa tertinggal di DOM.
  const ruangLingkup = page.getByRole("combobox", { name: "Pilih ruang lingkup kegiatan" });
  await expect(ruangLingkup).toBeVisible({ timeout: 60000 });
  await expect(ruangLingkup).toBeEnabled({ timeout: 60000 });
  await ruangLingkup.click();
  const opsiRuangLingkup = page.locator(".v-overlay--active .v-list-item").filter({ hasText: RUANG_LINGKUP_TEST }).first();
  await expect(opsiRuangLingkup).toBeVisible({ timeout: 60000 });
  await opsiRuangLingkup.click();
  await page.getByRole("button", { name: "Tambah Bidang Usaha" }).click();

  await tutupPopupJikaMuncul(page, "RDTR Tidak Tersedia");

  const barisBidangUsaha = page.getByRole("row").filter({ hasText: KBLI_TEST }).first();
  await expect(barisBidangUsaha).toBeVisible({ timeout: 60000 });
  await expect(barisBidangUsaha).toContainText(RUANG_LINGKUP_TEST, { timeout: 60000 });

  const namaUsaha = page.getByRole("textbox", { name: /Contoh\s*:\s*Restoran/ }).first();
  await expect(namaUsaha).toBeVisible({ timeout: 60000 });
  await namaUsaha.click();
  await namaUsaha.fill(NAMA_USAHA_TEST);

  // ===== Objek khusus SKPBKI: skala Menengah/Besar + pernyataan verifikasi industri =====
  const pertanyaanSkala = page
    .getByText("Apakah Usaha Anda termasuk skala Menengah atau Besar?", { exact: false })
    .first();
  await expect(pertanyaanSkala).toBeVisible({ timeout: 60000 });
  // Teks pertanyaan berada di luar wrapper radio -> naik ke ancestor terdekat yang punya radio.
  const grupSkala = pertanyaanSkala.locator("xpath=ancestor::*[.//input[@type='radio']][1]");
  const radioYaSkala = grupSkala.getByRole("radio", { name: "Ya", exact: true });
  // Input native tertutup Vuetify -> klik label teksnya.
  await grupSkala.getByText("Ya", { exact: true }).first().click();
  await expect(radioYaSkala).toBeChecked({ timeout: 60000 });

  await expect(
    page.getByText(/Nilai investasi\s*>\s*10M atau nilai pendapatan tahunan\s*>\s*50 M/).first()
  ).toBeVisible({ timeout: 60000 });

  const pernyataanVerifikasi = page
    .getByText("Dengan ini menyatakan bersedia dilakukan verifikasi kegiatan industri", { exact: false })
    .first();
  await expect(pernyataanVerifikasi).toBeVisible({ timeout: 60000 });
  const checkboxVerifikasi = pernyataanVerifikasi
    .locator("xpath=ancestor::*[.//input[@type='checkbox']][1]")
    .locator("input[type='checkbox']")
    .first();
  await checkboxVerifikasi.check({ force: true, timeout: 30000 });
  await expect(checkboxVerifikasi).toBeChecked({ timeout: 60000 });

  // Dijawab "Tidak" agar tidak masuk blok Penguasaan Lahan.
  const grupLahan = page.locator("div", { hasText: "Apakah Anda sudah menguasai lahan" }).last();
  const radioTidakLahan = grupLahan.getByRole("radio", { name: "Tidak" });
  await expect(radioTidakLahan).toBeVisible({ timeout: 60000 });
  await grupLahan.getByText("Tidak", { exact: true }).first().click();
  await expect(radioTidakLahan).toBeChecked({ timeout: 60000 });

  await expect(tombolSelanjutnya).toBeVisible({ timeout: 60000 });
  await expect(tombolSelanjutnya).toBeEnabled({ timeout: 60000 });
  await tombolSelanjutnya.click();

  // ===== Rencana Teknis Bangunan =====
  const bagianRencanaTeknis = page.locator("div", { hasText: "Rencana Teknis Bangunan/Rencana Induk Kawasan" }).last();
  await expect(bagianRencanaTeknis).toBeVisible({ timeout: 120000 });
  await bagianRencanaTeknis.locator('input[type="file"]').setInputFiles(FILE_DOKUMEN);
  await expect(page.getByText("SampleDocument.pdf", { exact: false }).first()).toBeVisible({ timeout: 60000 });

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

  await tungguUploadSelesai(page);

  const tombolProses = page.getByRole("button", { name: "Proses", exact: true });
  await expect(tombolProses).toBeEnabled({ timeout: 60000 });
  await tombolProses.click();

  // ===== Pernyataan 7 Points =====
  const modalPernyataan = page.getByRole("dialog")
    .filter({ hasText: "Dengan ini menyatakan dengan sebenar-benarnya dan bertanggung jawab sepenuhnya bahwa:" })
    .last();
  await expect(modalPernyataan).toBeVisible({ timeout: 60000 });

  const kotakPernyataan = modalPernyataan.getByRole("checkbox");
  await expect(kotakPernyataan).toHaveCount(7, { timeout: 60000 });
  for (let index = 0; index < 7; index += 1) {
    await kotakPernyataan.nth(index).check({ force: true });
    await expect(kotakPernyataan.nth(index)).toBeChecked({ timeout: 60000 });
  }
  await modalPernyataan.getByRole("button", { name: "Proses", exact: true }).last().click();

  // ===== Verifikasi dokumen terbit =====
  // Kolom status dipotong elipsis, jadi dicek lewat toContainText pada baris.
  const dokumenYangDiharapkan = [
    { nama: "Persetujuan KKPR Penilaian (Utama)", status: "Belum melengkapi persyaratan" },
    { nama: "Pengecualian Berlokasi di Kawasan Industri (Utama)", status: "Menunggu Verifikasi K/L" },
  ];

  for (const { nama, status } of dokumenYangDiharapkan) {
    const barisDokumen = page.getByRole("row").filter({ hasText: nama }).first();
    await expect(barisDokumen).toBeVisible({ timeout: 120000 });
    await expect(barisDokumen).toContainText(status, { timeout: 60000 });
  }
});
