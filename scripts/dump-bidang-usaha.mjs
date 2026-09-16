// Script: dump struktur tabel "Daftar Bidang Usaha" setelah menambah KBLI
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
  await page.getByRole('button', { name: 'Tambah Kegiatan Usaha' }).click();

  // Pilih lokasi
  const lokasiUsaha = page.getByRole('combobox', { name: 'Pilih lokasi usaha' });
  await lokasiUsaha.waitFor({ state: 'visible', timeout: 30000 });
  await lokasiUsaha.click();
  await lokasiUsaha.pressSequentially('#AutomationTest#Darat#Kab.BdgBarat_Lembang#NonRDTR', { delay: 50 });
  await page.getByText(/Darat - #AutomationTest#Darat#Kab.BdgBarat_Lembang#NonRDTR, Jawa Barat/).first().waitFor({ state: 'visible', timeout: 15000 });
  await page.getByText(/Darat - #AutomationTest#Darat#Kab.BdgBarat_Lembang#NonRDTR, Jawa Barat/).first().click();

  // Radio Tidak
  const radioTidakList = page.getByRole('radio', { name: 'Tidak' });
  await radioTidakList.first().waitFor({ state: 'visible', timeout: 30000 });
  await page.getByText('Tidak', { exact: true }).nth(0).click();
  await page.getByText('Tidak', { exact: true }).nth(1).click();
  await page.locator('//input[@type="radio" and @value="01"]').scrollIntoViewIfNeeded();
  await page.locator('//input[@type="radio" and @value="01"]').click();
  await page.getByRole('button', { name: 'Selanjutnya' }).click();

  // Isi Jenis Kegiatan & KBLI
  const jenisKegiatanInput = page.locator('div:has(> .v-input):has-text("Jenis Kegiatan Usaha") input');
  await jenisKegiatanInput.waitFor({ state: 'visible', timeout: 30000 });
  await jenisKegiatanInput.click();
  await page.getByText('Kegiatan Usaha Utama', { exact: true }).last().click();

  const kbliInput = page.locator('div:has(> .v-input):has-text("Bidang Usaha") input');
  await kbliInput.waitFor({ state: 'visible', timeout: 30000 });
  await kbliInput.click();
  await page.getByText('- Periklanan').first().click();
  await page.getByRole('button', { name: 'Mengerti' }).last().click();

  // Ruang lingkup
  const ruangLingkup = page.getByRole('combobox', { name: 'Pilih ruang lingkup kegiatan' });
  await ruangLingkup.waitFor({ state: 'visible', timeout: 30000 });
  await ruangLingkup.click();
  await page.getByText('Seluruh', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Tambah Bidang Usaha' }).click();
  await page.getByRole('button', { name: 'Mengerti' }).last().click();

  await page.waitForTimeout(2000);

  // Dump struktur tabel "Daftar Bidang Usaha"
  const info = await page.evaluate(() => {
    // Cari elemen dengan teks "Daftar Bidang Usaha"
    const heading = [...document.querySelectorAll('*')].find(el => el.children.length === 0 && /Daftar Bidang Usaha/.test(el.textContent || ''));
    let html = '';
    if (heading) {
      // Naik ke container & cari tabel
      let el = heading;
      for (let i = 0; i < 6 && el; i++) {
        if (el.querySelector('table')) {
          html = el.querySelector('table').outerHTML.slice(0, 3000);
          break;
        }
        el = el.parentElement;
      }
    }
    // Semua tabel + isinya
    const tables = [...document.querySelectorAll('table')].map((t, i) => ({
      index: i,
      text: (t.textContent || '').trim().slice(0, 500),
      hasPeriklanan: (t.textContent || '').includes('Periklanan'),
    }));
    // Cari teks Periklanan di halaman
    const periklananCount = [...document.querySelectorAll('*')].filter(el => el.children.length === 0 && /Periklanan/.test(el.textContent || '')).length;
    return { headingFound: !!heading, headingHtml: html, tables, periklananCount };
  });

  console.log(JSON.stringify(info, null, 2));
} finally {
  await browser.close();
}
