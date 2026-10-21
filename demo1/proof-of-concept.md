# Proof of concept

## Scope

One path, end to end. An applicant uploads a bank statement as a CSV, a reviewer reads what it shows and decides, and the applicant sees the decision.

The original design also had bank connections, payroll and employer checks, ID verification, the credit bureau, document uploads and an automated suggestion. We cut all of it, for two reasons.

**1. The model can only read a statement.** The only public data we found that links bank transactions to loan repayment is the Berka dataset, from a Czech bank in the 1990s. It has transactions and loan outcomes, nothing else. A model that also weighed ID, bureau or payroll data would need data joining all of those to repayment. We don't have it, so a working demo can't use them.

**2. No bank API, so nothing is verified.** A bank connection is what would prove a statement is real. We can't get one for real applicants, which makes this a technical limitation:

- Under Canada's open banking framework, only providers accredited by the Bank of Canada can access account data, and accreditation includes a national security screen.
- Plaid's free trial stops at 10 live accounts. Beyond that, a company needs a paid plan and a production review.
- A sandbox only returns test data, so it can't validate anything.

Without verified data the app makes no suggestion. A reviewer decides every application and has to write why.

## What "working" means

1. A valid CSV turns into facts within seconds. It needs Date and Amount columns; Description and Balance are optional. Each fact names the rows behind it and is labelled "not verified".
2. A bad file gets a plain reason, with the row number when one row is the problem.
3. Submitting seals the evidence with a sha256 hash over the facts.
4. The reviewer sees the facts by category, the statement rows, what the statement can't show, and the model's score or why there isn't one.
5. The backend refuses a decision without a written reason, allows one decision per application, and never edits a decision.
6. The applicant's page shows the outcome within 3 seconds of the decision, and never shows the score.

50 backend tests and 5 frontend tests cover this, including the whole flow over HTTP.

## Known constraints and accepted limitations

- **Uploads can be edited.** Every fact is labelled not verified, and the reviewer is told so.
- **The model doesn't transfer.**
  - It learned from 233 finished Czech loans, 30 of them not repaid.
  - On loans it hadn't seen, it ranked a defaulter above a repayer 76% of the time. The real figure could be anywhere from 58% to 91%.
  - It reads dollars as koruna, and Canadian statements have 3 to 4 times more transactions than its training data. On our sample statements it rates the tightest one as the safest.
  - Reviewers see it labelled experimental. Applicants never see it.
- **The score needs a full statement:** a Balance column, and transactions in each of the last six 30-day periods.
- **Dates must be YYYY-MM-DD.** Real bank exports use other formats.
- **No persistence.** Data is in memory and resets on restart.
- **No sign-in.** Anyone with an application's link can see its outcome.
- **Pricing is a placeholder:** 24.9% APR from config, checked against Canada's 35% cap.
- **Follow-ups are only recorded.** "Accept offer" and "Ask a person to review" save the request; nothing acts on it yet.

Sources: [Finance Canada, consumer-driven banking framework](https://www.canada.ca/en/department-finance/programs/financial-sector-policy/open-banking-implementation/budget-2025-canadas-framework-for-consumer-driven-banking.html) · [Plaid pricing and Trial plan](https://plaid.com/docs/account/billing/)
