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
  Applicant,
  Application,
  BlindSpot,
  Decision,
  EvidenceCategory,
  EvidenceRecord,
  Figure,
  Institution,
  Reviewer,
  SourceRecord,
  Suggestion,
} from './contract.ts';

export type EvidenceRecordFixture = Omit<EvidenceRecord, 'sha256'>;
export type SuggestionFixture = Pick<
  Suggestion,
  'applicationId' | 'outcome' | 'reasons' | 'whatWouldChange' | 'modelVersion' | 'modelValidatedAt'
>;
// Offers are priced from config when the store loads, so only the amount is stored.
export type DecisionFixture = Omit<Decision, 'offer'> & { amount?: number };

// A sample bank-data profile: what a new connection "reads" while the backend
// serves fixtures. Keys become item ids; derivedFrom refers to keys.
export interface ProfileItem {
  key: string;
  category: EvidenceCategory;
  statement: string;
  sourceType: 'bank_api' | 'derived';
  sourceDetail: string;
  derivedFrom?: string[];
  figure?: Figure;
  records: SourceRecord[];
}

export interface SampleProfile {
  id: string;
  label: string;
  items: ProfileItem[];
  blindSpots: BlindSpot[];
  suggestion: Omit<SuggestionFixture, 'applicationId'>;
}

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
    sourceRequests: [],
    borrowerRequests: [],
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
    sourceRequests: [],
    borrowerRequests: [],
  },
  {
    id: '4817',
    applicant: { legalName: 'Taylor Brooks', email: 'taylor.brooks@example.com', phone: '(647) 555-0127' },
    requestedAmount: 6000,
    status: 'ready',
    dataStatus: 'bank_connected',
    submittedAt: '2026-10-20T21:40:00Z',
    flags: [{ code: 'bank_connected', evidenceItemId: 'ev-4817-holder' }],
    sourceRequests: [],
    borrowerRequests: [],
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
    sourceRequests: [],
    borrowerRequests: [],
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
    sourceRequests: [],
    borrowerRequests: [],
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
        figure: { name: 'monthly_net_pay', value: 4120, note: 'Every 2 weeks from one employer. One short month in March.' },
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
        figure: { name: 'monthly_left_over', value: 820, note: 'Average, after bills and spending' },
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
        figure: { name: 'monthly_rent', value: 1650, note: 'Paid on time 12 of 12 months' },
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
        statement: 'Phone, hydro, insurance and transit, about $410 a month, paid on time 12 of 12 months',
        sourceType: 'bank_api',
        sourceRef: 'conn-7f3a2c',
        sourceDetail: 'Recurring bill payments',
        retrievedAt: '2026-10-21T00:16:00Z',
        verified: true,
        figure: { name: 'monthly_other_bills', value: 410, note: 'Phone, hydro, insurance, transit' },
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
        figure: { name: 'overdrafts_12m', value: 0, note: 'In the last 12 months' },
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
        figure: { name: 'savings', value: 4620, note: 'About 1.4 months of expenses' },
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
        sourceDetail: 'PDF document',
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
        figure: { name: 'monthly_net_pay', value: 5480, note: 'Twice a month from one employer' },
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
        figure: { name: 'monthly_left_over', value: 1150, note: 'Average, after bills and spending' },
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
        figure: { name: 'monthly_rent', value: 1900, note: 'Paid on time 12 of 12 months' },
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
        figure: { name: 'savings', value: 2100, note: 'About 0.6 months of expenses' },
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
        sourceDetail: 'PDF document',
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
        sourceDetail: 'PDF document',
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
        figure: { name: 'monthly_net_pay', value: 3900, note: 'Every 2 weeks from one employer' },
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
        figure: { name: 'monthly_rent', value: 1400, note: 'Paid on time 12 of 12 months' },
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
        figure: { name: 'savings', value: 3200, note: 'About 1.2 months of expenses' },
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
    whatWouldChange: [],
    modelVersion: '[version]',
    modelValidatedAt: null,
  },
  {
    applicationId: '4819',
    outcome: 'none',
    reasons: [],
    whatWouldChange: [],
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
    whatWouldChange: [],
    modelVersion: '[version]',
    modelValidatedAt: null,
  },
  {
    applicationId: '4815',
    outcome: 'none',
    reasons: [],
    whatWouldChange: [],
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
    whatWouldChange: [],
    modelVersion: '[version]',
    modelValidatedAt: null,
  },
];

// Append-only log. Corrections are new entries, never edits.
export const decisions: DecisionFixture[] = [
  {
    id: 'D-4812-1',
    applicationId: '4812',
    evidenceRecordId: 'ER-4812',
    outcome: 'approved',
    amount: 3000,
    followedSuggestion: true,
    reviewerId: 'rv-002',
    decidedAt: '2026-10-19T19:30:00Z',
  },
];

// ---- Borrower flow sample data ---------------------------------------------

// Text-only sample list (docs/HANDOFF.md section 8). Show only institutions the
// chosen data provider actually supports.
export const institutions: Institution[] = [
  { id: 'rbc', name: 'RBC Royal Bank', kind: 'bank' },
  { id: 'td', name: 'TD Canada Trust', kind: 'bank' },
  { id: 'scotiabank', name: 'Scotiabank', kind: 'bank' },
  { id: 'bmo', name: 'BMO', kind: 'bank' },
  { id: 'cibc', name: 'CIBC', kind: 'bank' },
  { id: 'desjardins', name: 'Desjardins', kind: 'bank' },
  { id: 'tangerine', name: 'Tangerine', kind: 'bank' },
  { id: 'national', name: 'National Bank', kind: 'bank' },
  { id: 'other', name: 'Another bank or credit union', kind: 'other' },
];

// Prefills the borrower form in sample mode so a demo takes seconds.
export const sampleApplicant: Applicant = {
  legalName: 'Sam Rivera',
  email: 'sam.rivera@example.com',
  phone: '(416) 555-0110',
};

// Stands in for the time a real data provider takes to read 12 months.
export const sampleConnectionDelayMs = 2400;

const commonBlindSpots: BlindSpot[] = [
  {
    title: 'Debts or accounts at other banks',
    note: 'We only see the bank they connected. Ask about other loans or cards.',
  },
  {
    title: 'No government ID check yet',
    note: 'Identity rests on the bank account holder match. The ID vendor isn’t chosen yet.',
  },
  {
    title: 'No credit bureau cross-check',
    note: 'Nothing to confirm there are no other obligations.',
  },
  {
    title: 'Cash income, if any',
    note: 'Would make the picture better, not worse, but we can’t count it.',
  },
];

const holder: ProfileItem = {
  key: 'holder',
  category: 'identity',
  statement: 'Name, address and phone match the bank account holder',
  sourceType: 'bank_api',
  sourceDetail: 'Account holder record',
  records: [],
};

export const sampleProfiles: SampleProfile[] = [
  {
    id: 'steady',
    label: 'Steady pay, bills on time',
    items: [
      holder,
      {
        key: 'pay',
        category: 'capacity',
        statement: '$4,120 net pay in a typical month, every 2 weeks from one employer',
        sourceType: 'bank_api',
        sourceDetail: '24 payroll deposits, Nov 2025 to Oct 2026',
        figure: { name: 'monthly_net_pay', value: 4120, note: 'Every 2 weeks from one employer. One short month in March.' },
        records: [
          { date: '2026-10-16', description: 'Payroll deposit · [Employer]', value: { kind: 'money', amount: 2060 } },
          { date: '2026-10-02', description: 'Payroll deposit · [Employer]', value: { kind: 'money', amount: 2060 } },
          { date: '2026-09-18', description: 'Payroll deposit · [Employer]', value: { kind: 'money', amount: 2060 } },
        ],
      },
      {
        key: 'short',
        category: 'capacity',
        statement: 'One short month: March pay was $3,300',
        sourceType: 'bank_api',
        sourceDetail: 'Payroll deposit of Mar 27, 2026',
        records: [
          { date: '2026-03-27', description: 'Payroll deposit · [Employer] · short', value: { kind: 'money', amount: 1240 } },
        ],
      },
      {
        key: 'leftover',
        category: 'capacity',
        statement: '$820 a month left over after bills and spending, on average',
        sourceType: 'derived',
        sourceDetail: 'Computed from 12 months of transactions',
        derivedFrom: ['pay', 'short', 'rent', 'bills'],
        figure: { name: 'monthly_left_over', value: 820, note: 'Average, after bills and spending' },
        records: [],
      },
      {
        key: 'rent',
        category: 'willingness',
        statement: 'Rent of $1,650 paid on time 12 of 12 months',
        sourceType: 'bank_api',
        sourceDetail: '12 e-Transfers to the same recipient',
        figure: { name: 'monthly_rent', value: 1650, note: 'Paid on time 12 of 12 months' },
        records: [
          { date: '2026-10-01', description: 'e-Transfer · rent · [Landlord]', value: { kind: 'money', amount: 1650 } },
          { date: '2026-09-01', description: 'e-Transfer · rent · [Landlord]', value: { kind: 'money', amount: 1650 } },
          { date: '2026-08-01', description: 'e-Transfer · rent · [Landlord]', value: { kind: 'money', amount: 1650 } },
          { date: '2026-07-02', description: 'e-Transfer · rent · [Landlord]', value: { kind: 'money', amount: 1650 } },
        ],
      },
      {
        key: 'bills',
        category: 'willingness',
        statement: 'Phone, hydro, insurance and transit, about $410 a month, paid on time 12 of 12 months',
        sourceType: 'bank_api',
        sourceDetail: 'Recurring bill payments',
        figure: { name: 'monthly_other_bills', value: 410, note: 'Phone, hydro, insurance, transit' },
        records: [
          { date: '2026-10-08', description: 'Bill payment · [Phone carrier]', value: { kind: 'money', amount: 85 } },
          { date: '2026-10-05', description: 'Bill payment · [Hydro]', value: { kind: 'money', amount: 96 } },
          { date: '2026-10-01', description: 'Pre-authorized debit · [Insurer]', value: { kind: 'money', amount: 73 } },
          { date: '2026-10-01', description: 'Transit pass · [Transit agency]', value: { kind: 'money', amount: 156 } },
        ],
      },
      {
        key: 'overdraft',
        category: 'willingness',
        statement: 'No overdrafts or returned payments in 12 months',
        sourceType: 'bank_api',
        sourceDetail: 'Balance history',
        figure: { name: 'overdrafts_12m', value: 0, note: 'In the last 12 months' },
        records: [],
      },
      {
        key: 'savings',
        category: 'resilience',
        statement: '$4,620 in savings, about 1.4 months of expenses',
        sourceType: 'bank_api',
        sourceDetail: 'Savings account balance',
        figure: { name: 'savings', value: 4620, note: 'About 1.4 months of expenses' },
        records: [{ date: '2026-10-20', description: 'Savings account balance', value: { kind: 'money', amount: 4620 } }],
      },
      {
        key: 'low',
        category: 'resilience',
        statement: 'Lowest chequing balance in 12 months was $310, in March',
        sourceType: 'bank_api',
        sourceDetail: 'Balance history',
        records: [{ date: '2026-03-27', description: 'Lowest chequing balance', value: { kind: 'money', amount: 310 } }],
      },
    ],
    blindSpots: commonBlindSpots,
    suggestion: {
      outcome: 'approve',
      reasons: [
        { direction: 'helps', text: 'Your pay arrived every two weeks for 11 of 12 months.' },
        { direction: 'helps', text: 'You paid rent on time 12 of 12 months.' },
        { direction: 'hurts', text: 'Your savings cover about 1.4 months of expenses, so we’re starting smaller.' },
      ],
      whatWouldChange: [],
      modelVersion: '[version]',
      modelValidatedAt: null,
    },
  },
  {
    id: 'stretched',
    label: 'Irregular pay, money tight',
    items: [
      holder,
      {
        key: 'pay',
        category: 'capacity',
        statement: '$2,980 net pay in a typical month, varying a lot; the lowest month was $1,400',
        sourceType: 'bank_api',
        sourceDetail: '31 payroll and platform deposits, Nov 2025 to Oct 2026',
        figure: { name: 'monthly_net_pay', value: 2980, note: 'Varies a lot. Lowest month was $1,400.' },
        records: [
          { date: '2026-10-14', description: 'Payroll deposit · [Employer]', value: { kind: 'money', amount: 1180 } },
          { date: '2026-10-03', description: 'Deposit · [Delivery platform]', value: { kind: 'money', amount: 640 } },
          { date: '2026-09-30', description: 'Payroll deposit · [Employer]', value: { kind: 'money', amount: 1120 } },
          { date: '2026-06-30', description: 'Payroll deposit · [Employer] · lowest month', value: { kind: 'money', amount: 700 } },
        ],
      },
      {
        key: 'leftover',
        category: 'capacity',
        statement: 'About $90 more went out than came in each month, on average',
        sourceType: 'derived',
        sourceDetail: 'Computed from 12 months of transactions',
        derivedFrom: ['pay', 'rent', 'bills'],
        figure: { name: 'monthly_left_over', value: -90, note: 'Average, after bills and spending' },
        records: [],
      },
      {
        key: 'rent',
        category: 'willingness',
        statement: 'Rent of $1,650 paid late 4 of 12 months',
        sourceType: 'bank_api',
        sourceDetail: '12 e-Transfers to the same recipient',
        figure: { name: 'monthly_rent', value: 1650, note: 'Paid late 4 of 12 months' },
        records: [
          { date: '2026-10-06', description: 'e-Transfer · rent · [Landlord] · 5 days late', value: { kind: 'money', amount: 1650 } },
          { date: '2026-09-01', description: 'e-Transfer · rent · [Landlord]', value: { kind: 'money', amount: 1650 } },
          { date: '2026-08-09', description: 'e-Transfer · rent · [Landlord] · 8 days late', value: { kind: 'money', amount: 1650 } },
        ],
      },
      {
        key: 'bills',
        category: 'willingness',
        statement: 'Phone, hydro, insurance and transit, about $520 a month',
        sourceType: 'bank_api',
        sourceDetail: 'Recurring bill payments',
        figure: { name: 'monthly_other_bills', value: 520, note: 'Phone, hydro, insurance, transit' },
        records: [],
      },
      {
        key: 'overdraft',
        category: 'willingness',
        statement: 'Account went into overdraft 5 times in 12 months',
        sourceType: 'bank_api',
        sourceDetail: 'Balance history',
        figure: { name: 'overdrafts_12m', value: 5, note: 'In the last 12 months' },
        records: [
          { date: '2026-10-02', description: 'Chequing balance after overdraft', value: { kind: 'money', amount: -45.2 } },
          { date: '2026-08-04', description: 'Chequing balance after overdraft', value: { kind: 'money', amount: -112.6 } },
        ],
      },
      {
        key: 'savings',
        category: 'resilience',
        statement: '$310 in savings, less than a week of expenses',
        sourceType: 'bank_api',
        sourceDetail: 'Savings account balance',
        figure: { name: 'savings', value: 310, note: 'Less than a week of expenses' },
        records: [{ date: '2026-10-20', description: 'Savings account balance', value: { kind: 'money', amount: 310 } }],
      },
    ],
    blindSpots: commonBlindSpots,
    suggestion: {
      outcome: 'decline',
      reasons: [
        { direction: 'hurts', text: 'On average, about $90 more went out than came in each month.' },
        { direction: 'hurts', text: 'Your account went into overdraft 5 times in the last 12 months.' },
        { direction: 'hurts', text: 'Rent was paid late in 4 of the last 12 months.' },
      ],
      whatWouldChange: [
        '3 months in a row with money left over after bills',
        'No overdrafts in that time',
        'Rent paid on time each month',
      ],
      modelVersion: '[version]',
      modelValidatedAt: null,
    },
  },
];
