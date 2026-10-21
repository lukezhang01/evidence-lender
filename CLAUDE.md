# Lending prototype → product

This repo turns a clickable design prototype into a working front end for an
alternative-data consumer lender. Read `docs/HANDOFF.md` before writing code.

## Non-negotiable product rules

These are the point of the product. Never trade them away for convenience.

1. **Every fact carries provenance.** Any number or claim shown to a reviewer
   or borrower has a source type, a source reference and a retrieved-at
   timestamp. No unlabeled facts anywhere in the UI.
2. **Source data outranks uploads.** Anything a borrower uploads (PDF, image)
   is marked "not verified", shown separately, and never feeds the suggestion.
3. **Blind spots are always shown.** The review screen lists what the evidence
   cannot see. Never hide an empty or partial section.
4. **Reasons are plain language.** Every suggestion carries its top reasons,
   written so they can be sent to the applicant unchanged.
5. **Overrides need a written reason.** A reviewer who departs from the
   suggestion must write why. The reason is stored with the decision.
6. **Decisions are append-only.** A logged decision links to a sealed evidence
   record (hash over the canonical evidence). Corrections are new entries, not
   edits.

## Current scope

The only evidence is a bank statement the applicant uploads as a CSV. Bank or
payroll connections, ID checks, the credit bureau, PDF statements and other
document uploads are out of scope for now. The original prototype spec
(`git show d77c357:docs/HANDOFF.md`) describes that fuller product; treat those
parts of it as later work.

Because uploads are never verified (rule 2), no suggestion is made. A reviewer
reads the facts and decides every application, and always writes why (rule 5).
Every fact on screen is labelled as uploaded and not verified.

One addition, decided 2026-10-21: the review screen shows an **experimental
score** from the course notebook's model (`Berka_Cashflow_PD_Colab.ipynb`). It is
for reviewers only and never appears in anything the applicant sees. It isn't a
suggestion: it proposes no outcome, amount or reasons, and the decision panel
ignores it. It always says what it was trained on and how little it was tested,
and when a statement can't be scored it says why.

## Repo layout

npm workspaces, Node 24+.

- `frontend/`: Next.js App Router app.
  - Routes: `/apply` (start, about you, upload statement, what we found; a
    reducer in `components/borrower/flow.ts`), `/apply/[id]` (the applicant's
    decision, polls until a reviewer decides), `/review` and `/review/[id]`
    (queue, evidence by category, the uploaded statement, blind spots, the
    experimental score, decision panel).
  - Reads go through `src/lib/api.ts` on the server; every write is a Server
    Action in `src/lib/actions.ts`. Client components get preformatted view
    models (`src/lib/views.ts`), so server and browser never format differently.
  - This Next.js version differs from older ones; read `frontend/AGENTS.md` and
    the bundled docs in `node_modules/next/dist/docs/` before using a Next API.
- `backend/`: temporary fixture-backed JSON API (plain `node:http`, run with
  Node's built-in TypeScript support, no build step).
  - `src/contract.ts`: the API types (HANDOFF section 7, narrowed to the
    current scope, with marked additions). The frontend imports it with
    `import type` only.
  - `src/statement.ts`: parses the CSV (Date, Description, Amount or
    Debit/Credit, optional Balance) and turns it into facts with the rows they
    rest on, plus blind spots. Messages it throws are shown to the applicant.
  - `src/fixtures.ts`: the one file with sample data. Sample statements are
    generated there as CSV and loaded through the same parser as an upload.
  - `config/product.json`: brand, locale, currency, time zone, amount options,
    minimum statement length, decline reasons and illustrative pricing.
    Validated at startup, including the 35% APR cap.
  - `src/experimental.ts`: the experimental score. Ports the notebook's
    features and scores them with `config/experimental-model.json`, which
    `model/export.py` writes. Computed when a record is sealed; reviewer only.
  - `src/store.ts`: in-memory state, reset from the fixtures on restart or
    `POST /api/demo/reset`. Seals evidence records at submit (sha256 over
    canonical items), prices offers from config (`src/pricing.ts`), and
    enforces the decision rules (written reason, amount range, decline reason
    the applicant sees, one decision per application) whatever the frontend sends.
  - `src/app.ts`: the HTTP routes. `src/*.test.ts`: the parser, product rules
    on the fixtures, and the full borrower-to-reviewer flow over HTTP.
- `model/export.py`: rebuilds the notebook's model (Python: pandas,
  scikit-learn; the repo's `.venv` has them), stops if its results differ from
  the notebook's, and writes the model file plus parity statements for the
  TypeScript tests. Downloads the Berka data to `model/.data/` (ignored).
- `docs/HANDOFF.md`: goal, decisions, status and open questions (start here).
  `docs/design/*.dc.html`: the design source.

## Working conventions

- `docs/design/*.dc.html` are the design source. They depend on a runtime that
  is not included, so read them as a spec; don't try to run or import them.
- No hard-coded values in components. Sample data comes from the API (backed by
  `backend/src/fixtures.ts`), product and pricing values from
  `backend/config/product.json`, and counts, hashes and money or dates are computed
  or formatted from those. Components hold UI copy only; codes are turned into
  wording in `frontend/src/lib/labels.ts`.
- Interest rate, fees and terms in the prototype are illustrative. Pricing is
  a business decision; keep it in config, not code.
- Provenance lines are built from data (`frontend/src/lib/evidence.ts`), never
  typed out, so every line has source type, reference and time.
- Controls are at least 44px tall, including the links and buttons the prototype
  drew smaller.

## Commands

From the repo root: `npm run dev` (backend on :4000, frontend on :3000),
`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
Restart `npm run dev` after adding classes to an existing CSS module: the dev
server has been seen serving the old class map until restarted.
