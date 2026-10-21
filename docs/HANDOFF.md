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
  - bank APIs, aggregators and payroll connections
  - PDF statements and other document uploads
  - ID verification and the credit bureau
  - automated suggestions (a proposed outcome, amount or reasons)
  - other ways to verify (payroll, employer)
- What follows from that:
  - Uploads are never verified (rule 2), so nothing produces a suggestion.
  - A reviewer reads the facts, then approves an amount or declines with a reason the applicant sees, and always writes why (rule 5).
  - The user chose this option over "suggest from the CSV" and "suggest after a person checks it".
- **Added later the same day (issue #4):** a reviewer-only experimental score from the course notebook's model. It is not a suggestion. The user chose this over showing the model's features as facts, shadow mode, and using the score as the main output. Issue #3 needs its text updated to match (see the open questions).
- **Clean-up, also 2026-10-21 (the `clean-up` branch):** the user asked to keep only what's needed to understand the product or use its core features, and listed it:
  - borrower: name, email, the bank statement with instructions, a typed amount (not preset options), then the credit score and suggested interest rate
  - lender: the list of applicants, then for each one their details, the amount asked for, the credit score and the model's analysis, with the score first
- What they decided when asked:
  - The experimental score is now the **credit score**, and the applicant sees it right after submitting (this reverses "reviewers only").
  - It stays the model's raw 0 to 1 score, not a rescaled one.
  - The suggested interest rate is `pricing.apr`, the same for everyone, not priced by score.

## What exists

`main` is at 08e087d (the experimental score from issue #4 is merged). The clean-up is on the `clean-up` branch.

Everything works end to end against a temporary, in-memory backend.

1. **Application (`/apply`):** one form.
   - the amount, typed (whole dollars within `pricing.amountRange`, $500 to $6,000 now)
   - full legal name and email, both required
   - the bank statement, with the columns it needs; the file is read in the browser and sent on submit
   - Errors show by each field, from the same checks the backend makes. A file the parser rejects shows its message by the file; a retry reuses the draft.
2. **Submit:** seals an evidence record (sha256 over the canonical JSON of the facts), computes the credit score, and puts the application in the review queue.
3. **Applicant's page (`/apply/[id]`):**
   - the credit score (0 to 1, lower is better), said to come from an experimental model and not a credit bureau, with a provenance line; or why there's no score
   - while in review: the suggested interest rate and the amount asked for; it polls every 3 s
   - approved: the amount, rate, term, monthly payment and total cost of borrowing
   - declined: the reason and what would change it
4. **Review screen (`/review/[id]`):**
   - the applicant: name, email, application id, submitted time, amount requested
   - the credit score, first: the score, the three features that moved it most against the training median, what it was trained on and how it tested, and a provenance line (model id and sha256, the file's sha256, as-of date, when computed); or why there's no score
   - what the statement shows: one list of facts, each with a provenance line, under the file name, transaction count and dates, labelled "Uploaded · not verified"
   - what the statement can't show (blind spots)
   - the decision panel: one decision per application, append-only. Approve an amount (the monthly payment updates as you type) or decline with the reason the applicant sees; always write why.

**Removed in the clean-up:** the start page's pitch and how-it-works, the progress bar, the "What we found" step and the applicant's note, the phone number, the preset amounts, the borrower's after-decision buttons (accept, talk first, re-check, ask a person; they only recorded a request), the starter limit and step-up, the "(illustrative)" label, the four evidence category cards with their statement-row tables, the separate statement card, and the evidence-record line in the reviewer's header (the logged decision still shows it, for rule 6).

**No demo mode.** The screens never present themselves as a demo (the user's rule, now in CLAUDE.md). Sample data stays on the developer's side:
- The temporary backend seeds 4 applications from the fixtures. Restarting it resets everything.
- `samples/` holds the fixture statements as CSV files to upload by hand. `npm run samples -w backend` rewrites them, and a test checks they still match.

An earlier version had a demo mode: a "Demo · sample data" label, a prefilled applicant, sample-statement buttons on the upload step, "Reset sample data", and links between the borrower and reviewer sides. The user had it all removed.

**History:**
- PR #1 made every prototype button work, including a simulated bank connection.
- PR #2 cut the scope down to the CSV upload.
- Both are merged.
- PR #5 (issue #4) added the experimental score, and the rewrite of this file into the start-here document. Merged.
- The `clean-up` branch makes that score the credit score both sides see, and cuts the screens down to what's core (see Scope).

## Where things live

| Path | What |
|---|---|
| `backend/src/contract.ts` | API types; the frontend imports them type-only |
| `backend/src/statement.ts` | CSV parser, facts and blind spots |
| `backend/src/store.ts` | in-memory state, sealing, decision rules |
| `backend/src/app.ts` | HTTP routes |
| `backend/src/fixtures.ts` | all sample data; sample statements are generated as CSV |
| `samples/` | the sample statements as files, for uploading by hand; written by `npm run samples -w backend` |
| `backend/config/product.json` | brand, locale, pricing, minimum statement months, decline reasons |
| `backend/src/experimental.ts` | the experimental score: the notebook's features, ported, and the scoring |
| `backend/config/experimental-model.json` | the model's medians, scaler, coefficients and test results; written by `model/export.py` |
| `model/export.py` | rebuilds the notebook's model, checks it against the notebook's printed results, writes the file above and `backend/src/experimental.parity.json` |
| `frontend/src/components/lender/CreditScoreCard.tsx` | the reviewer's score card; its view model is in `frontend/src/lib/views.ts` |
| `frontend/src/components/borrower/ApplyForm.tsx` | the application form |
| `frontend/src/lib/api.ts`, `actions.ts` | server-side reads, and a Server Action for every write |
| `frontend/src/lib/views.ts`, `labels.ts`, `format.ts` | view models, UI wording for codes, formatting |
| `frontend/src/components/borrower/flow.ts` | the application form's state and checks |
| `frontend/src/app/review/[id]/page.tsx` | review detail page |

## CSV rules (`backend/src/statement.ts`)

- **Columns:** header names are case-insensitive and a few aliases work.
  - Date: `YYYY-MM-DD` or `YYYY/MM/DD` only
  - Description (optional; without it, pay, rent and fees can't be found)
  - Amount, in one of three forms:
    - signed
    - unsigned, with a Type column giving the direction: CREDIT, CR, DEPOSIT or PRIJEM for money in; DEBIT, DR, WITHDRAWAL, VYDAJ or VYBER for money out. The Czech codes are the Berka data's, which the notebook's demo statement uses. When amounts are signed, Type is ignored.
    - Debit and Credit columns instead
  - Balance (optional)
- **Rejected with a message the applicant can act on:**
  - wrong headers
  - an unreadable date, amount or type (the message gives the row number)
  - no rows, or more than 5,000
  - less than 3 months (set in config)
  - PDFs and files over 512 KB (checked in the browser)
- **Facts produced:**
  - average money in per month
  - average left over each month
  - with a Description column only:
    - the main regular deposit, if one recurring deposit makes up at least half the money in
    - rent, found by "rent" or "landlord" in the description and counted over full calendar months
    - overdraft and NSF fees, found by keyword
  - with a Balance column only: lowest balance, days below zero, ending balance
- **Blind spots:**
  - always: whether the statement is complete, whose account it is, other banks, cash income
  - when they apply:
    - what the transactions were for (no Description column; this replaces the next two)
    - housing costs (no rent found)
    - where the income comes from (no main deposit)
    - balances over time (no Balance column)

## Decisions not obvious from the code

- **No hard-coded values in components** (the user's instruction). Sample data comes from the API and product values from config; components hold only UI wording.
- **Sample applications go through the same CSV parser** as a real upload, so they can't drift from real behaviour.
- **Strings are formatted on the server**, in en-CA and America/Toronto time, so times read like "8:21 p.m.". Client components get preformatted view models.
- **Pricing is illustrative:** 24.9% APR for everyone, 18 months, $500 to $6,000. Config validation refuses an APR of 35% or more, the criminal rate cap.
- **How rule 2's "shown separately" is met:** the statement's facts sit in their own card, labelled "Uploaded · not verified", each with an upload icon.
- **The backend re-checks every rule** the UI checks.
- **The credit score (the experimental model):**
  - **When it's computed:** when the record is sealed, from the whole statement, as of the day after its last row. The newest 30-day period starts there.
  - **Where it's stored:** on the evidence record, but outside its hash, like blind spots. It names the model's sha256 and the statement file's sha256, so it can be traced and recomputed.
  - **Who sees it:** the reviewer, and the applicant once they submit (`borrower-view` carries it). A test checks the applicant gets exactly the sealed score, and nothing before the record is sealed.
  - **When it isn't computed:** no Balance column, fewer than 5 transactions in the 180 days, or a 30-day period with no transactions. That last rule matters because the model counts an empty period as no money moving, so a short statement would look like a quiet account.
  - **The notebook's exact model:** `model/export.py` reproduces it, all seven printed results. To do that it keeps the notebook's default sort, which can shuffle same-day transactions. The backend keeps file order, so a day's last balance really is its end-of-day balance. Only one feature differs: the typical end-of-day balance over the last 90 days.
  - **Amounts:** CAD amounts go in unconverted and are read as if they were CZK, as the notebook would read them. The reviewer's card says so.

## Working with this user

- **Keep screens lean.** On 2026-10-21 they asked to remove the "fluff": keep only what's needed to understand the product or use its core features.
- **Progress means working, clickable flows**, not scaffolding. When building one step of something, say up front what will and won't work.
- **Ask before changing the product rules.** That's how "person decides" was chosen.
- **Never build demo affordances into the app.** Demoing is the user's job, done from their side with `samples/`.
- **Keep to the current scope.** Don't answer with a long list of options; give the one or two that fit, with a recommendation.
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
- **Commands,** all from the repo root: `npm test` (50 backend tests and 6 frontend), `npm run typecheck`, `npm run lint`, `npm run build`.

## The notebook (`Berka_Cashflow_PD_Colab.ipynb`)

- **What it is:** the user's course proof of concept (CSC491 A4). It trains a default-risk classifier on the historical Czech Berka dataset (1990s, CZK), using cash-flow features from the 180 days before each loan. Its author says it is not real underwriting.
- **Its input:** a single statement with date, amount (positive), balance and type (PRIJEM for money in; VYDAJ or VYBER for money out).
- **How it relates to the app:** the app's CSV maps onto that input, with the sign of the amount giving the type.
- **How it's wired in:** as the credit score (see "What exists" and "Decisions not obvious from the code"). To change the model, edit `model/export.py` and rerun it with `.venv/bin/python model/export.py`. Its checks against the notebook's printed results will then fail on purpose, so update `NOTEBOOK` in the script to the new results.

## Open questions and likely next steps

- **Real bank exports:** which banks' CSVs to support first, given MM/DD and DD/MM dates and different column names.
- **Issue #3's text:** waiting on the user's edit on GitHub (`gh` isn't installed). The edit calls the cut scope creep, names bank APIs, and drops "or risk scores" from the out-of-scope list.
- **The credit score doesn't carry over to these statements, and applicants now see it.**
  - On the four sample statements it gives 0.004 to 0.052. It ranks "Irregular pay, money tight" (overdrafts, late rent) as the *least* risky.
  - The main reason is transaction count. Canadian statements have 105 to 169 transactions in 180 days, against a training median of 40, and more transactions lowers the score. Unconverted amounts push the other way.
  - For the score to say anything, the model would need retraining on features that carry over, such as ratios instead of counts and amounts. That's the user's call.
- **Sign-in and persistence:** anyone with an `/apply/<id>` link can see that score and outcome, anyone who can reach the backend can read evidence records, and all data resets when the backend restarts.
- **Decision corrections:** not built. Rule 6 says they must be new entries, not edits.
- **Decisions outside the front end,** still open from the original spec:
  - the data provider and the ID vendor
  - validating any scoring model
  - final pricing under the 35% cap
  - legal review: provincial licensing, PIPEDA, Quebec's Law 25 notice for automated decisions, and the wording of decline notices
