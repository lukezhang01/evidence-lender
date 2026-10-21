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

