// Script: periksa isi tabel Daftar Kegiatan Usaha & coba cari data test
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
  // Bisa redirect ke #/dashboard ATAU #/?auth-code (jika sudah pernah login)
  await page.waitForURL(/perizinan\.oss\.go\.id\/#\/(dashboard|\?auth-code)/i, { timeout: 45000 });

  const menuPerizinan = page.getByText(' Perizinan Berusaha ', { exact: true });
  await menuPerizinan.waitFor({ state: 'visible', timeout: 30000 });
  await menuPerizinan.click();
  await page.getByText('Kelola Usaha').click();
  const menuKegiatanUsaha = page.getByText('Kegiatan Usaha', { exact: true }).first();
  await menuKegiatanUsaha.waitFor({ state: 'visible', timeout: 30000 });
  await menuKegiatanUsaha.click();

  // Tunggu daftar & dump isi tabel
  await page.getByRole('heading', { name: 'Daftar Kegiatan Usaha' }).waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    const tables = [...document.querySelectorAll('table')].map((t, i) => {
      const rows = [...t.querySelectorAll('tr')].map(tr => (tr.textContent || '').trim().slice(0, 200));
      return { index: i, rows };
    });
    // Badge / status filter
    const badges = [...document.querySelectorAll('.v-badge, [class*="badge"]')].map(b => (b.textContent || '').trim()).slice(0, 10);
    return { tables, badges };
  });

  console.log(JSON.stringify(info, null, 2));
} finally {
  await browser.close();
}
