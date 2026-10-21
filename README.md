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

1. On `/apply`, pick an amount, continue through the form (it is prefilled in
   sample mode), connect a bank and submit. On the bank screen, the demo
   option picks which sample data the bank returns: steady pay (suggested
   approval) or irregular pay (suggested decline).
2. The applicant lands on `/apply/<id>`, which waits for a reviewer.
3. Open the application on `/review`. Approve as suggested, adjust the amount,
   or decline. Overrides need a written reason.
4. Back on `/apply/<id>`, the decision appears. Accept the offer, or opt into
   a re-check after a decline.

## Checks

```sh
npm test          # backend: product rules, sealing, config, the full flow over HTTP; frontend: flow reducer
npm run typecheck
npm run lint
npm run build
```

## Status

Build order (HANDOFF section 10): steps 1 to 5 are done against the temporary
backend. Step 6, the real integrations (data provider, ID check, persistence,
auth), is not started. Until then there is no sign-in, so anyone with an
`/apply/<id>` link can see that application's outcome.
