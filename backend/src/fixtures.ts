// All sample data for the temporary backend, in one place.
//
// Every person, amount, date and record below is invented (docs/HANDOFF.md
// section 8). Bracketed names such as [Employer] are placeholders kept from the
// prototype. Timestamps are UTC; the prototype's times are Toronto evening times.
//
// Hashes are not stored here: the store seals each record at startup from its
// items. Suggestion pricing is not stored here either: the store applies
// backend/config/product.json, because pricing is config, not model output.

import type {
  Application,
  Decision,
  EvidenceRecord,
  Reviewer,
  Suggestion,
} from './contract.ts';

export type EvidenceRecordFixture = Omit<EvidenceRecord, 'sha256'>;
export type SuggestionFixture = Pick<
  Suggestion,
  'applicationId' | 'outcome' | 'reasons' | 'modelVersion' | 'modelValidatedAt'
>;

export const reviewers: Reviewer[] = [
  { id: 'rv-001', name: 'Sample Reviewer', initials: 'RV' },
  { id: 'rv-002', name: 'Second Reviewer', initials: 'SR' },
];

// Stands in for the signed-in user until auth exists (build order step 6).
export const currentReviewerId = 'rv-001';

export const applications: Application[] = [
  {
    id: '4821',
    applicant: { legalName: 'Jordan Lee', email: 'jordan.lee@example.com', phone: '(416) 555-0148' },
    requestedAmount: 4000,
    status: 'ready',
    dataStatus: 'bank_connected',
    submittedAt: '2026-10-21T00:21:00Z',
    flags: [
      { code: 'no_bureau_file', evidenceItemId: 'ev-4821-bureau' },
      { code: 'bank_connected', evidenceItemId: 'ev-4821-holder' },
    ],
    evidenceRecordId: 'ER-4821',
  },
  {
    id: '4819',
    applicant: { legalName: 'Alex Moreau', email: 'alex.moreau@example.com', phone: '(416) 555-0193' },
    requestedAmount: 2000,
    status: 'waiting',
    dataStatus: 'payroll_pending',
    submittedAt: '2026-10-20T22:05:00Z',
    flags: [],
  },
  {
    id: '4817',
    applicant: { legalName: 'Taylor Brooks', email: 'taylor.brooks@example.com', phone: '(647) 555-0127' },
    requestedAmount: 6000,
    status: 'ready',
    dataStatus: 'bank_connected',
    submittedAt: '2026-10-20T21:40:00Z',
    flags: [{ code: 'bank_connected', evidenceItemId: 'ev-4817-holder' }],
    evidenceRecordId: 'ER-4817',
  },
  {
    id: '4815',
    applicant: { legalName: 'Chris Nguyen', email: 'chris.nguyen@example.com', phone: '(905) 555-0164' },
    requestedAmount: 1000,
    status: 'unverifiable',
    dataStatus: 'uploads_only',
    submittedAt: '2026-10-20T18:10:00Z',
    flags: [],
    evidenceRecordId: 'ER-4815',
  },
  {
    id: '4812',
    applicant: { legalName: 'Morgan Diaz', email: 'morgan.diaz@example.com', phone: '(416) 555-0175' },
    requestedAmount: 3000,
    status: 'decided',
    dataStatus: 'bank_connected',
    submittedAt: '2026-10-19T15:02:00Z',
    flags: [{ code: 'bank_connected', evidenceItemId: 'ev-4812-holder' }],
    evidenceRecordId: 'ER-4812',
  },
];

export const evidenceRecords: EvidenceRecordFixture[] = [
  {
    id: 'ER-4821',
    applicationId: '4821',
    sealedAt: '2026-10-21T00:21:00Z',
    items: [
      {
        id: 'ev-4821-holder',
        category: 'identity',
        statement: 'Name, address and phone match the bank account holder',
        sourceType: 'bank_api',
        sourceRef: 'conn-7f3a2c',
        sourceDetail: 'Account holder record',
        retrievedAt: '2026-10-21T00:16:00Z',
        verified: true,
        records: [
          {
            date: '2026-10-21T00:16:00Z',
            description: 'Account holder name, address, phone',
            value: { kind: 'outcome', outcome: 'match' },
          },
        ],
      },
      {
        id: 'ev-4821-idv',
        category: 'identity',
        statement: 'Government ID matched to a live selfie',
        sourceType: 'id_check',
        sourceRef: 'idv-52d18e',
        sourceDetail: '[ID vendor] document and selfie check',
        retrievedAt: '2026-10-21T00:12:00Z',
        verified: true,
        records: [
          {
            date: '2026-10-21T00:12:00Z',
            description: 'ID document matched to selfie',
            value: { kind: 'outcome', outcome: 'match' },
          },
        ],
      },
      {
        id: 'ev-4821-bureau',
        category: 'identity',
        statement: 'No Canadian credit bureau file found',
        sourceType: 'bureau',
        sourceRef: 'bq-90c4e1',
        sourceDetail: '[Bureau] file search',
        retrievedAt: '2026-10-21T00:14:00Z',
        verified: true,
        records: [
          {
            date: '2026-10-21T00:14:00Z',
            description: 'Credit file search by name and address',
            value: { kind: 'outcome', outcome: 'not_found' },
          },
        ],
      },
      {
        id: 'ev-4821-pay',
        category: 'capacity',
        statement: '$4,120 net pay in a typical month, every 2 weeks from one employer',
        sourceType: 'bank_api',
        sourceRef: 'conn-7f3a2c',
        sourceDetail: '24 payroll deposits, Nov 2025 to Oct 2026',
        retrievedAt: '2026-10-21T00:16:00Z',
        verified: true,
        records: [
          { date: '2026-10-16', description: 'Payroll deposit · [Employer]', value: { kind: 'money', amount: 2060 } },
          { date: '2026-10-02', description: 'Payroll deposit · [Employer]', value: { kind: 'money', amount: 2060 } },
          { date: '2026-09-18', description: 'Payroll deposit · [Employer]', value: { kind: 'money', amount: 2060 } },
        ],
      },
      {
        id: 'ev-4821-short',
        category: 'capacity',
        statement: 'One short month: March pay was $3,300',
        sourceType: 'bank_api',
        sourceRef: 'conn-7f3a2c',
        sourceDetail: 'Payroll deposit of Mar 27, 2026',
        retrievedAt: '2026-10-21T00:16:00Z',
        verified: true,
        records: [
          {
            date: '2026-03-27',
            description: 'Payroll deposit · [Employer] · short',
            value: { kind: 'money', amount: 1240 },
          },
        ],
      },
      {
        id: 'ev-4821-leftover',
        category: 'capacity',
        statement: '$820 a month left over after bills and spending, on average',
        sourceType: 'derived',
        sourceRef: 'calc-cashflow-4821',
        sourceDetail: 'Computed from 12 months of transactions',
        retrievedAt: '2026-10-21T00:17:00Z',
        verified: true,
        derivedFrom: ['ev-4821-pay', 'ev-4821-short', 'ev-4821-rent', 'ev-4821-bills'],
        records: [],
      },
      {
        id: 'ev-4821-rent',
        category: 'willingness',
        statement: 'Rent of $1,650 paid on time 12 of 12 months',
        sourceType: 'bank_api',
        sourceRef: 'conn-7f3a2c',
        sourceDetail: '12 e-Transfers to the same recipient',
        retrievedAt: '2026-10-21T00:16:00Z',
        verified: true,
        records: [
          { date: '2026-10-01', description: 'e-Transfer · rent · [Landlord]', value: { kind: 'money', amount: 1650 } },
          { date: '2026-09-01', description: 'e-Transfer · rent · [Landlord]', value: { kind: 'money', amount: 1650 } },
          { date: '2026-08-01', description: 'e-Transfer · rent · [Landlord]', value: { kind: 'money', amount: 1650 } },
          { date: '2026-07-02', description: 'e-Transfer · rent · [Landlord]', value: { kind: 'money', amount: 1650 } },
        ],
      },
      {
        id: 'ev-4821-bills',
        category: 'willingness',
        statement: 'Phone and hydro paid on time 12 of 12 months',
        sourceType: 'bank_api',
        sourceRef: 'conn-7f3a2c',
        sourceDetail: 'Recurring bill payments',
        retrievedAt: '2026-10-21T00:16:00Z',
        verified: true,
        records: [],
      },
      {
        id: 'ev-4821-overdraft',
        category: 'willingness',
        statement: 'No overdrafts or returned payments in 12 months',
        sourceType: 'bank_api',
        sourceRef: 'conn-7f3a2c',
        sourceDetail: 'Balance history',
        retrievedAt: '2026-10-21T00:16:00Z',
        verified: true,
        records: [],
      },
      {
        id: 'ev-4821-savings',
        category: 'resilience',
        statement: '$4,620 in savings, about 1.4 months of expenses',
        sourceType: 'bank_api',
        sourceRef: 'conn-7f3a2c',
        sourceDetail: 'Savings account balance',
        retrievedAt: '2026-10-21T00:16:00Z',
        verified: true,
        records: [
          { date: '2026-10-20', description: 'Savings account balance', value: { kind: 'money', amount: 4620 } },
        ],
      },
      {
        id: 'ev-4821-low',
        category: 'resilience',
        statement: 'Lowest chequing balance in 12 months was $310, in March',
        sourceType: 'bank_api',
        sourceRef: 'conn-7f3a2c',
        sourceDetail: 'Balance history',
        retrievedAt: '2026-10-21T00:16:00Z',
        verified: true,
        records: [
          { date: '2026-03-27', description: 'Lowest chequing balance', value: { kind: 'money', amount: 310 } },
        ],
      },
      {
        id: 'ev-4821-upload',
        category: 'capacity',
        statement: 'Employment letter.pdf says $54,000 a year',
        sourceType: 'upload',
        sourceRef: 'upload-3b9d01',
        sourceDetail: 'Employment letter.pdf, uploaded by applicant',
        retrievedAt: '2026-10-21T00:19:00Z',
        verified: false,
        records: [],
      },
    ],
    blindSpots: [
      {
        title: 'Debts or accounts at other banks',
        note: 'We only see the bank they connected. Ask about other loans or cards.',
      },
      {
        title: 'No Canadian credit bureau file to cross-check',
        note: 'Nothing to confirm there are no other obligations.',
      },
      {
        title: 'Cash income, if any',
        note: 'Would make the picture better, not worse, but we can’t count it.',
      },
    ],
  },
  {
    id: 'ER-4817',
    applicationId: '4817',
    sealedAt: '2026-10-20T21:40:00Z',
    items: [
      {
        id: 'ev-4817-holder',
        category: 'identity',
        statement: 'Name, address and phone match the bank account holder',
        sourceType: 'bank_api',
        sourceRef: 'conn-2b81d4',
        sourceDetail: 'Account holder record',
        retrievedAt: '2026-10-20T21:36:00Z',
        verified: true,
        records: [
          {
            date: '2026-10-20T21:36:00Z',
            description: 'Account holder name, address, phone',
            value: { kind: 'outcome', outcome: 'match' },
          },
        ],
      },
      {
        id: 'ev-4817-idv',
        category: 'identity',
        statement: 'Government ID matched to a live selfie',
        sourceType: 'id_check',
        sourceRef: 'idv-7c4f20',
        sourceDetail: '[ID vendor] document and selfie check',
        retrievedAt: '2026-10-20T21:31:00Z',
        verified: true,
        records: [
          {
            date: '2026-10-20T21:31:00Z',
            description: 'ID document matched to selfie',
            value: { kind: 'outcome', outcome: 'match' },
          },
        ],
      },
      {
        id: 'ev-4817-pay',
        category: 'capacity',
        statement: '$5,480 net pay in a typical month, twice a month from one employer',
        sourceType: 'bank_api',
        sourceRef: 'conn-2b81d4',
        sourceDetail: '24 payroll deposits, Nov 2025 to Oct 2026',
        retrievedAt: '2026-10-20T21:36:00Z',
        verified: true,
        records: [
          { date: '2026-10-15', description: 'Payroll deposit · [Employer]', value: { kind: 'money', amount: 2740 } },
          { date: '2026-09-30', description: 'Payroll deposit · [Employer]', value: { kind: 'money', amount: 2740 } },
          { date: '2026-09-15', description: 'Payroll deposit · [Employer]', value: { kind: 'money', amount: 2740 } },
        ],
      },
      {
        id: 'ev-4817-leftover',
        category: 'capacity',
        statement: '$1,150 a month left over after bills and spending, on average',
        sourceType: 'derived',
        sourceRef: 'calc-cashflow-4817',
        sourceDetail: 'Computed from 12 months of transactions',
        retrievedAt: '2026-10-20T21:37:00Z',
        verified: true,
        derivedFrom: ['ev-4817-pay', 'ev-4817-rent', 'ev-4817-car'],
        records: [],
      },
      {
        id: 'ev-4817-rent',
        category: 'willingness',
        statement: 'Rent of $1,900 paid on time 12 of 12 months',
        sourceType: 'bank_api',
        sourceRef: 'conn-2b81d4',
        sourceDetail: '12 pre-authorized payments to the same recipient',
        retrievedAt: '2026-10-20T21:36:00Z',
        verified: true,
        records: [
          { date: '2026-10-01', description: 'Pre-authorized debit · rent · [Landlord]', value: { kind: 'money', amount: 1900 } },
          { date: '2026-09-01', description: 'Pre-authorized debit · rent · [Landlord]', value: { kind: 'money', amount: 1900 } },
        ],
      },
      {
        id: 'ev-4817-car',
        category: 'willingness',
        statement: 'Car loan payment of $420 paid on time 12 of 12 months',
        sourceType: 'bank_api',
        sourceRef: 'conn-2b81d4',
        sourceDetail: 'Recurring loan payments',
        retrievedAt: '2026-10-20T21:36:00Z',
        verified: true,
        records: [
          { date: '2026-10-05', description: 'Loan payment · [Lender]', value: { kind: 'money', amount: 420 } },
          { date: '2026-09-05', description: 'Loan payment · [Lender]', value: { kind: 'money', amount: 420 } },
        ],
      },
      {
        id: 'ev-4817-savings',
        category: 'resilience',
        statement: '$2,100 in savings, about 0.6 months of expenses',
        sourceType: 'bank_api',
        sourceRef: 'conn-2b81d4',
        sourceDetail: 'Savings account balance',
        retrievedAt: '2026-10-20T21:36:00Z',
        verified: true,
        records: [
          { date: '2026-10-20', description: 'Savings account balance', value: { kind: 'money', amount: 2100 } },
        ],
      },
    ],
    blindSpots: [
      {
        title: 'Debts or accounts at other banks',
        note: 'We only see the bank they connected. Ask about other loans or cards.',
      },
      {
        title: 'What is still owed on the car loan',
        note: 'Payments are visible; the remaining balance isn’t.',
      },
    ],
  },
  {
    id: 'ER-4815',
    applicationId: '4815',
    sealedAt: '2026-10-20T18:10:00Z',
    items: [
      {
        id: 'ev-4815-statements',
        category: 'capacity',
        statement: 'Bank statements.pdf shows 3 months of deposits from one employer',
        sourceType: 'upload',
        sourceRef: 'upload-1f6e3a',
        sourceDetail: 'Bank statements.pdf, uploaded by applicant',
        retrievedAt: '2026-10-20T18:04:00Z',
        verified: false,
        records: [],
      },
      {
        id: 'ev-4815-paystub',
        category: 'capacity',
        statement: 'Pay stub.pdf shows $1,850 net pay for 2 weeks',
        sourceType: 'upload',
        sourceRef: 'upload-1f6e3b',
        sourceDetail: 'Pay stub.pdf, uploaded by applicant',
        retrievedAt: '2026-10-20T18:06:00Z',
        verified: false,
        records: [],
      },
    ],
    blindSpots: [
      {
        title: 'Whether this person is who they say they are',
        note: 'No ID check or bank account holder match yet.',
      },
      {
        title: 'Income, bills and balances at the source',
        note: 'The uploads can’t be traced to a bank or employer.',
      },
    ],
  },
  {
    id: 'ER-4812',
    applicationId: '4812',
    sealedAt: '2026-10-19T15:02:00Z',
    items: [
      {
        id: 'ev-4812-holder',
        category: 'identity',
        statement: 'Name, address and phone match the bank account holder',
        sourceType: 'bank_api',
        sourceRef: 'conn-4e09ab',
        sourceDetail: 'Account holder record',
        retrievedAt: '2026-10-19T14:58:00Z',
        verified: true,
        records: [
          {
            date: '2026-10-19T14:58:00Z',
            description: 'Account holder name, address, phone',
            value: { kind: 'outcome', outcome: 'match' },
          },
        ],
      },
      {
        id: 'ev-4812-idv',
        category: 'identity',
        statement: 'Government ID matched to a live selfie',
        sourceType: 'id_check',
        sourceRef: 'idv-3a7d91',
        sourceDetail: '[ID vendor] document and selfie check',
        retrievedAt: '2026-10-19T14:55:00Z',
        verified: true,
        records: [
          {
            date: '2026-10-19T14:55:00Z',
            description: 'ID document matched to selfie',
            value: { kind: 'outcome', outcome: 'match' },
          },
        ],
      },
      {
        id: 'ev-4812-pay',
        category: 'capacity',
        statement: '$3,900 net pay in a typical month, every 2 weeks from one employer',
        sourceType: 'bank_api',
        sourceRef: 'conn-4e09ab',
        sourceDetail: '26 payroll deposits, Oct 2025 to Oct 2026',
        retrievedAt: '2026-10-19T14:58:00Z',
        verified: true,
        records: [
          { date: '2026-10-09', description: 'Payroll deposit · [Employer]', value: { kind: 'money', amount: 1950 } },
          { date: '2026-09-25', description: 'Payroll deposit · [Employer]', value: { kind: 'money', amount: 1950 } },
        ],
      },
      {
        id: 'ev-4812-rent',
        category: 'willingness',
        statement: 'Rent of $1,400 paid on time 12 of 12 months',
        sourceType: 'bank_api',
        sourceRef: 'conn-4e09ab',
        sourceDetail: '12 e-Transfers to the same recipient',
        retrievedAt: '2026-10-19T14:58:00Z',
        verified: true,
        records: [
          { date: '2026-10-01', description: 'e-Transfer · rent · [Landlord]', value: { kind: 'money', amount: 1400 } },
        ],
      },
      {
        id: 'ev-4812-savings',
        category: 'resilience',
        statement: '$3,200 in savings, about 1.2 months of expenses',
        sourceType: 'bank_api',
        sourceRef: 'conn-4e09ab',
        sourceDetail: 'Savings account balance',
        retrievedAt: '2026-10-19T14:58:00Z',
        verified: true,
        records: [
          { date: '2026-10-19', description: 'Savings account balance', value: { kind: 'money', amount: 3200 } },
        ],
      },
    ],
    blindSpots: [
      {
        title: 'Debts or accounts at other banks',
        note: 'We only see the bank they connected. Ask about other loans or cards.',
      },
      {
        title: 'Cash income, if any',
        note: 'Would make the picture better, not worse, but we can’t count it.',
      },
    ],
  },
];

// Stand-in for model output. Reasons use the applicant-facing wording, because
// the reviewer screen promises "these are the reasons the applicant sees".
export const suggestions: SuggestionFixture[] = [
  {
    applicationId: '4821',
    outcome: 'approve',
    reasons: [
      { direction: 'helps', text: 'Your pay arrived every two weeks for 11 of 12 months.' },
      { direction: 'helps', text: 'You paid rent on time 12 of 12 months.' },
      {
        direction: 'hurts',
        text: 'Your savings cover about 1.4 months of expenses, so we’re starting smaller.',
      },
    ],
    modelVersion: '[version]',
    modelValidatedAt: null,
  },
  {
    applicationId: '4819',
    outcome: 'none',
    reasons: [],
    modelVersion: '[version]',
    modelValidatedAt: null,
  },
  {
    applicationId: '4817',
    outcome: 'approve',
    reasons: [
      { direction: 'helps', text: 'Your pay arrived twice a month for 12 of 12 months.' },
      { direction: 'helps', text: 'You paid rent and your car loan on time 12 of 12 months.' },
      {
        direction: 'hurts',
        text: 'Your savings cover less than a month of expenses, so we’re starting smaller.',
      },
    ],
    modelVersion: '[version]',
    modelValidatedAt: null,
  },
  {
    applicationId: '4815',
    outcome: 'none',
    reasons: [],
    modelVersion: '[version]',
    modelValidatedAt: null,
  },
  {
    applicationId: '4812',
    outcome: 'approve',
    reasons: [
      { direction: 'helps', text: 'Your pay arrived every two weeks for 12 of 12 months.' },
      { direction: 'helps', text: 'You paid rent on time 12 of 12 months.' },
      {
        direction: 'hurts',
        text: 'Your savings cover about 1.2 months of expenses, which limits how much we can lend for now.',
      },
    ],
    modelVersion: '[version]',
    modelValidatedAt: null,
  },
];

// Append-only log. Corrections are new entries, never edits.
export const decisions: Decision[] = [
  {
    applicationId: '4812',
    evidenceRecordId: 'ER-4812',
    outcome: 'approved',
    amount: 3000,
    followedSuggestion: true,
    reviewerId: 'rv-002',
    decidedAt: '2026-10-19T19:30:00Z',
  },
];
