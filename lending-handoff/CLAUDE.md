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

## Working conventions

- `design/*.dc.html` are the design source. They depend on a runtime that is
  not included, so read them as a spec; don't try to run or import them.
- All sample people, amounts and dates live in one fixtures file. Nothing from
  the prototype's sample data is hard-coded in components.
- Interest rate, fees and terms in the prototype are illustrative. Pricing is
  a business decision; keep it in config, not code.
