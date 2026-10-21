# Evidence lender

Borrower application and lender review screens for a consumer lender that
underwrites from bank transactions instead of a credit score. Goals, decisions and
status are in [docs/HANDOFF.md](docs/HANDOFF.md); the product rules are in [CLAUDE.md](CLAUDE.md).

## Run it

Requires Node 24 or later.

```sh
npm install
npm run dev
```

- Borrower flow: http://localhost:3000/apply
- Lender review: http://localhost:3000/review
- API: http://localhost:4000/api/applications

The backend is temporary. It seeds the review queue from
`backend/src/fixtures.ts` and keeps changes in memory, so restarting it puts
everything back. The screens never say they're a demo; sample data stays on the
developer's side.

## Try the whole loop

1. On `/apply`, type an amount, your name and email, and choose a bank
   statement saved as a CSV with these columns:
   - Date (2026-03-27)
   - Amount: money in positive and out negative, or Debit and Credit columns,
     or unsigned amounts with a Type column (CREDIT or DEBIT)
   - Balance (the credit score needs it) and Description, if the bank has them

   No file handy? Upload one from `samples/` (`npm run samples -w backend`
   rewrites them from the fixtures).
2. Submit. The applicant lands on `/apply/<id>`, which shows their credit score
   and the suggested interest rate, and waits for a reviewer.
3. Open the application on `/review`: the credit score comes first, then what
   the statement shows and what it can't. Approve (type an amount) or decline
   (pick the reason the applicant sees). Either way, write why.
4. Back on `/apply/<id>`, the decision appears: the loan terms, or the reason.

## Checks

```sh
npm test          # backend: CSV parser, product rules, sealing, config, the credit score model, the full flow over HTTP; frontend: the application form
npm run typecheck
npm run lint
npm run build
```

## Status

Scope for now: the only evidence is an uploaded CSV bank statement, so nothing
is verified at source, no outcome is suggested and a person decides every
application. The credit score comes from the course notebook's experimental
model (`model/export.py` rebuilds it); the reviewer and the applicant both see
it, clearly labelled. Bank connections, PDF statements, ID checks and automated
suggestions are later work. There is no sign-in yet, so anyone with an
`/apply/<id>` link can see that application's score and outcome.
