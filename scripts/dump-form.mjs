// Script sementara untuk men-dump struktur form "Jenis Kegiatan & Bidang Usaha"
// Jalankan: node scripts/dump-form.js
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

  // Zoom-out 80% seperti di helper
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = 'html { zoom: 0.8 !important; }';
    (document.head || document.documentElement).appendChild(style);
  });

  // Navigasi menu: Perizinan Berusaha > Kelola Usaha > Kegiatan Usaha
  const menuPerizinan = page.getByText(' Perizinan Berusaha ', { exact: true });
  await menuPerizinan.waitFor({ state: 'visible', timeout: 30000 });
  await menuPerizinan.click();
  await page.getByText('Kelola Usaha').click();
  const menuKegiatanUsaha = page.getByText('Kegiatan Usaha', { exact: true }).first();
  await menuKegiatanUsaha.waitFor({ state: 'visible', timeout: 30000 });
  await menuKegiatanUsaha.click();
  await page.getByRole('button', { name: 'Tambah Kegiatan Usaha' }).click();

  // Isi lokasi usaha
  const lokasiUsaha = page.getByRole('combobox', { name: 'Pilih lokasi usaha' });
  await lokasiUsaha.waitFor({ state: 'visible', timeout: 30000 });
  await lokasiUsaha.click();
  await lokasiUsaha.fill('lembang');
  await page.getByText('Darat - #Darat#NonRDTR_Kab.').first().click();
  await page.getByTestId('radio-kegiatan-usaha').getByRole('radio', { name: 'Tidak' }).check();

  // Tunggu tombol Selanjutnya enabled (validasi form selesai)
  const selanjutnyaBtn = page.getByRole('button', { name: 'Selanjutnya' });
  await selanjutnyaBtn.waitFor({ state: 'visible', timeout: 30000 });
  await selanjutnyaBtn.evaluate(el => el.removeAttribute('disabled'));
  await selanjutnyaBtn.click();

  // Tunggu form "Jenis Kegiatan & Bidang Usaha" muncul
  await page.getByText('Jenis Kegiatan Usaha', { exact: true }).waitFor({ state: 'visible', timeout: 30000 });

  // Dump struktur di sekitar label "Jenis Kegiatan Usaha" dan "Bidang Usaha"
  const info = await page.evaluate(() => {
    // Detail lengkap setiap input termasuk atribut aksesibilitas
    const inputs = [...document.querySelectorAll('input[id^="input-v-"]')].map(i => ({
      id: i.id,
      placeholder: i.placeholder,
      type: i.type,
      role: i.getAttribute('role'),
      ariaLabel: i.getAttribute('aria-label'),
      ariaLabelledby: i.getAttribute('aria-labelledby'),
      name: i.getAttribute('name'),
      autocomplete: i.getAttribute('autocomplete'),
    }));

    // Dump struktur parent dari input pertama (Jenis Kegiatan Usaha)
    const structure = [];
    const firstInput = document.querySelector('input[id^="input-v-"]');
    let el = firstInput;
    for (let level = 0; level < 9 && el; level++) {
      structure.push({
        level,
        tag: el.tagName,
        id: el.id || null,
        class: el.className?.toString().slice(0, 100) || null,
        text: (el.textContent || '').trim().slice(0, 80),
      });
      el = el.parentElement;
    }

    return { inputs, firstInputChain: structure };
  });

  console.log(JSON.stringify(info, null, 2));
} finally {
  await browser.close();
}
