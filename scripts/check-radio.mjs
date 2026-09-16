// Script verifikasi: periksa status radio setelah pilih lokasi usaha
import { chromium } from '@playwright/test';
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

  // Pilih lokasi usaha
  const lokasiUsaha = page.getByRole('combobox', { name: 'Pilih lokasi usaha' });
  await lokasiUsaha.waitFor({ state: 'visible', timeout: 30000 });
  await lokasiUsaha.click();
  await lokasiUsaha.fill('#AutomationTest#Darat#Kab.BdgBarat_Lembang#NonRDTR');
  await page.getByText('Darat - #AutomationTest#Darat#Kab.BdgBarat_Lembang#NonRDTR, Jawa Barat').first().click();

  // Tunggu sebentar agar loading data lokasi selesai
  await page.waitForTimeout(3000);

  // Periksa status semua radio di halaman
  const info = await page.evaluate(() => {
    const radios = [...document.querySelectorAll('input[type="radio"]')].map((r, i) => {
      // Cari teks di sekitar radio (label pertanyaan)
      let label = '';
      let el = r;
      for (let level = 0; level < 5 && el; level++) {
        const t = (el.textContent || '').trim();
        if (t && t.length > 5) { label = t.slice(0, 100); break; }
        el = el.parentElement;
      }
      return {
        index: i,
        name: r.getAttribute('name'),
        checked: r.checked,
        disabled: r.disabled,
        labelAround: label,
      };
    });
    // Periksa indikator loading
    const loadingIndicators = [...document.querySelectorAll('[role="progressbar"], .v-progress-circular, .v-progress-linear, .v-loading')].length;
    return { radios, loadingIndicators };
  });

  console.log(JSON.stringify(info, null, 2));

  // Cek status tombol Selanjutnya
  const btn = page.getByRole('button', { name: 'Selanjutnya' });
  console.log('Selanjutnya disabled?', await btn.isDisabled().catch(() => 'error'));
} finally {
  await browser.close();
}
