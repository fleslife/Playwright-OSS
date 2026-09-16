import { expect } from '@playwright/test';

const ZOOM_OUT_SCALE = 0.8; // zoom-out 80%
const LOGIN_URL = 'https://ui-login.oss.go.id/login';
// Login sukses bisa mendarat di #/dashboard ATAU #/?auth-code (proses SPA),
// namun selalu di domain perizinan.oss.go.id
const APP_URL_REGEX = /perizinan\.oss\.go\.id/i;

/**
 * Login ke OSS dan memastikan sudah sampai di dashboard.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ username?: string, password?: string, baseURL?: string, zoomOut?: boolean }} [opts]
 */
export async function login(page, opts = {}) {
  const username = opts.username ?? process.env.LOGIN_USERNAME;
  const password = opts.password ?? process.env.LOGIN_PASSWORD;
  const baseURL = opts.baseURL ?? LOGIN_URL;
  const zoomOut = opts.zoomOut ?? false;

  if (!username || !password) {
    throw new Error('LOGIN_USERNAME dan LOGIN_PASSWORD belum diisi di file .env');
  }

  // Zoom-out sebelum navigasi agar konten tampil lebih banyak sejak awal
  if (zoomOut) {
    await applyPageZoom(page, ZOOM_OUT_SCALE);
  }

  await page.goto(baseURL);
  await page.getByRole('textbox', { name: 'Contoh: 081xxxxxxxxx atau' }).fill(username);
  await page.getByRole('textbox', { name: 'Masukkan kata sandi' }).fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();

  // Pastikan sudah sampai di aplikasi (domain perizinan) sebelum lanjut.
  // Login sukses bisa mendarat di #/dashboard ATAU #/?auth-code (loading SPA).
  await page.waitForURL(APP_URL_REGEX, { timeout: 60000 });
  await expect(page.getByRole('heading', { name: 'Masuk' })).toHaveCount(0);
}

/**
 * Terapkan zoom CSS `html { zoom }` di setiap navigasi (persist lintas halaman)
 * via addInitScript. Menunggu DOM siap jika documentElement belum tersedia.
 * Dipakai di helper login dan spec lain yang membutuhkan zoom-out.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} scale contoh: 0.8 = 80%
 */
export async function applyPageZoom(page, scale) {
  await page.addInitScript(({ zoom }) => {
    const apply = () => {
      if (!document.documentElement) return false;
      let style = document.getElementById('pw-zoom-style');
      if (!style) {
        style = document.createElement('style');
        style.id = 'pw-zoom-style';
        (document.head || document.documentElement).appendChild(style);
      }
      style.textContent = `html { zoom: ${zoom} !important; }`;
      return true;
    };

    if (!apply()) {
      const observer = new MutationObserver(() => {
        if (apply()) observer.disconnect();
      });
      observer.observe(document.documentElement || document, {
        childList: true,
        subtree: true,
      });
      document.addEventListener('DOMContentLoaded', () => {
        apply();
        observer.disconnect();
      });
    }
  }, { zoom: scale });
}
