# Handoff

Start here in a new chat. The product rules and code conventions are in
[CLAUDE.md](../CLAUDE.md). This file covers the goal, the decisions behind the
current code, where things stand and what's still open. Last updated 2026-10-21.

## Goal

A consumer lender for people whose credit score doesn't reflect their ability
to repay: newcomers to Canada with no credit file, and people rebuilding after a
default. It decides from bank transactions instead of a bureau score, and every
fact it shows says where it came from. There are two surfaces: the borrower
application (`/apply`) and the lender review screen (`/review`).

The project started from a clickable design prototype (`docs/design/*.dc.html`)
and its spec, which described a bigger product with bank connections, ID checks
and automated suggestions. That spec is in git history:
`git show d77c357:docs/HANDOFF.md`. Its design tokens and screen layouts are
built. The rest of it is out of scope for now.

## Scope (decided 2026-10-21, issue #3)

- The only evidence is a bank statement the applicant uploads as a CSV.
- Out of scope until decided otherwise:
  - bank or payroll connections
  - PDF statements and other document uploads
  - ID verification and the credit bureau
  - automated suggestions or risk scores
  - other ways to verify (payroll, employer)
- What follows from that:
  - Uploads are never verified (rule 2), so nothing produces a suggestion.
  - A reviewer reads the facts, then approves an amount or declines with a reason the applicant sees, and always writes why (rule 5).
  - The user chose this option over "suggest from the CSV" and "suggest after a person checks it".

## What exists (`main` at 10e6a8f)

Everything works end to end against a temporary, in-memory backend.

1. **Borrower flow:**
   - start (pick an amount)
   - about you (legal name required)
   - upload the CSV
   - "Here's what we found": the same facts the reviewer sees, each with its source. The applicant can replace the file or add a note.
   - submit
2. **Submit:** seals an evidence record (sha256 over the canonical JSON of the facts) and puts the application in the review queue.
3. **Review screen (`/review/[id]`):**
   - Facts are grouped into Identity, Capacity, Willingness and Resilience. Each is labelled "Not verified · uploaded statement" and shows the statement rows behind it.
   - An "Uploaded statement" card shows the file name, the period it covers and the file's sha256.
   - Blind spots are listed.
   - The decision panel allows one decision per application. Decisions are append-only: no undo, and corrections aren't built.
4. **Decision page (`/apply/[id]`):** polls every 3 s until a decision is logged, then shows:
   - approved: the terms, with "Accept offer" and "Talk to someone first"
   - declined: the reason, what would change it, "Check again in 3 months" and "Ask a person to review"

   These four buttons only record the request. Nothing acts on them yet.

**Sample mode** is always on while the backend serves fixtures. It shows a "Demo · sample data" label, prefills the applicant, offers two sample statements on the upload step, adds "Reset sample data" to the review screen, and seeds 4 applications.

**History:**
- PR #1 made every prototype button work, including a simulated bank connection.
- PR #2 cut the scope down to the CSV upload.
- Both are merged.

## Where things live

| Path | What |
|---|---|
| `backend/src/contract.ts` | API types; the frontend imports them type-only |
| `backend/src/statement.ts` | CSV parser, facts and blind spots |
| `backend/src/store.ts` | in-memory state, sealing, decision rules |
| `backend/src/app.ts` | HTTP routes |
| `backend/src/fixtures.ts` | all sample data; sample statements are generated as CSV |
| `backend/config/product.json` | brand, locale, pricing, minimum statement months, decline reasons |
| `frontend/src/lib/api.ts`, `actions.ts` | server-side reads, and a Server Action for every write |
| `frontend/src/lib/views.ts`, `labels.ts`, `format.ts` | view models, UI wording for codes, formatting |
| `frontend/src/components/borrower/flow.ts` | borrower state machine |
| `frontend/src/app/review/[id]/page.tsx` | review detail page |

## CSV rules (`backend/src/statement.ts`)

- **Columns:** header names are case-insensitive and a few aliases work.
  - Date: `YYYY-MM-DD` or `YYYY/MM/DD` only
  - Description
  - Amount (signed), or Debit and Credit instead
  - Balance (optional)
- **Rejected with a message the applicant can act on:**
  - wrong headers
  - an unreadable date or amount (the message gives the row number)
  - no rows, or more than 5,000
  - less than 3 months (set in config)
  - PDFs and files over 512 KB (checked in the browser)
- **Facts produced:**
  - average money in per month
  - the main regular deposit, if one recurring deposit makes up at least half the money in
  - average left over each month
  - rent, found by "rent" or "landlord" in the description and counted over full calendar months
  - overdraft and NSF fees, found by keyword
  - with a Balance column only: lowest balance, days below zero, ending balance
- **Blind spots:**
  - always: whether the statement is complete, whose account it is, other banks, cash income
  - when they apply: housing costs (no rent found), where the income comes from (no main deposit), balances over time (no Balance column)

## Decisions not obvious from the code

- **No hard-coded values in components** (the user's instruction). Sample data comes from the API and product values from config; components hold only UI wording.
- **Sample applications go through the same CSV parser** as a real upload, so they can't drift from real behaviour.
- **Strings are formatted on the server**, in en-CA and America/Toronto time, so times read like "8:21 p.m.". Client components get preformatted view models.
- **Pricing is illustrative:** 24.9% APR, 18 months, a $3,000 starter limit, rising to $6,000 after 6 on-time payments. Config validation refuses an APR of 35% or more, the criminal rate cap.
- **How rule 2's "shown separately" is met:** facts that aren't verified stay in their category but carry a "not verified" badge and icon, and the statement card says nothing is verified.
- **The backend re-checks every rule** the UI checks.

## Working with this user

- **Progress means working, clickable flows**, not scaffolding. When building one step of something, say up front what will and won't work.
- **Ask before changing the product rules.** That's how "person decides" was chosen.
- **They usually have `npm run dev` running on :3000 and :4000.**
  - Test on other ports: start the backend with `PORT=4100`, and the frontend with `API_BASE_URL=http://localhost:4100 npx next start -p 3100`.
  - Never kill their processes, and tell them when their dev server needs a restart.
- **One branch and PR per change**, and commit only when asked.
- **`gh` isn't installed.** Push the branch and give prefilled github.com links for issues and PRs. The repo is `lukezhang01/evidence-lender` and it's public.
- **Never commit `Berka_Cashflow_PD_Colab.ipynb`.** It's theirs and untracked.
- **`lending-handoff/` is still tracked.** They plan to delete it.

## Gotchas

- **Next.js 16.4:**
  - `params` is a Promise
  - `error.tsx` receives `retry`, not `reset`
  - Server Actions call `refresh()` from `next/cache`
  - `connection()` keeps data pages out of prerendering

  Read `node_modules/next/dist/docs/` before using a Next API.
- **Stale styles in dev:** after classes were added to an existing CSS module, the dev server kept serving the old class names until it was restarted.
- **Upload size:** Server Actions run one at a time, and the 512 KB browser cap keeps uploads under the action body limit.
- **No browser tests in the repo.** Earlier checks drove headless Chrome over the DevTools protocol from a throwaway script. Playwright would be the lasting version.
- **Commands,** all from the repo root: `npm test` (39 backend tests and 5 frontend), `npm run typecheck`, `npm run lint`, `npm run build`.

## The notebook (`Berka_Cashflow_PD_Colab.ipynb`)

- **What it is:** the user's course proof of concept (CSC491 A4). It trains a default-risk classifier on the historical Czech Berka dataset (1990s, CZK), using cash-flow features from the 180 days before each loan. Its author says it is not real underwriting.
- **Its input:** a single statement with date, amount (positive), balance and type (PRIJEM for money in; VYDAJ or VYBER for money out).
- **How it relates to the app:** the app's CSV maps onto that input, with the sign of the amount giving the type.
- **Why it isn't wired in:** its score would be an automated suggestion, which the current scope rules out.

## Open questions and likely next steps

- **Real bank exports:** which banks' CSVs to support first, given MM/DD and DD/MM dates and different column names.
- **The notebook's model:** whether it should appear, and how, given rule 2. One option is a clearly labelled experimental aid for the reviewer that the applicant never sees. That's the user's call.
- **Sign-in and persistence:** anyone with an `/apply/<id>` link can see that outcome, and all data resets when the backend restarts.
- **Decision corrections:** not built. Rule 6 says they must be new entries, not edits.
- **Decisions outside the front end,** still open from the original spec:
  - the data provider and the ID vendor
  - validating any scoring model
  - final pricing under the 35% cap
  - legal review: provincial licensing, PIPEDA, Quebec's Law 25 notice for automated decisions, and the wording of decline notices
