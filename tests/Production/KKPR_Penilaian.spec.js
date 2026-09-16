import { test, expect } from '@playwright/test';
import { login } from '../helpers/login.js';

const NAMA_LOKASI_TEST = 'Automation_Darat_NonRDTR';
const NAMA_USAHA_TEST = 'AutomationTest KKPR_Penilaian';

test('Positive Case: KKPR Penilaian', async ({ page }) => {
  test.setTimeout(180_000);

  await login(page, { zoomOut: true });

  // ===== Navigasi ke halaman Tambah Kegiatan Usaha =====
  const menuPerizinan = page.getByText(' Perizinan Berusaha ', { exact: true });
  await expect(menuPerizinan).toBeVisible({ timeout: 30000 });
  await menuPerizinan.click();
  await page.getByText('Kelola Usaha').click();

  const menuKegiatanUsaha = page.getByText('Kegiatan Usaha', { exact: true }).first();
  await expect(menuKegiatanUsaha).toBeVisible({ timeout: 30000 });
  await menuKegiatanUsaha.click();
  await page.getByRole('button', { name: 'Tambah Kegiatan Usaha' }).click();

  // ===== Form Data Lokasi Usaha =====
  const lokasiUsaha = page.getByRole('combobox', { name: 'Pilih lokasi usaha' });
  await expect(lokasiUsaha).toBeVisible({ timeout: 30000 });
  await lokasiUsaha.click();
  // Ketik lambat agar autocomplete sempat memuat hasil dari server
  await lokasiUsaha.pressSequentially(NAMA_LOKASI_TEST, { delay: 200 });

  const opsiLokasi = page.getByText(`Darat - ${NAMA_LOKASI_TEST}, Jawa Barat`);
  await expect(opsiLokasi).toBeVisible({ timeout: 15000 });
  await opsiLokasi.first().click();

  // Jawab "Tidak" untuk Obvitnas, PSN, dan perizinan lama.
  const radioTidakList = page.getByRole('radio', { name: 'Tidak' });
  await expect(radioTidakList.first()).toBeVisible({ timeout: 30000 });

  await page.getByText('Tidak', { exact: true }).nth(0).click();
  await expect(radioTidakList.nth(0)).toBeChecked({ timeout: 5000 });

  await page.getByText('Tidak', { exact: true }).nth(1).click();
  await expect(radioTidakList.nth(1)).toBeChecked({ timeout: 5000 });

  const radioPerizinanLama = page.locator('//input[@type="radio" and @value="01"]');
  await radioPerizinanLama.scrollIntoViewIfNeeded();
  await radioPerizinanLama.click();
  await expect(radioPerizinanLama).toBeChecked({ timeout: 5000 });

  const tombolSelanjutnya = page.getByRole('button', { name: 'Selanjutnya' });
  await expect(tombolSelanjutnya).toBeEnabled({ timeout: 15000 });
  await tombolSelanjutnya.click();

  // ===== Form Kegiatan Usaha Utama =====
  const jenisKegiatanInput = page.locator('div:has(> .v-input):has-text("Jenis Kegiatan Usaha") input');
  await expect(jenisKegiatanInput).toBeVisible({ timeout: 30000 });
  await jenisKegiatanInput.click();
  await page.getByText('Kegiatan Usaha Utama', { exact: true }).last().click();

  const kbliInput = page.locator('div:has(> .v-input):has-text("Bidang Usaha") input');
  await expect(kbliInput).toBeVisible({ timeout: 30000 });
  await kbliInput.click();
  await page.getByText('- Periklanan').first().click();
  await page.getByRole('button', { name: 'Mengerti' }).last().click();

  const ruangLingkup = page.getByRole('combobox', { name: 'Pilih ruang lingkup kegiatan' });
  await expect(ruangLingkup).toBeVisible({ timeout: 30000 });
  await ruangLingkup.click();
  await page.getByText('Seluruh', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Tambah Bidang Usaha' }).click();

  // Verifikasi positif: popup muncul dengan peringatan "RDTR Tidak Tersedia"
  // (dikarenakan lokasi usaha test tidak memiliki dokumen RDTR)
  await expect(page.getByText('RDTR Tidak Tersedia', { exact: false })).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: 'Mengerti' }).last().click();

  const namaUsaha = page.getByRole('textbox', { name: 'Contoh : Restoran' });
  await expect(namaUsaha).toBeVisible({ timeout: 30000 });
  await namaUsaha.click();
  await namaUsaha.fill(NAMA_USAHA_TEST);

  // ===== VERIFIKASI POSITIF =====
  // 1. Nama usaha terisi dengan benar
  await expect(namaUsaha).toHaveValue(NAMA_USAHA_TEST);

  // 2. Minimal 1 baris KBLI "Periklanan" muncul di tabel "Daftar Bidang Usaha"
  const barisBidangUsaha = page.locator('table').filter({ hasText: 'Periklanan' }).locator('tbody tr').filter({ hasText: 'Periklanan' });
  await expect(barisBidangUsaha.first()).toBeVisible({ timeout: 15000 });

  // 3. Pilihan yang sudah diisi tampil (Jenis Kegiatan & KBLI)
  await expect(page.getByText('Kegiatan Usaha Utama', { exact: true }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('73100 - Aktivitas Periklanan').first()).toBeVisible({ timeout: 15000 });

  // 4. Tombol "Selanjutnya" tersedia & ENABLED (form valid untuk lanjut)
  const tombolSelanjutnyaForm = page.getByRole('button', { name: 'Selanjutnya' });
  await expect(tombolSelanjutnyaForm).toBeVisible({ timeout: 15000 });
  await expect(tombolSelanjutnyaForm).toBeEnabled({ timeout: 15000 });

  // ===== CLEANUP: hapus data yang baru dibuat =====
  await page.getByTestId('stepper-dynamic').getByText('Perizinan Berusaha', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Daftar Kegiatan Usaha' })).toBeVisible({ timeout: 30000 });

  // Tangkap nomor kegiatan usaha dari baris pertama (data terbaru / No.1)
  const barisTeratas = page.locator('table tr').nth(1);
  await expect(barisTeratas).toBeVisible({ timeout: 30000 });
  const teksBaris = (await barisTeratas.innerText()).trim();
  const nomorKegiatan = teksBaris.match(/Nomor Kegiatan Usaha:\s*([\w-]+)/i)?.[1];

  // Klik tombol Hapus pada baris pertama (data yang baru dibuat)
  const tombolHapusAtas = barisTeratas.getByRole('button', { name: /hapus/i });
  await expect(tombolHapusAtas).toBeVisible({ timeout: 15000 });
  await tombolHapusAtas.click();

  // Konfirmasi dialog hapus
  await expect(page.getByRole('heading', { name: 'Konfirmasi Hapus Data' })).toBeVisible({ timeout: 30000 });
  await page.locator('button').filter({ hasText: /^Hapus$/ }).last().click();

  // Verifikasi hapus berhasil:
  // 1) Dialog konfirmasi menutup
  await expect(page.getByRole('heading', { name: 'Konfirmasi Hapus Data' })).toHaveCount(0, { timeout: 15000 });

  // 2) Toast sukses "Berhasil menghapus data" muncul 
  await expect(page.getByText('Berhasil menghapus data', { exact: false })).toBeVisible({ timeout: 15000 });

  // 3) Verifikasi presisi: baris dengan nomor kegiatan yang dihapus sudah hilang dari tabel
  if (nomorKegiatan) {
    await expect(page.locator('table tr').filter({ hasText: nomorKegiatan })).toHaveCount(0, { timeout: 15000 });
  }
});
