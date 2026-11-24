# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## 5. Project Skills

Load these before starting related work:

- **PKKPR / KKPR scenarios (shared)** — [docs/SKILL_PKKPR_Scenarios.md](../docs/SKILL_PKKPR_Scenarios.md)
  Shared skeleton, per-scenario KBLI/result deltas, Penguasaan Lahan branches (date picker, 3 tenure
  paths, Pasal 27 2.c./2.d., 7-point Pernyataan modal), the upload-never-awaited pitfall, and which
  specs are proven green vs still empty.
- **MBR / KKPR Kondisi Tertentu automation** — [docs/SKILL_MBR_KKPR_Automation.md](../docs/SKILL_MBR_KKPR_Automation.md)
  Locators, MBR-vs-KKPR_Penilaian differences, upload pitfalls, and how to run Playwright in this repo.
- **Migas / KKPR Kondisi Tertentu automation** — [docs/SKILL_MIGAS_KKPR_Automation.md](../docs/SKILL_MIGAS_KKPR_Automation.md)
  KBLI 06100 (no KBLI-2020/2025 mapping block), ruang lingkup "first option", the penetapan wilayah
  kerja upload + Lihat Dokumen/Kembali preview step, and Migas-specific pitfalls.
- **SKPBKI / KKPR Kondisi Tertentu automation** - [docs/SKILL_SKPBKI_KKPR_Automation.md](../docs/SKILL_SKPBKI_KKPR_Automation.md)
  KBLI 15201 + ruang lingkup "Seluruh", the scale radio that refuses `check()` (click its label),
  the `> 10M` spacing, the outside-industrial-estate verification checkbox, and the two issued
  documents (`Belum melengkapi persyaratan` + `Menunggu Verifikasi K/L`).