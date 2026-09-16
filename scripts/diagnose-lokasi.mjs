// Script: periksa perilaku dropdown pencarian lokasi usaha
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

  // Ketik perlahan & tunggu opsi dropdown
  await lokasiUsaha.fill('#AutomationTest#Darat#Kab.BdgBarat_Lembang#NonRDTR');
  await page.waitForTimeout(3000);

  // Dump semua teks di dropdown yang terlihat
  const options = await page.evaluate(() => {
    // Cari elemen dropdown Vuetify (.v-list-item, .v-menu, .v-autocomplete__content)
    const items = [...document.querySelectorAll('.v-list-item, .v-autocomplete__content [role="option"], .v-overlay-container .v-list-item')]
      .map(el => (el.textContent || '').trim().slice(0, 120))
      .filter(t => t.length > 0);
    // Juga cari teks yang mengandung "Darat" atau "#AutomationTest"
    const daratTexts = [...document.querySelectorAll('*')]
      .filter(el => el.children.length === 0 && /Darat|AutomationTest/.test(el.textContent || ''))
      .map(el => (el.textContent || '').trim().slice(0, 120))
      .filter(t => t.length > 0)
      .slice(0, 20);
    return { items, daratTexts };
  });

  console.log(JSON.stringify(options, null, 2));
} finally {
  await browser.close();
}
