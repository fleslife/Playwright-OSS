// Script: periksa teks error saat login gagal (password salah)
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

try {
  await page.goto('https://ui-login.oss.go.id/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Contoh: 081xxxxxxxxx atau' }).fill(process.env.LOGIN_USERNAME);
  await page.getByRole('textbox', { name: 'Masukkan kata sandi' }).fill('PasswordSalah123!');
  await page.getByRole('button', { name: 'Masuk' }).click();

  // Tunggu beberapa saat untuk respons
  await page.waitForTimeout(8000);

  const info = await page.evaluate(() => {
    // Cari elemen alert dan dump HTML-nya (mungkin teks di child)
    const alerts = [...document.querySelectorAll('[role="alert"]')].map(el => ({
      text: (el.textContent || '').trim().slice(0, 200),
      html: el.outerHTML.slice(0, 500),
      visible: el.offsetParent !== null,
    }));
    // Semua elemen yang mengandung teks kata sandi/error (deep text nodes)
    const errorNodes = [...document.querySelectorAll('p, div, span, h1, h2, h3, h4')]
      .filter(el => el.children.length <= 2 && el.offsetParent !== null)
      .map(el => (el.textContent || '').trim())
      .filter(t => t && t.length > 3 && /salah|tidak|gagal|error|invalid|kata sandi|password|tidak valid|sandi/i.test(t))
      .slice(0, 15);
    // Dump seluruh teks halaman (potong 1500 char) untuk melihat pesan apa pun
    const bodyText = document.body.innerText.slice(0, 1500);
    return {
      url: location.href,
      alerts,
      errorNodes,
      bodyText,
    };
  });

  console.log(JSON.stringify(info, null, 2));
} finally {
  await browser.close();
}
