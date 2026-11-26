import { test, expect } from "@playwright/test";
import { login } from "../helpers/login.js";

const NAMA_LOKASI_TEST = "Automation_Darat_NonRDTR";
const NAMA_USAHA_TEST = `AutomationTest WIUP_05101_${tanggalDdmmyyyy()}`;
const KBLI_TEST = "05101";
const RUANG_LINGKUP_TEST = "IUP Tahap eksplorasi";
const FILE_DOKUMEN = "./tests/UploadFile/SampleDocument.pdf";

/** Nomor WIUP memakai tanggal run dengan format ddMMyyyy numerik, contoh: 24112026. */
function tanggalDdmmyyyy() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${dd}${mm}${now.getFullYear()}`;
}

const NOMOR_WIUP_TEST = tanggalDdmmyyyy();

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

/**
 * Khusus 05101: popup RDTR lalu "Kegiatan Usaha Tidak Memerlukan Izin KKPR"
 * muncul berurutan. Dialog pertama butuh waktu karena menunggu server, sedangkan
 * dialog lanjutan hampir seketika setelah yang sebelumnya ditutup. Jadi dialog
 * pertama ditunggu panjang, dialog lanjutan hanya diberi jendela pendek supaya
 * tidak membuang puluhan detik saat rangkaian popup sudah berakhir.
 */
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

/** Panel pratinjau bukan v-overlay, jadi ditunggu lewat tombol Kembali yang hilang. */
async function lihatDokumenDanKembali(page) {
  await page.getByRole("button", { name: "Lihat Dokumen" }).last().click({ timeout: 60000 });
  const tombolKembali = page.getByRole("button", { name: "Kembali" }).last();
  await tombolKembali.click({ timeout: 120000 });
  await expect(tombolKembali).toHaveCount(0, { timeout: 60000 });
  await expect(page.locator(".v-overlay--active")).toHaveCount(0, { timeout: 60000 });
}

test("Positive Case: WIUP 05101 (Tanpa KKPR, Terbit Otomatis)", async ({ page }) => {
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

  // Radio "Tidak" harus diklik lewat label karena input native tertutup Vuetify.
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

  await tutupPopupJikaMuncul(page, "PENYESUAIAN KBLI 2020 KE KBLI 2025");

  // Opsi diambil dari overlay aktif; dropdown lama bisa tertinggal di DOM.
  const ruangLingkup = page.getByRole("combobox", { name: "Pilih ruang lingkup kegiatan" });
  await expect(ruangLingkup).toBeVisible({ timeout: 60000 });
  await expect(ruangLingkup).toBeEnabled({ timeout: 60000 });
  await ruangLingkup.click();
  const opsiRuangLingkup = page.locator(".v-overlay--active .v-list-item").filter({ hasText: RUANG_LINGKUP_TEST }).first();
  await expect(opsiRuangLingkup).toBeVisible({ timeout: 60000 });
  await opsiRuangLingkup.click();
  await page.getByRole("button", { name: "Tambah Bidang Usaha" }).click();

  // KBLI 05101 dikecualikan dari KKPR, jadi muncul popup RDTR lalu popup
  // "Kegiatan Usaha Tidak Memerlukan Izin KKPR". Keduanya memblokir form.
  await tutupPopupBidangUsaha(page);

  const barisBidangUsaha = page.getByRole("row").filter({ hasText: KBLI_TEST }).first();
  await expect(barisBidangUsaha).toBeVisible({ timeout: 60000 });
  await expect(barisBidangUsaha).toContainText(RUANG_LINGKUP_TEST, { timeout: 60000 });

  const namaUsaha = page.getByRole("textbox", { name: /Contoh\s*:\s*Restoran/ }).first();
  await expect(namaUsaha).toBeVisible({ timeout: 60000 });
  await namaUsaha.click();
  await namaUsaha.fill(NAMA_USAHA_TEST);

  // ===== Objek khusus WIUP: status perizinan tambang, nomor, dan dokumen =====
  const pertanyaanWiup = page.getByText("Apakah Sudah Memiliki WIUP/WIUPK/WIP?", { exact: false }).first();
  await expect(pertanyaanWiup).toBeVisible({ timeout: 60000 });
  // Teks pertanyaan berada di luar wrapper radio -> naik ke ancestor terdekat yang punya radio.
  const grupWiup = pertanyaanWiup.locator("xpath=ancestor::*[.//input[@type='radio']][1]");
  const radioSudahWiup = grupWiup.getByRole("radio", { name: "Sudah", exact: true });
  await grupWiup.getByText("Sudah", { exact: true }).first().click();
  await expect(radioSudahWiup).toBeChecked({ timeout: 60000 });

  // Pilihan ini baru muncul setelah "Sudah" dipilih.
  const radioLuarOss = page.getByRole("radio", { name: "Terbit di luar sistem OSS", exact: true });
  await expect(radioLuarOss).toBeVisible({ timeout: 60000 });
  await page.getByText("Terbit di luar sistem OSS", { exact: true }).first().click();
  await expect(radioLuarOss).toBeChecked({ timeout: 60000 });

  const nomorWiup = page.getByRole("textbox", { name: /Nomor WIUP\/WIUPK\/WIP/ }).first();
  await expect(nomorWiup).toBeVisible({ timeout: 60000 });
  await nomorWiup.click();
  await nomorWiup.fill(NOMOR_WIUP_TEST);
  await expect(nomorWiup).toHaveValue(NOMOR_WIUP_TEST);

  // Upload memakai tombol "Pilih Dokumen" yang membuka file chooser, bukan input file.
  const labelDokumenWiup = page.getByText("Unggah Dokumen WIUP/WIUPK/WIP", { exact: false }).first();
  await expect(labelDokumenWiup).toBeVisible({ timeout: 60000 });
  const grupDokumenWiup = labelDokumenWiup.locator("xpath=ancestor::*[.//button[normalize-space()='Pilih Dokumen']][1]");
  const fileChooserWiup = page.waitForEvent("filechooser", { timeout: 30000 });
  await grupDokumenWiup.getByRole("button", { name: "Pilih Dokumen" }).click();
  await (await fileChooserWiup).setFiles(FILE_DOKUMEN);
  // Setelah upload sukses tombol "Pilih Dokumen" hilang, jadi nama file dicek di level page.
  await expect(page.getByText("SampleDocument.pdf", { exact: false }).first()).toBeVisible({ timeout: 60000 });
  await tungguUploadSelesai(page);
  await lihatDokumenDanKembali(page);

  // ===== Konfirmasi proses permohonan =====
  await expect(tombolSelanjutnya).toBeVisible({ timeout: 60000 });
  await expect(tombolSelanjutnya).toBeEnabled({ timeout: 60000 });
  await tombolSelanjutnya.click();

  const dialogKonfirmasi = page.getByRole("dialog").filter({ hasText: "Yakin Memproses Permohonan Ini?" }).last();
  await expect(dialogKonfirmasi).toBeVisible({ timeout: 60000 });
  await expect(dialogKonfirmasi).toContainText("Kementerian ESDM", { timeout: 60000 });
  await dialogKonfirmasi.getByRole("button", { name: "Mengerti" }).click();

  // ===== Rencana Teknis Bangunan =====
  await expect(page.getByText("Data Bangunan", { exact: true }).first()).toBeVisible({ timeout: 120000 });

  // "Apakah Membutuhkan Bangunan Baru" sudah terpilih "Tidak" secara default.
  await page.locator('input[type="file"]').last().setInputFiles(FILE_DOKUMEN);
  await expect(page.getByText("SampleDocument.pdf", { exact: false }).first()).toBeVisible({ timeout: 60000 });
  await tungguUploadSelesai(page);

  const tombolProses = page.getByRole("button", { name: "Proses", exact: true });
  await expect(tombolProses).toBeEnabled({ timeout: 60000 });
  await tombolProses.first().click();

  // ===== Verifikasi dokumen terbit =====
  const barisDokumen = page
    .getByRole("row")
    .filter({ hasText: "Tanpa KKPR (Utama)" })
    .filter({ hasText: "Terbit Otomatis" })
    .first();
  await expect(barisDokumen).toBeVisible({ timeout: 120000 });
});