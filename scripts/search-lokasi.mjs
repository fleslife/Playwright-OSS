// Script investigasi: coba pilih lokasi #AutomationTest dengan berbagai cara
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

  const lokasiUsaha = page.getByRole('combobox', { name: 'Pilih lokasi usaha' });
  await lokasiUsaha.waitFor({ state: 'visible', timeout: 30000 });
  await lokasiUsaha.click();

  // Coba beberapa kata kunci pencarian
  const keywords = ['AutomationTest', '#AutomationTest', 'BdgBarat', 'Lembang', 'lembang'];
  for (const kw of keywords) {
    await lokasiUsaha.fill(kw);
    await page.waitForTimeout(2000);
    // Cek opsi yang muncul
    const opts = await page.evaluate(() => {
      return [...document.querySelectorAll('.v-list-item, [role="option"]')]
        .map(el => (el.textContent || '').trim().slice(0, 120))
        .filter(t => t.length > 0)
        .slice(0, 5);
    });
    console.log(`Kata kunci "${kw}": ${JSON.stringify(opts)}`);
  }
} finally {
  await browser.close();
}
