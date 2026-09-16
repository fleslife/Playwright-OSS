// Script: periksa struktur tombol Aksi (Hapus) di tabel Daftar Kegiatan Usaha
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
  await page.waitForURL(/perizinan\.oss\.go\.id\/#\/(dashboard|\?auth-code)/i, { timeout: 45000 });

  const menuPerizinan = page.getByText(' Perizinan Berusaha ', { exact: true });
  await menuPerizinan.waitFor({ state: 'visible', timeout: 30000 });
  await menuPerizinan.click();
  await page.getByText('Kelola Usaha').click();
  const menuKegiatanUsaha = page.getByText('Kegiatan Usaha', { exact: true }).first();
  await menuKegiatanUsaha.waitFor({ state: 'visible', timeout: 30000 });
  await menuKegiatanUsaha.click();

  await page.getByRole('heading', { name: 'Daftar Kegiatan Usaha' }).waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Dump semua tombol & elemen yang teksnya "Hapus" atau mirip
  const info = await page.evaluate(() => {
    const result = {};
    // Semua <button> di halaman (terutama dalam tabel)
    result.buttons = [...document.querySelectorAll('table button')].map(b => ({
      text: (b.textContent || '').trim().slice(0, 40),
      class: b.className?.toString().slice(0, 80),
      title: b.title || null,
      ariaLabel: b.getAttribute('aria-label') || null,
    })).slice(0, 20);
    // Semua elemen dengan teks "Hapus" / "Lanjutkan"
    result.hapusTexts = [...document.querySelectorAll('*')]
      .filter(el => el.children.length === 0 && /hapus|lanjutkan/i.test(el.textContent || ''))
      .map(el => ({ tag: el.tagName, text: (el.textContent || '').trim().slice(0, 40), class: el.parentElement?.className?.toString().slice(0, 60) }))
      .slice(0, 20);
    return result;
  });

  console.log(JSON.stringify(info, null, 2));

  // Coba count getByRole button Hapus
  const countRole = await page.getByRole('button', { name: /hapus/i }).count();
  console.log('getByRole button /hapus/i count:', countRole);
} finally {
  await browser.close();
}
