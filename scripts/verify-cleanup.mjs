// Script verifikasi: setelah buat kegiatan usaha, cek apakah nama "AutomationTest" tersimpan di daftar
import { chromium, expect } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

try {
  await page.goto('https://ui-login.oss.go.id/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Contoh: 081xxxxxxxxx atau' }).fill(process.env.LOGIN_USERNAME);
  await page.getByRole('textbox', { name: 'Masukkan kata sandi' }).fill(process.env.LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/perizinan\.oss\.go\.id\/#\/dashboard/i, { timeout: 45000 });

  const menuPerizinan = page.getByText(' Perizinan Berusaha ', { exact: true });
  await menuPerizinan.waitFor({ state: 'visible', timeout: 30000 });
  await menuPerizinan.click();
  await page.getByText('Kelola Usaha').click();
  const menuKegiatanUsaha = page.getByText('Kegiatan Usaha', { exact: true }).first();
  await menuKegiatanUsaha.waitFor({ state: 'visible', timeout: 30000 });
  await menuKegiatanUsaha.click();
  await page.getByRole('button', { name: 'Tambah Kegiatan Usaha' }).click();

  // Pilih lokasi lembang
  const lokasiUsaha = page.getByRole('combobox', { name: 'Pilih lokasi usaha' });
  await lokasiUsaha.waitFor({ state: 'visible', timeout: 30000 });
  await lokasiUsaha.click();
  await lokasiUsaha.fill('lembang');
  await page.getByText('Darat - #Darat#NonRDTR_Kab.').first().click();

  // Check semua radio Tidak via KLIK LABEL (memicu event Vue)
  const radioTidakList = page.getByRole('radio', { name: 'Tidak' });
  await radioTidakList.first().waitFor({ state: 'visible', timeout: 30000 });
  const count = await radioTidakList.count();
  for (let i = 0; i < count; i++) {
    await page.getByText('Tidak', { exact: true }).nth(i).click();
    await expect(radioTidakList.nth(i)).toBeChecked({ timeout: 5000 });
  }
  console.log(`Check ${count} radio Tidak via klik label`);
  // Jika tombol Selanjutnya disabled, beri tahu
  if (await page.getByRole('button', { name: 'Selanjutnya' }).isDisabled()) {
    console.log('WARNING: Tombol Selanjutnya DISABLED setelah check radio');
  } else {
    console.log('OK: Tombol Selanjutnya ENABLED setelah check radio');
  }
  await page.getByRole('button', { name: 'Selanjutnya' }).click();

  // Isi jenis kegiatan — dengan fallback diagnosis jika tidak muncul
  const jenisKegiatanInput = page.locator('div:has(> .v-input):has-text("Jenis Kegiatan Usaha") input');
  try {
    await jenisKegiatanInput.waitFor({ state: 'visible', timeout: 30000 });
    await jenisKegiatanInput.click();
    await page.getByText('Kegiatan Usaha Utama', { exact: true }).last().click();
  } catch (e) {
    // Diagnosa: dump teks halaman & input yang ada
    console.log('GAGAL menemukan Jenis Kegiatan Usaha. Dump kondisi halaman:');
    const dump = await page.evaluate(() => {
      const body = document.body.innerText.slice(0, 2000);
      const inputs = [...document.querySelectorAll('input, [role="combobox"], select')].map(i => ({
        id: i.id, ph: i.placeholder, cls: i.className?.toString().slice(0, 50),
      })).slice(0, 20);
      return { body, inputs };
    });
    console.log(JSON.stringify(dump, null, 2));
    throw e;
  }

  // Isi KBLI
  const kbliInput = page.locator('div:has(> .v-input):has-text("Bidang Usaha") input');
  await kbliInput.waitFor({ state: 'visible', timeout: 30000 });
  await kbliInput.click();
  await page.getByText('- Periklanan').first().click();
  await page.getByRole('button', { name: 'Mengerti' }).last().click();

  // Ruang lingkup
  const ruangLingkup = page.getByRole('combobox', { name: 'Pilih ruang lingkup kegiatan' });
  await ruangLingkup.waitFor({ state: 'visible', timeout: 30000 });
  await ruangLingkup.click();
  await page.getByText('Seluruh', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Tambah Bidang Usaha' }).click();
  await page.getByRole('button', { name: 'Mengerti' }).last().click();

  // Nama usaha
  const namaUsaha = page.getByRole('textbox', { name: 'Contoh : Restoran' });
  await namaUsaha.waitFor({ state: 'visible', timeout: 30000 });
  await namaUsaha.click();
  await namaUsaha.fill('AutomationTest-KKPR_Penilaian');
  await page.getByRole('radio', { name: 'Tidak' }).first().check();

  // Kembali ke stepper -> daftar
  await page.getByTestId('stepper-dynamic').getByText('Perizinan Berusaha', { exact: true }).click();
  await page.getByRole('heading', { name: 'Daftar Kegiatan Usaha' }).waitFor({ state: 'visible', timeout: 30000 });

  // Cek apakah ada teks AutomationTest di daftar
  const hasAutoTest = await page.locator('table').getByText('AutomationTest', { exact: false }).count();
  console.log('Baris dengan AutomationTest di tabel:', hasAutoTest);

  // Dump teks tabel
  const tableText = await page.locator('table').innerText();
  console.log('--- ISI TABEL (500 char pertama) ---');
  console.log(tableText.slice(0, 1500));
} finally {
  await browser.close();
}