#!/usr/bin/env node
/**
 * run-full-kkpr.mjs
 *
 * SATU PERINTAH untuk seluruh alur QA KKPR Penilaian:
 *   1. Jalankan test Playwright (KKPR_Penilaian.spec.js)
 *   2. Impor hasil run ke Suitest TCM
 *   3. Export dokumen UAT (PDF "Berita Acara UAT")
 *
 * Cara pakai:
 *   node scripts/run-full-kkpr.mjs
 *
 * Opsional env:
 *   SUITEST_URL        (default http://127.0.0.1:4000)
 *   SUITEST_PROJECT    (nama project; default "Playwright OSS")
 *   SUITEST_SUITE      (nama suite; default "KKPR Penilaian")
 *   SUITEST_CASE_ID    (id test case untuk export UAT; default auto-cari dari results)
 *   SUITEST_UAT_TITLE  (judul dokumen UAT; default "UAT Document - KKPR Penilaian")
 *   SUITEST_UAT_LOCALE (default "id")
 *   SPEC_FILE          (path spec; default tests/Production/KKPR_Penilaian.spec.js)
 *   BROWSER            (project browser; default chromium)
 *   KEEP_RESULTS       (default true; set false untuk hapus test-results/results.json)
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PLAYWRIGHT_CLI = path.join(ROOT, "node_modules", "@playwright", "test", "cli.js");

const SUITEST_URL = process.env.SUITEST_URL || "http://127.0.0.1:4000";
const PROJECT_NAME = process.env.SUITEST_PROJECT || "Playwright OSS";
const SUITE_NAME = process.env.SUITEST_SUITE || "KKPR Penilaian";
const SPEC_FILE = process.env.SPEC_FILE || path.join("tests", "Production", "KKPR_Penilaian.spec.js");
const BROWSER = process.env.BROWSER || "chromium";
const UAT_TITLE = process.env.SUITEST_UAT_TITLE || "UAT Document - KKPR Penilaian";
const UAT_LOCALE = process.env.SUITEST_UAT_LOCALE || "id";
const RESULTS_FILE = path.join(ROOT, "test-results", "results.json");
const PDF_OUT = process.env.SUITEST_UAT_OUT || path.join(ROOT, "UAT_KKPR_Penilaian.pdf");

const step = (msg) => console.log(`\n${"=".repeat(60)}\n${msg}\n${"=".repeat(60)}`);

function loadCredentials() {
  if (process.env.SUITEST_EMAIL && process.env.SUITEST_PASSWORD) {
    return { email: process.env.SUITEST_EMAIL, password: process.env.SUITEST_PASSWORD };
  }
  const credPath = path.join(ROOT, ".suitest", "credentials.json");
  if (fs.existsSync(credPath)) {
    const c = JSON.parse(fs.readFileSync(credPath, "utf8"));
    return { email: c.email, password: c.password };
  }
  throw new Error("Kredensial Suitest tidak ditemukan. Set SUITEST_EMAIL/SUITEST_PASSWORD atau pastikan .suitest/credentials.json ada.");
}

// ===== Login Suitest & dapatkan cookie =====
async function suitestLogin(baseUrl, email, password) {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${baseUrl}/auth/cookie/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie") || "";
  const m = setCookie.match(/suitest_session=([^;]+)/);
  if (!m) throw new Error(`Login Suitest gagal (status ${res.status}). Cek email/password.`);
  return m[1];
}

async function suitestApi(baseUrl, token, method, apiPath, payload, extraHeaders = {}) {
  const res = await fetch(`${baseUrl}${apiPath}`, {
    method,
    headers: { Cookie: `suitest_session=${token}`, "Content-Type": "application/json", ...extraHeaders },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${apiPath} -> ${res.status}: ${text.slice(0, 400)}`);
  }
  return res;
}

async function getWorkspaceId(baseUrl, token) {
  if (process.env.SUITEST_WORKSPACE) return process.env.SUITEST_WORKSPACE;
  const r = await suitestApi(baseUrl, token, "GET", "/api/v1/workspaces");
  const json = await r.json();
  const items = Array.isArray(json) ? json : json.items;
  return items[0].id || items[0].workspace_id;
}

async function resolveProjectId(baseUrl, token, ws, projectName) {
  if (process.env.SUITEST_PROJECT_ID) return process.env.SUITEST_PROJECT_ID;
  const r = await suitestApi(baseUrl, token, "GET", "/api/v1/projects", null, { "X-Workspace-Id": ws });
  const json = await r.json();
  const items = Array.isArray(json) ? json : json.items || [];
  const found = items.find((p) => p.name === projectName || p.slug === projectName.toLowerCase().replace(/\s+/g, "-"));
  if (found) return found.id;
  const cr = await suitestApi(baseUrl, token, "POST", "/api/v1/projects", { name: projectName, slug: projectName.toLowerCase().replace(/\s+/g, "-") }, { "X-Workspace-Id": ws });
  return (await cr.json()).id;
}

// ===== STEP 1: jalankan test Playwright =====
function runPlaywright() {
  step(`[1/3] Menjalankan test Playwright: ${SPEC_FILE} (${BROWSER})`);
  // Hapus hasil lama agar tidak tercampur
  if (fs.existsSync(RESULTS_FILE)) fs.unlinkSync(RESULTS_FILE);

  // Gunakan reporter json. Penting: forward slash untuk path spec — backslash
  // diinterpretasikan sebagai regex escape oleh Playwright -> "No tests found".
  const specArg = SPEC_FILE.replace(/\\/g, "/");
  const result = spawnSync(process.execPath, [PLAYWRIGHT_CLI, "test", specArg, `--project=${BROWSER}`, "--reporter", "json", "--output", "test-results"], {
    cwd: ROOT,
    stdio: "pipe",
    env: { ...process.env, PW_TEST_HTML_REPORT_OPEN: "never" },
  });
  // Playwright json reporter (tanpa outputFile) menulis ke stdout, bukan file.
  // stdout berisi teks (mis. "{ quiet: true }") + JSON report. Cari objek yang
  // berisi "config" sebagai penanda awal JSON report yang valid.
  const stdout = result.stdout ? result.stdout.toString() : "";
  if (!fs.existsSync(RESULTS_FILE)) {
    const configIdx = stdout.indexOf('"config"');
    if (configIdx !== -1) {
      const braceBefore = stdout.lastIndexOf("{", configIdx);
      if (braceBefore !== -1) {
        fs.writeFileSync(RESULTS_FILE, stdout.slice(braceBefore), "utf8");
      }
    }
  }
  return result.status;
}

// ===== STEP 2: impor hasil =====
async function ingestResults() {
  step("[2/3] Mengimpor hasil run ke Suitest TCM");
  if (!fs.existsSync(RESULTS_FILE)) {
    throw new Error(`File hasil tidak ditemukan: ${RESULTS_FILE}`);
  }
  const report = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));

  // Mapping hasil Playwright -> IngestResult
  const results = [];
  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      const test = (spec.tests || [])[0];
      const result = test?.results?.[0];
      const status = result?.status || spec.status || "skipped";
      const norm = status === "passed" ? "PASSED" : status === "failed" ? "FAILED" : status === "skipped" ? "SKIPPED" : String(status).toUpperCase();
      results.push({
        name: spec.title,
        slug: spec.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, ""),
        outcome: norm,
        durationMs: result?.duration || 0,
        error: result?.error?.message || "",
        steps: [{ order: 0, type: "action", description: spec.title, outcome: norm, durationMs: result?.duration || 0 }],
      });
    }
    for (const c of suite.suites || []) walk(c);
  };
  walk(report);

  if (results.length === 0) throw new Error("Tidak ada hasil test di report.");

  const { email, password } = loadCredentials();
  const token = await suitestLogin(SUITEST_URL, email, password);
  const ws = await getWorkspaceId(SUITEST_URL, token);
  const projId = await resolveProjectId(SUITEST_URL, token, ws, PROJECT_NAME);

  const payload = {
    suiteName: SUITE_NAME,
    name: `Playwright ${new Date().toISOString()}`,
    env: process.env.SUITEST_ENV || "staging",
    branch: process.env.SUITEST_BRANCH || null,
    projectId: projId,
    finalize: true,
    results,
  };
  const r = await suitestApi(SUITEST_URL, token, "POST", "/api/v1/runs/ingest", payload, { "X-Workspace-Id": ws });
  const json = await r.json();
  console.log(`✅ Hasil diimpor: run ${json.runId || json.publicId || "(ok)"} (${results.length} hasil)`);
  return { projId, ws, token };
}

// ===== STEP 3: export UAT PDF =====
async function exportUat(ctx, caseId) {
  step("[3/3] Export dokumen UAT (PDF)");
  const r = await suitestApi(SUITEST_URL, ctx.token, "POST", `/api/v1/projects/${ctx.projId}/exports/uat`, { case_ids: [caseId], title: UAT_TITLE, locale: UAT_LOCALE }, { "X-Workspace-Id": ctx.ws });
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(PDF_OUT, buf);
  console.log(`✅ PDF UAT disimpan: ${PDF_OUT} (${buf.length} bytes)`);
  if (!buf.slice(0, 5).toString() === "%PDF-") {
    console.warn("⚠️ Peringatan: output bukan header PDF standar.");
  }
}

// Cari case_id dari hasil ingest (pakai slug) — fallback ke env atau sugesti
async function findCaseId(ctx, suiteName, caseName) {
  if (process.env.SUITEST_CASE_ID) return process.env.SUITEST_CASE_ID;
  // Cari test case pertama yang namanya cocok
  const r = await suitestApi(SUITEST_URL, ctx.token, "GET", `/api/v1/test-cases?projectId=${ctx.projId}&limit=50`, null, { "X-Workspace-Id": ctx.ws });
  const json = await r.json();
  const items = Array.isArray(json) ? json : json.items || [];
  const found = items.find((c) => c.name === caseName || (c.name || "").includes(caseName));
  if (found) return found.id;
  if (items.length > 0) {
    console.warn(`⚠️ Test case '${caseName}' tidak ditemukan; memakai case pertama: ${items[0].public_id}`);
    return items[0].id;
  }
  throw new Error("Tidak ada test case di project untuk export UAT.");
}

// ===== MAIN =====
async function main() {
  const exitCode = runPlaywright();
  if (exitCode !== 0) {
    console.warn(`⚠️ Test selesai dengan exit code ${exitCode} (bisa karena ada test gagal). Lanjut impor hasil...`);
  }

  const ctx = await ingestResults();
  const report = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
  const firstName = report.suites?.[0]?.specs?.[0]?.title || "KKPR Penilaian";
  const caseId = await findCaseId(ctx, SUITE_NAME, firstName);
  await exportUat(ctx, caseId);

  console.log(`\n${"=".repeat(60)}\n✅ SELESAI — seluruh alur berhasil.\n📄 Dokumen UAT: ${PDF_OUT}\n${"=".repeat(60)}`);
}

main().catch((err) => {
  console.error("❌ Gagal:", err.message);
  process.exit(1);
});
