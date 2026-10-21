# Handoff: borrower application and lender review

This document is the spec for turning the prototype in `design/` into a real
front end. The prototype was built for a laptop demo with sample data; this
explains what each screen does, which behaviour is real, and which is demo
scaffolding to replace.

## 1. The product in one paragraph

A consumer lender for people whose credit score doesn't reflect their ability
to repay (newcomers with no Canadian file, people recovering from a past
default). Instead of a bureau score, it underwrites from source-verified
evidence, mainly read-only bank data, and records where every fact came from.
Two surfaces: a borrower application and a lender review screen.

## 2. Files

| File | What it is |
|---|---|
| `design/Main.dc.html` | Borrower flow, one centred column (max 520px) |
| `design/Lender.dc.html` | Lender review screen, queue plus application detail |

Both are Claude Design component files: markup inside `<x-dc>`, with screen
logic in the `class Component extends DCLogic` script at the bottom. The
`renderVals()` method holds all sample data and every state transition, so it
is the most useful part to read.

## 3. Suggested stack

A default, not a requirement. Change it if there is a reason to.

- Next.js (App Router) with TypeScript
- Routes: `/apply` (borrower flow), `/review` and `/review/[id]` (lender)
- Plain CSS modules or Tailwind, with the tokens in section 6 as CSS variables
- Borrower flow as an explicit state machine (a reducer is enough)
- A typed fixtures module for all sample data, behind the same interfaces the
  real API will use, so swapping in real data changes no components

## 4. Borrower flow (`/apply`)

Steps, in order. Progress bar shows 4 steps; Back is available where noted.

| State | Purpose | Next | Back to |
|---|---|---|---|
| `start` | Pitch, amount picker ($1,000 / $2,000 / $4,000 / $6,000), how it works | `about` | — |
| `about` | Full legal name (required), email, mobile | `consent` | `start` |
| `consent` | What we read / what we can't do; connect bank | `bank` or `manual` | `about` |
| `manual` | Alternatives: payroll connection, statement upload, employer confirmation | `bank` | `consent` |
| `bank` | Searchable bank list | `connecting` | `consent` |
| `connecting` | Progress while data is read | `found` (automatic) | — |
| `found` | Shows the borrower exactly what the reviewer will see; optional note or upload; "something looks wrong" note | `decision` | `bank` |
| `decision` | Approved or declined, with reasons | — | — |

Rules carried by the design:

- The consent screen states what is read and what is never possible (move
  money, see the password, read after disconnect). Final wording depends on
  the consent rules of the data provider and of Canada's consumer-driven
  banking framework once its regulations are in force.
- `found` uses the same facts as the reviewer screen. The borrower can flag
  errors before submitting; that note travels with the application.
- An upload on `found` is labelled as checked by a person and weighted less.
- **Approved** shows: amount, term, monthly payment, rate, total cost of
  borrowing, the step-up path, and "why this amount" reasons tagged Helps /
  Holds back. If the request exceeds the offer, say so and show the path.
- **Declined** shows: the main reasons (numbered, plain language), what would
  change the outcome, an opt-in re-check in 3 months, and a way to ask a
  person to review. It states that no credit score was used.
- The prototype's "outcome" switch (approved/declined) is demo-only. In the
  product the decision comes from the review.

## 5. Lender review (`/review`)

Layout: queue on the left; application detail and decision panel on the right.
Wraps to one column on narrow screens.

**Queue items** show name, application id, amount, data status, and a status
badge: Ready for review, Waiting on applicant, Can't verify at source, Decided.

**Application detail**, top to bottom:

1. Header: name, id, amount requested, submitted time, chips (e.g. "No
   Canadian bureau file", "Bank connected"), and the evidence record line:
   record id, fact count, source count, sealed time, hash.
2. Four evidence sections, always in this order: **Identity, Capacity,
   Willingness, Resilience**. Each has the question it answers, a
   verification badge, and facts. Each fact shows its statement and a
   monospace provenance line. "Show source records" expands the raw records
   (date, record, amount or result).
3. **Not verified**: uploaded documents, with why they don't count and an
   action to request a source-verified alternative.
4. **Blind spots**: what the evidence can't see, each with a short note.

**Decision panel:**

- Suggested decision, terms, three metrics (monthly payment, payment as share
  of pay, left over after payment), top reasons tagged Helps / Hurts, and the
  model version and validation date.
- Actions: Approve as suggested; Adjust terms (amount $500–$6,000);
  Decline (choose the reason the applicant sees).
- Adjust and Decline both require a written override reason. Show inline
  errors and block submission until valid.
- After a decision: a "Decision logged" summary with outcome, amount and
  payment if any, whether the suggestion was followed, reviewer note, time,
  reviewer, and evidence record reference. The prototype's Undo is demo-only;
  real decisions are append-only.

A queue item with only uploaded evidence gets **no suggestion**: the screen
explains why and asks the reviewer to request a source connection.

## 6. Design tokens

| Token | Value | Use |
|---|---|---|
| Ground | `#F5F6F3` | Page background, inset panels |
| Surface | `#FFFFFF` | Cards |
| Ink | `#15201C` | Primary text |
| Secondary text | `#4A5752` | Body copy |
| Muted text | `#5F6B66` | Labels, provenance lines |
| Border | `#DCE1DD` | Cards; row dividers `#E6EAE7`; inputs `#C9D1CC` |
| Accent | `#0F5C4E` | Primary buttons, links, progress |
| Accent tint | `#E3EFEB` / text `#0B4A3F` | Verified badges, "Helps" tags, selection |
| Soft accent | `#EEF5F2` | "What we read", "What would change it" |
| Warning tint | `#FBEFD9` / text `#7A4A06` | Unverified, "Hurts", "Not yet" |
| Neutral tint | `#ECEEEB` / text `#3E4A45` | Neutral badges |
| Error text | `#A12C1F` | Validation messages |

- Type: IBM Plex Sans (400/500/600) for UI; IBM Plex Mono for provenance
  lines, ids, dates and amounts in record tables.
- Radii: 16px borrower card, 14px lender cards, 12px buttons and inset
  panels, 10px inputs, 6px badges.
- Controls: primary buttons 48–52px tall; nothing interactive under 44px.

## 7. Data model sketch

```ts
type EvidenceCategory = 'identity' | 'capacity' | 'willingness' | 'resilience';
type SourceType = 'bank_api' | 'payroll_api' | 'id_check' | 'upload' | 'derived';

interface EvidenceItem {
  id: string;
  category: EvidenceCategory;
  statement: string;          // plain-language fact shown in the UI
  sourceType: SourceType;
  sourceRef: string;          // e.g. connection id, vendor check id
  retrievedAt: string;        // ISO timestamp
  verified: boolean;          // false for uploads, always
  derivedFrom?: string[];     // ids of items a derived fact was computed from
  records: { date: string; description: string; value: string }[];
}

interface EvidenceRecord {
  id: string;                 // e.g. ER-4821
  applicationId: string;
  items: EvidenceItem[];
  sealedAt: string;
  sha256: string;             // over the canonical JSON of items
}

interface Reason { direction: 'helps' | 'hurts'; text: string }

interface Suggestion {
  outcome: 'approve' | 'decline' | 'none';   // 'none' when nothing is verified
  amount?: number;
  termMonths?: number;
  apr?: number;
  reasons: Reason[];
  modelVersion: string;
}

interface Decision {
  applicationId: string;
  evidenceRecordId: string;
  outcome: 'approved' | 'declined';
  amount?: number;
  followedSuggestion: boolean;
  overrideNote?: string;      // required when followedSuggestion is false
  applicantReason?: string;   // required for declines
  reviewerId: string;
  decidedAt: string;
}

interface Application {
  id: string;
  applicant: { legalName: string; email: string; phone: string };
  requestedAmount: number;
  status: 'ready' | 'waiting' | 'unverifiable' | 'decided';
  borrowerNote?: string;      // "something looks wrong" text
  evidenceRecordId?: string;
}
```

Note the design deliberately shows no protected characteristics (country of
origin, age, etc.) on the review screen. Keep it that way.

## 8. Demo-only, replace before real use

- Every person, amount, date and record in `renderVals()` is sample data.
- 24.9% APR, 18-month term and the $3,000 / $6,000 step-up are illustrative.
- The 2.6-second "connecting" timer stands in for a real data connection.
- The bank list is text only. Show only institutions your data provider
  actually supports.
- The evidence hash shown is a placeholder string.
- Bracketed placeholders: `[Brand]`, `[Your pricing]`, `[ID vendor]`,
  `[Employer]`, `[Landlord]`, `Model [version]`, `[date]`.
- "Talk to someone" and "Ask a person to review" buttons have no behaviour.
- The approved/declined Tweak and the Undo button.

## 9. Decisions needed outside the front end

These shape the code but aren't front-end decisions. Flag rather than guess.

- **Bank data provider.** Canada's consumer-driven banking framework had not
  launched when this was written; check its current status. Until then,
  access goes through commercial aggregators.
- **Identity verification vendor.**
- **Underwriting model and its validation.** The UI assumes an explainable
  model that returns reasons; a black-box score doesn't fit this design.
- **Pricing and funding cost.** Canada's criminal interest rate cap is 35% APR
  (since January 1, 2025); all-in pricing must fit under it.
- **Legal review.** Provincial licensing, consent and privacy (PIPEDA, and
  Quebec's Law 25 if lending there, which requires telling people when a
  decision is fully automated), disclosure wording, decline notices.

## 10. Suggested build order

1. Tokens, layout shell and both routes with static fixtures.
2. Borrower flow as a state machine, including validation and the declined path.
3. Lender review: queue, evidence sections with expandable records, not-verified
   and blind-spot sections.
4. Decision panel with override validation and the logged-decision view.
5. An API layer with the interfaces in section 7, backed by fixtures.
6. Only then real integrations: data provider, ID check, persistence, auth.
