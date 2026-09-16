// Script sementara: periksa struktur tabel "Daftar Kegiatan Usaha" & posisi data baru
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

  // Tunggu tabel daftar muncul
  await page.getByRole('heading', { name: 'Daftar Kegiatan Usaha' }).waitFor({ state: 'visible', timeout: 30000 });

  // Dump struktur tabel
  const info = await page.evaluate(() => {
    const tables = [...document.querySelectorAll('table')].map((t, i) => ({
      index: i,
      id: t.id || null,
      class: t.className?.toString().slice(0, 60) || null,
      rows: t.querySelectorAll('tr').length,
      headings: [...t.querySelectorAll('th, .v-data-table__th')].map(h => (h.textContent || '').trim()).slice(0, 8),
    }));
    // Cek apakah ada teks AutomationTest di halaman
    const hasAutoTest = document.body.innerText.includes('AutomationTest');
    return { tables, hasAutoTest };
  });

  console.log(JSON.stringify(info, null, 2));
} finally {
  await browser.close();
}
