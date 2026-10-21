# Evidence lender

Borrower application and lender review screens for a consumer lender that
underwrites from source-verified evidence instead of a credit score. The spec is
in [docs/HANDOFF.md](docs/HANDOFF.md) and the product rules are in [CLAUDE.md](CLAUDE.md).

## Run it

Requires Node 24 or later.

```sh
npm install
npm run dev
```

- Borrower flow: http://localhost:3000/apply
- Lender review: http://localhost:3000/review
- API: http://localhost:4000/api/applications

The backend serves sample data from `backend/src/fixtures.ts` and keeps changes
in memory, so a restart (or "Reset sample data" on the review screen) puts it
back. Every screen shows a "Demo · sample data" label while it does.

## Try the whole loop

1. On `/apply`, pick an amount and continue through the form (it's prefilled in
   sample mode).
2. Upload a bank statement as a CSV: columns Date (2026-03-27), Description,
   Amount (money in positive, out negative; or Debit and Credit) and,
   optionally, Balance. No file handy? Use one of the sample statements.
3. Check what was read from it, add a note if something looks wrong, and submit.
   The applicant lands on `/apply/<id>`, which waits for a reviewer.
4. Open the application on `/review`, read the facts and approve (pick an
   amount) or decline (pick the reason the applicant sees). Either way, write why.
5. Back on `/apply/<id>`, the decision appears. Accept the offer, or opt into
   a re-check after a decline.

## Checks

```sh
npm test          # backend: CSV parser, product rules, sealing, config, the full flow over HTTP; frontend: flow reducer
npm run typecheck
npm run lint
npm run build
```

## Status

Scope for now: the only evidence is an uploaded CSV bank statement, so nothing
is verified at source, no suggestion is made and a person decides every
application. Bank connections, PDF statements, ID checks and automated
suggestions are later work. There is no sign-in yet, so anyone with an
`/apply/<id>` link can see that application's outcome.
