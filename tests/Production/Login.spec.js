import { test, expect } from '@playwright/test';
import { login, applyPageZoom } from '../helpers/login.js';

// Jalankan serial (1 worker) karena semua test memakai sesi login ke akun yang sama —
// paralel bisa memicu konflik sesi/rate-limit di sisi OSS.
test.describe.configure({ mode: 'serial' });

const LOGIN_URL = 'https://ui-login.oss.go.id/login';
const ZOOM_OUT_SCALE = 0.8; // zoom-out 80%

test('Login - Positive Case: kredensial valid, berhasil masuk ke dashboard', async ({ page }) => {
  // Login via helper bersama (mencakup validasi .env, zoom-out 80%, tunggu dashboard,
  // dan verifikasi halaman login hilang)
  await login(page, { zoomOut: true });

  // Verifikasi tambahan: elemen khas dashboard muncul (menu utama aplikasi OSS)
  await expect(page.getByText('Perizinan Berusaha', { exact: true })).toBeVisible();
});

test('Login - Negative Case: password salah, tetap di halaman login', async ({ page }) => {
  test.setTimeout(120_000);

  // Terapkan zoom-out 80% sebelum navigasi
  await applyPageZoom(page, ZOOM_OUT_SCALE);

  await page.goto(LOGIN_URL);

  await page.getByRole('textbox', { name: 'Contoh: 081xxxxxxxxx atau' })
    .fill(process.env.LOGIN_USERNAME);
  await page.getByRole('textbox', { name: 'Masukkan kata sandi' })
    .fill('PasswordSalah123!');
  await page.getByRole('button', { name: 'Masuk' }).click();

  // Verifikasi login GAGAL:
  // 1. Tetap di halaman login (heading "Masuk" masih ada)
  await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible({ timeout: 30000 });

  // 2. Tidak redirect ke dashboard
  expect(page.url()).toContain('ui-login.oss.go.id');

  // 3. Muncul pesan error: "Kombinasi akun dan kata sandi tidak sesuai"
  await expect(page.getByText('Kombinasi akun dan kata sandi tidak sesuai')).toBeVisible({ timeout: 15000 });
});

test('Login - Negative Case: field kosong, tombol Masuk disabled', async ({ page }) => {
  test.setTimeout(120_000);

  // Terapkan zoom-out 80% sebelum navigasi
  await applyPageZoom(page, ZOOM_OUT_SCALE);

  await page.goto(LOGIN_URL);

  // Verifikasi tombol "Masuk" dalam keadaan DISABLED saat field belum diisi
  // (aplikasi mencegah submit form kosong)
  await expect(page.getByRole('button', { name: 'Masuk' })).toBeDisabled({ timeout: 30000 });

  // Verifikasi tetap di halaman login (heading "Masuk" masih ada)
  await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible({ timeout: 30000 });
});