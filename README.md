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

1. On `/apply`, pick an amount and fill in the form.
2. Upload a bank statement as a CSV with these columns:
   - Date (2026-03-27)
   - Amount: money in positive and out negative, or Debit and Credit columns,
     or unsigned amounts with a Type column (CREDIT or DEBIT)
   - optionally, Description and Balance

   No file handy? Upload one from `samples/` (`npm run samples -w backend`
   rewrites them from the fixtures).
3. Check what was read from it, add a note if something looks wrong, and submit.
   The applicant lands on `/apply/<id>`, which waits for a reviewer.
4. Open the application on `/review`, read the facts and approve (pick an
   amount) or decline (pick the reason the applicant sees). Either way, write why.
5. Back on `/apply/<id>`, the decision appears. Accept the offer, or opt into
   a re-check after a decline.

## Checks

```sh
npm test          # backend: CSV parser, product rules, sealing, config, experimental model, the full flow over HTTP; frontend: flow reducer
npm run typecheck
npm run lint
npm run build
```

## Status

Scope for now: the only evidence is an uploaded CSV bank statement, so nothing
is verified at source, no suggestion is made and a person decides every
application. Reviewers also see an experimental score from the course
notebook's model (`model/export.py` rebuilds it), clearly labelled and never
shown to the applicant. Bank connections, PDF statements, ID checks and automated
suggestions are later work. There is no sign-in yet, so anyone with an
`/apply/<id>` link can see that application's outcome.
