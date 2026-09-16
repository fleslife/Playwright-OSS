// Script verifikasi: simulasi check semua radio "Tidak" lalu klik Selanjutnya
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

  // Check semua radio "Tidak" (force)
  const radioTidakList = page.getByRole('radio', { name: 'Tidak' });
  await radioTidakList.first().waitFor({ state: 'visible', timeout: 30000 });
  const count = await radioTidakList.count();
  console.log('Jumlah radio "Tidak":', count);
  for (let i = 0; i < count; i++) {
    await radioTidakList.nth(i).scrollIntoViewIfNeeded();
    await radioTidakList.nth(i).check({ force: true });
    console.log(`Radio ${i} di-check`);
  }

  // Klik Selanjutnya dan tunggu form kegiatan usaha muncul
  await page.getByRole('button', { name: 'Selanjutnya' }).click();
  await page.getByText('Jenis Kegiatan Usaha', { exact: true }).waitFor({ state: 'visible', timeout: 30000 });
  console.log('SUKSES: Form Kegiatan Usaha muncul setelah radio di-check');
} finally {
  await browser.close();
}
