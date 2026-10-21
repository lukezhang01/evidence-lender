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

The backend serves sample data from `backend/src/fixtures.ts`. Every screen shows
a "Demo · sample data" label while it does.

## Checks

```sh
npm test          # backend: product rules on the fixtures, sealing, config, HTTP API
npm run typecheck
npm run lint
npm run build
```

## Status

Build order (HANDOFF section 10): step 1 is done, with tokens, both layout shells
and the `/apply`, `/review` and `/review/[id]` routes reading from the
temporary backend.
