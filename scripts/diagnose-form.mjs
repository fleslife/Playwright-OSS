// Script diagnosis: dump pesan error/validasi di form Data Lokasi Usaha setelah check radio
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
  await lokasiUsaha.fill('#AutomationTest#Darat#Kab.BdgBarat_Lembang#NonRDTR');
  await page.getByText('Darat - #AutomationTest#Darat#Kab.BdgBarat_Lembang#NonRDTR, Jawa Barat').first().click();

  // Check semua radio "Tidak"
  const radioTidakList = page.getByRole('radio', { name: 'Tidak' });
  await radioTidakList.first().waitFor({ state: 'visible', timeout: 30000 });
  const count = await radioTidakList.count();
  for (let i = 0; i < count; i++) {
    await radioTidakList.nth(i).scrollIntoViewIfNeeded();
    await radioTidakList.nth(i).check({ force: true });
  }

  await page.waitForTimeout(2000);

  // Dump SEMUA teks di halaman form untuk melihat pesan error/validasi & field lain
  const info = await page.evaluate(() => {
    const body = document.body.innerText;
    // Cari teks yang mengandung kata kunci error/validasi/wajib
    const errorTexts = [];
    for (const el of document.querySelectorAll('.v-messages, .v-input__details, .error--text, [class*="error"], [role="alert"]')) {
      const t = (el.textContent || '').trim();
      if (t) errorTexts.push(t.slice(0, 150));
    }
    // Semua elemen form yang bisa diinteraksi (input, select, textarea, combobox)
    const fields = [...document.querySelectorAll('input, select, textarea, [role="combobox"]')].map(f => ({
      tag: f.tagName,
      id: f.id || null,
      placeholder: f.placeholder || null,
      type: f.type || null,
      disabled: f.disabled || f.getAttribute('aria-disabled') === 'true',
      value: f.value ? String(f.value).slice(0, 60) : null,
    }));
    return {
      hasErrorMessages: errorTexts,
      fields,
      hasWajib: /wajib/i.test(body),
      hasPeriksa: /periksa/i.test(body),
      hasHarus: /harus/i.test(body),
    };
  });

  console.log(JSON.stringify(info, null, 2));
} finally {
  await browser.close();
}
