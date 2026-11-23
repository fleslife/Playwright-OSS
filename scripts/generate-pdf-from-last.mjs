#!/usr/bin/env node
/**
 * generate-pdf-from-last.mjs
 *
 * Generate PDF report dari HASIL TEST TERAKHIR — TANPA menjalankan test.
 *
 * Beda dengan generate-pdf-report.mjs yang selalu run test dulu, script ini
 * hanya membaca hasil terakhir dari test-results/results.json (yang dihasilkan
 * oleh fitur Testing Playwright di VS Code / npm run test) lalu generate PDF.
 *
 * Cara pakai:
 *   node scripts/generate-pdf-from-last.mjs
 *   (atau) npm run report:pdf:last
 *
 * Opsional env:
 *   PDF_OUT  (default ./reports/Playwright_Report_<DDMMYYYY-HHMMSS>.pdf)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RESULTS_FILE = path.join(ROOT, "test-results", "results.json");

// Timestamp format: DDMMYYYY-HHMMSS (contoh: 23092026-151730)
function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}${p(d.getMonth() + 1)}${d.getFullYear()}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const PDF_OUT = path.resolve(process.env.PDF_OUT || path.join(ROOT, "reports", `Playwright_Report_${timestamp()}.pdf`));

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ===== Baca hasil terakhir (tanpa run test) =====
function collectData() {
  if (!fs.existsSync(RESULTS_FILE)) {
    throw new Error(`File hasil tidak ditemukan: ${RESULTS_FILE}\n` + "Jalankan dulu test via fitur Testing Playwright (atau `npx playwright test`), lalu jalankan script ini.");
  }
  // Cek file tidak kosong
  const raw = fs.readFileSync(RESULTS_FILE, "utf8");
  if (!raw.trim()) throw new Error(`File hasil kosong: ${RESULTS_FILE}`);
  const report = JSON.parse(raw);

  const cases = [];
  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      const test = (spec.tests || [])[0];
      const res = test?.results?.[0];
      const status = res?.status || spec.status || "skipped";
      const err = res?.error?.message || "";
      const screenshots = (res?.attachments || []).filter((a) => /png|jpe?g/.test(a.contentType || a.mimeType || ""));
      cases.push({
        title: spec.title,
        file: (spec.file || "").split(/[\\/]/).pop(),
        status,
        duration: res?.duration || 0,
        error: err,
        steps: (res?.steps || []).map((s) => ({ title: s.title || s.apiName || "", status: s.error ? "failed" : "passed", duration: s.duration || 0 })),
        screenshots: screenshots.map((s) => s.path),
      });
    }
    for (const c of suite.suites || []) walk(c);
  };
  walk(report);
  return { cases, stats: report.stats || {} };
}

// ===== Buat HTML =====
function buildHtml({ cases, stats }) {
  const total = cases.length;
  const passed = cases.filter((c) => c.status === "passed").length;
  const failed = cases.filter((c) => c.status === "failed" || c.status === "timedOut").length;
  const skipped = cases.filter((c) => c.status === "skipped").length;
  const fmt = (ms) => (ms / 1000).toFixed(2) + "s";
  const statusColor = { passed: "#16a34a", failed: "#dc2626", skipped: "#9ca3af", timedOut: "#dc2626" };

  const cards = cases
    .map((c) => {
      const color = statusColor[c.status] || "#6b7280";
      const stepsHtml = c.steps.length
        ? c.steps
            .map((s) => `<div class="step"><span class="dot" style="background:${s.status === "passed" ? "#16a34a" : "#dc2626"}"></span>${esc(s.title)} <em>${fmt(s.duration)}</em></div>`)
            .join("")
        : '<div class="step"><em>(tanpa detail langkah)</em></div>';
      const shotsHtml = c.screenshots.length ? c.screenshots.map((s) => `<img class="shot" src="file:///${s.replace(/\\/g, "/")}" alt="screenshot" />`).join("") : "";
      return `
    <div class="case">
      <div class="case-head" style="border-left:4px solid ${color}">
        <span class="badge" style="background:${color}">${esc(c.status)}</span>
        <strong>${esc(c.title)}</strong>
        <span class="meta">${esc(c.file)} · ${fmt(c.duration)}</span>
      </div>
      ${c.error ? `<pre class="error">${esc(c.error.split("\n").slice(0, 8).join("\n"))}</pre>` : ""}
      <div class="steps">${stepsHtml}</div>
      ${shotsHtml}
    </div>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:Helvetica,Arial,sans-serif;margin:24px;color:#111;font-size:12px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;color:#555;margin:8px 0}
  .summary{display:flex;gap:16px;margin:16px 0;padding:12px;background:#f5f5f5;border-radius:8px}
  .summary div{flex:1;text-align:center} .summary b{display:block;font-size:20px}
  .case{margin:16px 0;border:1px solid #ddd;border-radius:8px;overflow:hidden}
  .case-head{padding:10px 12px;background:#fafafa;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .badge{color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;text-transform:uppercase}
  .meta{color:#888;font-size:11px;margin-left:auto}
  .error{background:#fef2f2;color:#991b1b;padding:8px 12px;margin:0;white-space:pre-wrap;font-size:11px}
  .steps{padding:8px 12px} .step{display:flex;align-items:center;gap:6px;padding:2px 0}
  .dot{width:8px;height:8px;border-radius:50%;display:inline-block}
  .step em{color:#888;margin-left:auto;font-style:normal}
  .shot{max-width:100%;border:1px solid #ddd;margin:6px 12px;border-radius:4px}
  @media print{body{margin:0} .case{page-break-inside:avoid}}
</style></head><body>
  <h1>Playwright Test Report (hasil terakhir)</h1>
  <h2>Dari: test-results/results.json</h2>
  <div class="summary">
    <div><b>${total}</b>Total</div>
    <div><b style="color:#16a34a">${passed}</b>Passed</div>
    <div><b style="color:#dc2626">${failed}</b>Failed</div>
    <div><b style="color:#9ca3af">${skipped}</b>Skipped</div>
  </div>
  ${cards}
  <footer style="margin-top:20px;color:#888;font-size:10px">Dibuat: ${new Date().toLocaleString()}</footer>
</body></html>`;
}

// ===== Render HTML ke PDF =====
async function renderPdf(html) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const buf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" } });
  await browser.close();
  return buf;
}

async function main() {
  console.log("Membaca hasil test terakhir dari test-results/results.json ...");
  const data = collectData();
  const html = buildHtml(data);
  fs.mkdirSync(path.dirname(PDF_OUT), { recursive: true });
  const buf = await renderPdf(html);
  fs.writeFileSync(PDF_OUT, buf);
  console.log(`✅ PDF report disimpan: ${PDF_OUT} (${buf.length} bytes)`);
  console.log(`   ${data.cases.length} test · ${data.cases.filter((c) => c.status === "passed").length} passed · ${data.cases.filter((c) => c.status === "failed").length} failed`);
}

main().catch((e) => {
  console.error("❌ Gagal:", e.message);
  process.exit(1);
});
