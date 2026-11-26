/**
 * KKPR Darat — scenario UUCK (perizinan berusaha yang berlaku efektif sebelum UU Cipta Kerja).
 *
 * Alur: step 1 Data Lokasi Usaha (pertanyaan UUCK dijawab "Ya") -> step 2 Kegiatan Usaha
 * Utama + blok Perizinan efektif (Penerbit, Nomor, Tanggal Terbit, Dokumen izin) ->
 * Proses -> dialog konfirmasi -> Detail Perizinan tanpa dokumen/status.
 *
 * Form hanya 2 langkah: tidak ada blok Penguasaan Lahan, Rencana Teknis, maupun modal
 * Pernyataan 7 poin seperti pada scenario KKPR Penilaian.
 */
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
const NAMA_USAHA_TEST = `AutomationTest UUCK_${tanggalDdmmyyyy()}`;
const KBLI_TEST = "56101";
const RUANG_LINGKUP_TEST = "Restoran";
const FILE_DOKUMEN = "./tests/UploadFile/SampleDocument.pdf";

/**
 * Sel kalender "tanggal 1" pada bulan yang sedang tampil.
 * data-v-date berformat YYYY-MM-DD sehingga akhiran "-01" menandai tanggal 1.
 */
const XPATH_TANGGAL_01 =
  "(//div[substring(@data-v-date, string-length(@data-v-date) - string-length('-01') + 1) = '-01'])[1]";

/** Jika di-click saat upload belum selesai, server menolak validasi tanpa pesan error di UI. */
async function tungguUploadSelesai(scope) {
  await expect(scope.locator(".v-progress-linear--active")).toHaveCount(0, { timeout: 120000 });
  await expect(scope.locator(".v-input--error")).toHaveCount(0, { timeout: 60000 });
}

/**
 * Popup informasi (penyesuaian KBLI / RDTR) tidak selalu muncul, tergantung data master.
 * Popup di alur ini tampil maksimal ±4 detik setelah aksi pemicunya, jadi 10 detik sudah
 * cukup; bila popup tidak muncul helper menunggu sampai timeout habis sebelum lanjut.
 */
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

/**
 * Pratinjau dokumen setelah upload: panel pratinjau bukan v-overlay, jadi ditunggu
 * lewat tombol Kembali yang hilang. Tanpa langkah ini file bisa lolos assert nama
 * tapi belum benar-benar tersimpan di server.
 */
async function lihatDokumenDanKembali(page) {
  const tombolLihatDokumen = page.getByRole("button", { name: "Lihat Dokumen" }).last();
  await expect(tombolLihatDokumen).toBeVisible({ timeout: 60000 });
  await tombolLihatDokumen.click();
  const tombolKembali = page.getByRole("button", { name: "Kembali" }).last();
  await tombolKembali.click({ timeout: 120000 });
  await expect(tombolKembali).toHaveCount(0, { timeout: 60000 });
  await expect(page.locator(".v-overlay--active")).toHaveCount(0, { timeout: 60000 });
}

test("Positive Case: UUCK", async ({ page }) => {
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

  // Obvitnas dan PSN dijawab "Tidak".
  const radioTidakList = page.getByRole("radio", { name: "Tidak" });
  await expect(radioTidakList.first()).toBeVisible({ timeout: 60000 });

  await page.getByText("Tidak", { exact: true }).nth(0).click();
  await expect(radioTidakList.nth(0)).toBeChecked({ timeout: 60000 });

  await page.getByText("Tidak", { exact: true }).nth(1).click();
  await expect(radioTidakList.nth(1)).toBeChecked({ timeout: 60000 });

  // Pertanyaan UU Cipta Kerja dijawab "Ya" (value="02").
  const pertanyaanUuck = page
    .getByText("Apakah sudah memiliki perizinan berusaha yang Berlaku Efektif", { exact: false })
    .first();
  await expect(pertanyaanUuck).toBeVisible({ timeout: 60000 });
  // Teks pertanyaan berada di luar wrapper radio -> naik ke ancestor terdekat yang punya radio.
  const grupUuck = pertanyaanUuck.locator("xpath=ancestor::*[.//input[@type='radio']][1]");
  const radioYaUuck = grupUuck.getByRole("radio", { name: "Ya", exact: true });
  // Input native tertutup Vuetify -> klik label teksnya.
  await grupUuck.getByText("Ya", { exact: true }).first().click();
  await expect(radioYaUuck).toBeChecked({ timeout: 60000 });

  const tombolSelanjutnya = page.getByRole("button", { name: "Selanjutnya" });
  await expect(tombolSelanjutnya).toBeEnabled({ timeout: 60000 });
  await tombolSelanjutnya.click();

  // ===== Kegiatan Usaha Utama =====
  const jenisKegiatanInput = page.locator('div:has(> .v-input):has-text("Jenis Kegiatan Usaha") input');
  await expect(jenisKegiatanInput).toBeVisible({ timeout: 60000 });
  await jenisKegiatanInput.click();
  // Overlay memuat puluhan opsi KBLI; scope ke overlay aktif lalu filter teks.
  const opsiKegiatanUtama = page
    .locator(".v-overlay--active .v-list-item")
    .filter({ hasText: "Kegiatan Usaha Utama" })
    .first();
  await expect(opsiKegiatanUtama).toBeVisible({ timeout: 60000 });
  await opsiKegiatanUtama.click();

  const kbliInput = page.locator('div:has(> .v-input):has-text("Bidang Usaha") input').first();
  await expect(kbliInput).toBeVisible({ timeout: 60000 });
  await kbliInput.click();
  await kbliInput.pressSequentially(KBLI_TEST, { delay: 300 });
  const opsiKbli = page
    .locator('.v-overlay--active .v-list-item, .v-overlay--active [role="option"]')
    .filter({ hasText: KBLI_TEST })
    .first();
  await expect(opsiKbli).toBeVisible({ timeout: 60000 });
  await opsiKbli.click();

  // Popup ini menutupi dropdown berikutnya bila dibiarkan terbuka.
  await tutupPopupJikaMuncul(page, "PENYESUAIAN KBLI 2020 KE KBLI 2025");

  // Ambil opsi dari overlay aktif; dropdown lama bisa tertinggal di DOM.
  const ruangLingkup = page.getByRole("combobox", { name: "Pilih ruang lingkup kegiatan" });
  await expect(ruangLingkup).toBeVisible({ timeout: 60000 });
  await expect(ruangLingkup).toBeEnabled({ timeout: 60000 });
  await ruangLingkup.click();
  // Regex anchor menghindari opsi "Rumah / Warung Makan".
  const opsiRuangLingkup = page
    .locator(".v-overlay--active .v-list-item")
    .filter({ hasText: new RegExp(`^${RUANG_LINGKUP_TEST}$`) })
    .first();
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

  // ===== Perizinan berusaha yang berlaku efektif sebelum UU Cipta Kerja =====
  const bagianUuck = page
    .getByText("Perizinan Berusaha yang Berlaku Efektif Sebelum Implementasi UU No. 11 Tahun 2020", {
      exact: false,
    })
    .first();
  await expect(bagianUuck).toBeVisible({ timeout: 60000 });

  // Placeholder yang sama muncul dua kali (label + input), jadi pakai .first().
  await page.locator("input[placeholder='Masukan Penerbit Izizn']").first().fill(NAMA_USAHA_TEST);
  await page.locator("input[placeholder='Masukan Nomor Izin']").first().fill(NAMA_USAHA_TEST);

  // Tanggal Terbit selalu tanggal 1 pada bulan berjalan.
  const tanggalTerbit = page.locator("input[name='date']").first();
  await tanggalTerbit.click();
  const selTanggalSatu = page.locator(XPATH_TANGGAL_01);
  await expect(selTanggalSatu).toBeVisible({ timeout: 60000 });
  await selTanggalSatu.click();
  await expect(tanggalTerbit).toHaveValue(/^01\/\d{2}\/\d{4}$/, { timeout: 60000 });

  const labelDokumen = page.getByText("Dokumen izin", { exact: true }).first();
  await expect(labelDokumen).toBeVisible({ timeout: 60000 });
  const grupDokumen = labelDokumen.locator("xpath=ancestor::*[.//button[normalize-space()='Pilih Dokumen']][1]");
  const fileChooser = page.waitForEvent("filechooser", { timeout: 60000 });
  await grupDokumen.getByRole("button", { name: "Pilih Dokumen" }).click();
  await (await fileChooser).setFiles(FILE_DOKUMEN);

  // Setelah upload sukses tombol "Pilih Dokumen" berubah jadi nama file + "Lihat Dokumen".
  await expect(page.getByText("SampleDocument.pdf", { exact: false }).first()).toBeVisible({ timeout: 120000 });
  await tungguUploadSelesai(page);
  await lihatDokumenDanKembali(page);
  // Popup RDTR bisa muncul lagi setelah pratinjau ditutup.
  await tutupPopupJikaMuncul(page, "RDTR Tidak Tersedia", 5000);

  const tombolProses = page.getByRole("button", { name: "Proses", exact: true });
  await expect(tombolProses).toBeEnabled({ timeout: 60000 });
  await tombolProses.click();

  // ===== Konfirmasi pengiriman permohonan =====
  const dialogKonfirmasi = page
    .getByRole("dialog")
    .filter({ hasText: "Yakin Melanjutkan Permohonan Ini?" })
    .last();
  await expect(dialogKonfirmasi).toBeVisible({ timeout: 60000 });
  await expect(dialogKonfirmasi).toContainText("dikirim ke Verifikator", { timeout: 60000 });
  await dialogKonfirmasi.getByRole("button", { name: "Mengerti" }).click();

  // ===== Detail Perizinan =====
  await page.waitForURL(/detail-kegiatan/i, { timeout: 120000 });
  await expect(page.getByText("Detail Perizinan", { exact: true }).first()).toBeVisible({ timeout: 120000 });

  const tabPersyaratanDasar = page.getByRole("tab", { name: "Persyaratan Dasar", exact: true });
  await expect(tabPersyaratanDasar).toBeVisible({ timeout: 60000 });
  await expect(tabPersyaratanDasar).toHaveAttribute("aria-selected", "true", { timeout: 60000 });

  // Persyaratan dasar belum punya dokumen: tiap tabel hanya berisi header + empty state.
  const bagianTanpaDokumen = [
    { judul: "Tata Ruang", indexTabel: 0 },
    { judul: "Lingkungan", indexTabel: 1 },
  ];

  for (const { judul, indexTabel } of bagianTanpaDokumen) {
    await expect(page.getByRole("heading", { name: judul, exact: true })).toBeVisible({ timeout: 60000 });

    const tabel = page.getByRole("table").filter({ hasText: "Status Pengiriman" }).nth(indexTabel);
    await expect(tabel.getByText("Data tidak ditemukan", { exact: true })).toBeVisible({ timeout: 60000 });
    // Header + baris empty state saja, tanpa baris dokumen.
    await expect(tabel.getByRole("row")).toHaveCount(2, { timeout: 60000 });
  }
});
