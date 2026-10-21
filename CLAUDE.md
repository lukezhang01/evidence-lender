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

## Repo layout

npm workspaces, Node 24+.

- `frontend/`: Next.js App Router app.
  - Routes: `/apply` (borrower flow, a reducer in `components/borrower/flow.ts`),
    `/apply/[id]` (the applicant's decision, polls until a reviewer decides),
    `/review` and `/review/[id]` (queue, evidence, decision panel).
  - Reads go through `src/lib/api.ts` on the server; every write is a Server
    Action in `src/lib/actions.ts`. Client components get preformatted view
    models (`src/lib/views.ts`), so server and browser never format differently.
  - This Next.js version differs from older ones; read `frontend/AGENTS.md` and
    the bundled docs in `node_modules/next/dist/docs/` before using a Next API.
- `backend/`: temporary fixture-backed JSON API (plain `node:http`, run with
  Node's built-in TypeScript support, no build step). Real integrations replace
  it in build order step 6.
  - `src/contract.ts`: the API types (HANDOFF section 7 plus marked additions).
    The frontend imports it with `import type` only.
  - `src/fixtures.ts`: the one file with sample data.
  - `config/product.json`: brand, locale, currency, time zone, amount options
    and illustrative pricing. Validated at startup, including the 35% APR cap.
  - `src/store.ts`: in-memory state, reset from the fixtures on restart or
    `POST /api/demo/reset`. Seals evidence records at submit (sha256 over
    canonical items), prices offers from config (`src/pricing.ts`), returns no
    suggestion when nothing is verified, and enforces the decision rules
    (override note, applicant-facing decline reason, one decision per
    application) whatever the frontend sends.
  - `src/app.ts`: the HTTP routes. `src/*.test.ts`: product rules on the
    fixtures and the full borrower-to-reviewer flow over HTTP.
- `docs/HANDOFF.md`: the spec. `docs/design/*.dc.html`: the design source.

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
