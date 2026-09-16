// Script: dump detail form Data Lokasi Usaha — field wajib & strukturnya
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
  await lokasiUsaha.fill('lembang');
  await page.getByText('Darat - #Darat#NonRDTR_Kab.').first().click();

  await page.waitForTimeout(2000);

  // Dump semua field, label wajib, dan pesan error di form Data Lokasi Usaha
  const info = await page.evaluate(() => {
    const result = {};
    // 1. Cari teks "Wajib" / "*" di halaman
    result.wajibTexts = [...document.querySelectorAll('*')]
      .filter(el => el.children.length === 0 && /wajib/i.test(el.textContent || ''))
      .map(el => (el.textContent || '').trim().slice(0, 80))
      .slice(0, 10);
    // 2. Semua elemen form + atribut
    result.fields = [...document.querySelectorAll('input, select, textarea, [role="combobox"]')].map(f => ({
      id: f.id || null,
      placeholder: f.placeholder || null,
      type: f.type || null,
      required: f.required || f.getAttribute('aria-required') === 'true',
      disabled: f.disabled,
    })).filter(f => !f.placeholder || f.placeholder !== 'Pencarian');
    // 3. Cari label "*" (tanda wajib)
    result.requiredLabels = [...document.querySelectorAll('label, .v-label, span, div')]
      .filter(el => /(\*|wajib)/i.test(el.textContent || '') && (el.textContent || '').trim().length < 80)
      .map(el => (el.textContent || '').trim().slice(0, 80))
      .slice(0, 20);
    // 4. Struktur label + field (v-input dengan label)
    result.inputGroups = [...document.querySelectorAll('.v-input')].slice(0, 30).map(el => ({
      text: (el.textContent || '').trim().slice(0, 100),
      hasLabel: !!el.querySelector('.v-label, label'),
      hasRadio: !!el.querySelector('input[type="radio"]'),
      hasCheckbox: !!el.querySelector('input[type="checkbox"]'),
      hasCombobox: !!el.querySelector('[role="combobox"], .v-combobox, .v-select'),
      hasInput: !!el.querySelector('input:not([type="radio"]):not([type="checkbox"])'),
    }));
    return result;
  });

  console.log(JSON.stringify(info, null, 2));
} finally {
  await browser.close();
}
