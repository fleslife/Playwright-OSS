import { test, expect } from "@playwright/test";
import { login } from "../helpers/login.js";

const NAMA_LOKASI_TEST = "Automation_Darat_NonRDTR";
const NAMA_USAHA_TEST = "AutomationTest PKKPR_TanpaPenilaian_PenguasaanLahan";
const FILE_DOKUMEN = "./tests/UploadFile/SampleDocument.pdf";

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

test("Positive Case: PKKPR Tanpa Penilaian - Penguasaan Lahan: Non-Kondisi", async ({ page }) => {
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

  // Jika muncul beberapa data sama/serupa, pilih yang pertama/paling atas.
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
  await expect(page.getByText("Nama Penerbit Dokumen")).toBeVisible({ timeout: 60000 });
  await page.getByRole("textbox", { name: "Nama Penerbit Dokumen" }).fill(NAMA_USAHA_TEST);
  await expect(page.getByText("Nomor Dokumen", { exact: false }).first()).toBeVisible({ timeout: 60000 });
  await page.getByRole("textbox", { name: "Nomor Dokumen" }).fill(NAMA_USAHA_TEST);
  await expect(page.getByText("Tanggal Terbit Dokumen")).toBeVisible({ timeout: 60000 });
  await isiRentangTanggal(page, 1, 2);
  await unggahDanLihatDokumen(page);
  await page.locator("(//input[@placeholder='Luas Lahan'])[1]").fill("1.234,56");
  await page.getByRole("radio", { name: "Telah dikuasai Pelaku Usaha Lain dan dialihkan ke Pelaku Usaha Baru dengan jenis kegiatan usaha yang sama." }).check();
  await expect(page.getByText("Kondisi Tertentu Pasal 27 ayat 2.c.")).toBeVisible({ timeout: 60000 });
  await page.getByRole("combobox", { name: "Pilih jenis dokumen" }).click();
  await page.getByText("Akta jual beli, dokumen", { exact: false }).first().click();
  await page.getByRole("textbox", { name: "Contoh:" }).fill(NAMA_USAHA_TEST);
  await page.locator("(//input[@placeholder='Luas Lahan'])[2]").fill("1.234,56");
  await page.getByRole("textbox", { name: "Masukkan nama sesuai data" }).fill(NAMA_USAHA_TEST);
  await isiRentangTanggal(page, 3, 4);
  await unggahDanLihatDokumen(page);

  // ===== Penguasaan Lahan: Sewa =====
  await page.getByRole("radio", { name: "Sewa" }).check();
  await expect(page.getByText("Nama Pemilik lahan")).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("Nomor Perjanjian")).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("Tanggal Perjanjian")).toBeVisible({ timeout: 60000 });
  await page.getByRole("radio", { name: "Telah dikuasai Pelaku Usaha Lain dan disewakan/pinjam pakai dengan jenis kegiatan usaha yang sama." }).check();
  await expect(page.getByText("Kondisi Tertentu Pasal 27 ayat 2.d.")).toBeVisible({ timeout: 60000 });
  await page.locator("(//input[@role='combobox' and @inline='true'])[2]").click();
  await page.getByRole("option", { name: "Dokumen perjanjian sewa", exact: false }).first().click();

  // ===== Penguasaan Lahan: Non Kondisi =====
  await page.getByRole("radio", { name: "Tidak termasuk kondisi di atas" }).check();
  await expect(page.getByText("Permohonan Anda termasuk Penilaian KKPR", { exact: false })).toBeVisible({ timeout: 60000 });

  // ===== Verifikasi Positif =====
  await expect(page.getByText("Kegiatan Usaha Utama", { exact: true }).first()).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("56101 - Aktivitas Penyediaan Makanan di Bangunan Tetap").first()).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("Restoran").first()).toBeVisible({ timeout: 60000 });

  const tombolSelanjutnyaForm = page.getByRole("button", { name: "Selanjutnya" });
  await expect(tombolSelanjutnyaForm).toBeVisible({ timeout: 60000 });
  await expect(tombolSelanjutnyaForm).toBeEnabled({ timeout: 60000 });
  await page.getByRole("button", { name: "Selanjutnya" }).click();

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

  const tombolProses = page.getByRole("button", { name: "Proses", exact: true });
  await expect(tombolProses).toBeEnabled({ timeout: 60000 });
  await tombolProses.click();

  // ===== Pernyataan 7 Points =====
  await page.getByRole("checkbox", { name: "Bidang tanah tidak dalam" }).check();
  await page.getByRole("checkbox", { name: "Bahwa apabila di kemudian" }).check();
  await page.getByRole("checkbox", { name: "Bahwa apabila dokumen" }).check();
  await page.getByRole("checkbox", { name: "Bahwa mengenai kebenaran" }).check();
  await page.getByRole("checkbox", { name: "Sebidang tanah sudah dikuasai" }).check();
  await page.getByRole("checkbox", { name: "Bidang tanah tersebut telah tercatat dalam daftar inventaris aset pemohon" }).check();
  await page.getByRole("checkbox", { name: "Bidang tanah tersebut telah dilakukan pembangunan dan/atau kegiatan." }).check();
  await page.getByTestId("modal-proses").getByRole("button", { name: "Proses" }).click();

  // ===== Verifikasi Positif: Permohonan berhasil dibuat =====
  await expect(page.getByText("Persetujuan KKPR Penilaian (")).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("Menunggu Verifikasi Persyarata…")).toBeVisible({ timeout: 60000 });
});
