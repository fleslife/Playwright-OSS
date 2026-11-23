#!/usr/bin/env node
/**
 * export-uat.mjs
 *
 * Export dokumen UAT (PDF "Berita Acara UAT") dari Suitest untuk test case tertentu.
 *
 * Cara pakai:
 *   node scripts/export-uat.mjs
 *
 * Opsional env:
 *   SUITEST_URL        (default http://127.0.0.1:4000)
 *   SUITEST_PROJECT    (nama project; default "Playwright OSS")
 *   SUITEST_CASE_ID    (id test case; jika kosong, auto-cari berdasarkan nama)
 *   SUITEST_CASE_NAME  (nama test case untuk auto-cari; default "KKPR Penilaian")
 *   SUITEST_UAT_TITLE  (judul dokumen UAT; default "UAT Document - KKPR Penilaian")
 *   SUITEST_UAT_LOCALE (default "id")
 *   SUITEST_UAT_OUT    (path file PDF output; default ./UAT_KKPR_Penilaian.pdf)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SUITEST_URL = process.env.SUITEST_URL || "http://127.0.0.1:4000";
const PROJECT_NAME = process.env.SUITEST_PROJECT || "Playwright OSS";
const CASE_NAME = process.env.SUITEST_CASE_NAME || "KKPR Penilaian";
const UAT_TITLE = process.env.SUITEST_UAT_TITLE || "UAT Document - KKPR Penilaian";
const UAT_LOCALE = process.env.SUITEST_UAT_LOCALE || "id";
const PDF_OUT = process.env.SUITEST_UAT_OUT || path.join(ROOT, "UAT_KKPR_Penilaian.pdf");

function loadCredentials() {
  if (process.env.SUITEST_EMAIL && process.env.SUITEST_PASSWORD) {
    return { email: process.env.SUITEST_EMAIL, password: process.env.SUITEST_PASSWORD };
  }
  const credPath = path.join(ROOT, ".suitest", "credentials.json");
  if (fs.existsSync(credPath)) {
    const c = JSON.parse(fs.readFileSync(credPath, "utf8"));
    return { email: c.email, password: c.password };
  }
  throw new Error("Kredensial Suitest tidak ditemukan.");
}

async function login(baseUrl, email, password) {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${baseUrl}/auth/cookie/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  });
  const m = (res.headers.get("set-cookie") || "").match(/suitest_session=([^;]+)/);
  if (!m) throw new Error(`Login gagal (${res.status})`);
  return m[1];
}

async function api(baseUrl, token, method, apiPath, payload, headers = {}) {
  const res = await fetch(`${baseUrl}${apiPath}`, {
    method,
    headers: { Cookie: `suitest_session=${token}`, "Content-Type": "application/json", ...headers },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    throw new Error(`API ${method} ${apiPath} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res;
}

async function main() {
  const { email, password } = loadCredentials();
  const token = await login(SUITEST_URL, email, password);

  // workspace & project
  const wsResp = await api(SUITEST_URL, token, "GET", "/api/v1/workspaces");
  const wsJson = await wsResp.json();
  const items = Array.isArray(wsJson) ? wsJson : wsJson.items;
  const ws = items[0].id || items[0].workspace_id;

  const projResp = await api(SUITEST_URL, token, "GET", "/api/v1/projects", null, { "X-Workspace-Id": ws });
  const projJson = await projResp.json();
  const projs = Array.isArray(projJson) ? projJson : projJson.items || [];
  const proj = projs.find((p) => p.name === PROJECT_NAME) || projs[0];
  if (!proj) throw new Error("Project tidak ditemukan.");
  const projId = proj.id;

  // cari case id
  let caseId = process.env.SUITEST_CASE_ID;
  if (!caseId) {
    const casesResp = await api(SUITEST_URL, token, "GET", `/api/v1/test-cases?projectId=${projId}&limit=100`, null, { "X-Workspace-Id": ws });
    const casesJson = await casesResp.json();
    const cases = Array.isArray(casesJson) ? casesJson : casesJson.items || [];
    const found = cases.find((c) => (c.name || "").includes(CASE_NAME));
    if (found) {
      caseId = found.id;
      console.log(`Menggunakan test case: ${found.public_id} (${found.name})`);
    } else if (cases.length > 0) {
      caseId = cases[0].id;
      console.warn(`Test case '${CASE_NAME}' tidak ditemukan; memakai ${cases[0].public_id}`);
    } else {
      throw new Error("Tidak ada test case di project.");
    }
  }

  console.log(`Export UAT document untuk case ${caseId} (project ${PROJECT_NAME})...`);
  const resp = await api(SUITEST_URL, token, "POST", `/api/v1/projects/${projId}/exports/uat`, { case_ids: [caseId], title: UAT_TITLE, locale: UAT_LOCALE }, { "X-Workspace-Id": ws });
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(PDF_OUT, buf);
  console.log(`✅ PDF UAT disimpan: ${PDF_OUT} (${buf.length} bytes)`);
}

main().catch((err) => {
  console.error("❌ Gagal:", err.message);
  process.exit(1);
});
