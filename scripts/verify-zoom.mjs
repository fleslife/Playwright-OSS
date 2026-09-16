// Script verifikasi: cek apakah CSS zoom 80% diterapkan di Chromium
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

try {
  // Terapkan CSS zoom via addInitScript (sama seperti helper login) dengan
  // penanganan documentElement yang belum siap
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
  }, { zoom: 0.8 });

  await page.goto('https://ui-login.oss.go.id/login', { waitUntil: 'domcontentloaded' });

  // Ukur zoom yang diterapkan & lebar konten
  const info = await page.evaluate(() => {
    const styleEl = document.getElementById('pw-zoom-style');
    const computedZoom = getComputedStyle(document.documentElement).zoom;
    return {
      styleInjected: !!styleEl,
      computedZoom: computedZoom,
      htmlWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  console.log(JSON.stringify(info, null, 2));
} finally {
  await browser.close();
}
