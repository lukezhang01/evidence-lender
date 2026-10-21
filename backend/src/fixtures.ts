// All sample data for the temporary backend, in one place.
//
// Every person, amount, date and transaction below is invented (docs/HANDOFF.md
// section 8). Bracketed names such as [Employer] are placeholders. Timestamps
// are UTC; the times are Toronto evening times.
//
// Sample statements are generated here as CSV text, deterministically, and the
// store reads them through the same parser as a real upload. So the sample
// applications in the queue were made exactly the way a new one is.

import type { Applicant, Decision, Reviewer } from './contract.ts';

// Offers are priced from config when the store loads, so only the amount is stored.
export type DecisionFixture = Omit<Decision, 'offer'> & { amount?: number };

export const reviewers: Reviewer[] = [
  { id: 'rv-001', name: 'Sample Reviewer', initials: 'RV' },
  { id: 'rv-002', name: 'Second Reviewer', initials: 'SR' },
];

// Stands in for the signed-in user until auth exists.
export const currentReviewerId = 'rv-001';

// An applicant for tests.
export const sampleApplicant: Applicant = {
  legalName: 'Sam Rivera',
  email: 'sam.rivera@example.com',
  phone: '(416) 555-0110',
};

// ---- sample statements -------------------------------------------------------

type Schedule =
  | { every: 'days'; days: number; start: string }
  | { every: 'month'; day: number; lateBy?: number[] }
  | { every: 'semimonthly' } // the 15th and the last day of the month
  | { every: 'random'; perMonth: number };

interface Line {
  description: string;
  amount: number;
  spread?: number; // +/- random variation, in dollars
  schedule: Schedule;
  overrides?: Record<string, number>; // date -> amount
}

interface StatementProfile {
  id: string;
  label: string; // what the statement shows; names its file in samples/
  fileName: string;
  from: string;
  to: string;
  openingBalance: number;
  seed: number;
  moneyIn: Line[];
  moneyOut: Line[];
  overdraftFee?: { description: string; amount: number };
}

const bills = (hydro: number, phone: number, insurance: number, transit: number): Line[] =>
  [
    { description: 'BILL PAYMENT [HYDRO]', amount: hydro, spread: 15, schedule: { every: 'month', day: 5 } } as Line,
    { description: 'BILL PAYMENT [PHONE CARRIER]', amount: phone, schedule: { every: 'month', day: 8 } } as Line,
    { description: 'PREAUTHORIZED DEBIT [INSURER]', amount: insurance, schedule: { every: 'month', day: 1 } } as Line,
    { description: 'TRANSIT PASS [TRANSIT AGENCY]', amount: transit, schedule: { every: 'month', day: 1 } } as Line,
  ].filter((line) => line.amount > 0);

const profiles: StatementProfile[] = [
  {
    id: 'steady',
    label: 'Steady pay, bills on time',
    fileName: 'statement-steady.csv',
    from: '2026-04-21',
    to: '2026-10-20',
    openingBalance: 3200,
    seed: 11,
    moneyIn: [
      {
        description: 'PAYROLL DEPOSIT [EMPLOYER]',
        amount: 2060,
        schedule: { every: 'days', days: 14, start: '2026-04-24' },
        overrides: { '2026-07-17': 1240 },
      },
    ],
    moneyOut: [
      { description: 'E-TRANSFER RENT [LANDLORD]', amount: 1650, schedule: { every: 'month', day: 1 } },
      ...bills(96, 85, 73, 156),
      { description: 'TRANSFER TO SAVINGS', amount: 400, schedule: { every: 'month', day: 26 } },
      { description: 'POS PURCHASE [GROCERY]', amount: 120, spread: 30, schedule: { every: 'days', days: 7, start: '2026-04-25' } },
      { description: 'POS PURCHASE [RESTAURANT]', amount: 28, spread: 14, schedule: { every: 'random', perMonth: 8 } },
      { description: 'ONLINE PURCHASE [RETAILER]', amount: 70, spread: 45, schedule: { every: 'random', perMonth: 2 } },
    ],
  },
  {
    id: 'tight',
    label: 'Irregular pay, money tight',
    fileName: 'statement-tight.csv',
    from: '2026-04-21',
    to: '2026-10-20',
    openingBalance: 1400,
    seed: 23,
    moneyIn: [
      { description: 'PAYROLL DEPOSIT [EMPLOYER]', amount: 1150, spread: 70, schedule: { every: 'days', days: 14, start: '2026-04-30' } },
      { description: 'E-TRANSFER [DELIVERY PLATFORM]', amount: 220, spread: 120, schedule: { every: 'random', perMonth: 2 } },
    ],
    moneyOut: [
      { description: 'E-TRANSFER RENT [LANDLORD]', amount: 1750, schedule: { every: 'month', day: 1, lateBy: [0, 6, 0, 8, 5, 0, 7] } },
      ...bills(118, 95, 145, 160),
      { description: 'POS PURCHASE [GROCERY]', amount: 115, spread: 25, schedule: { every: 'days', days: 7, start: '2026-04-22' } },
      { description: 'POS PURCHASE [RESTAURANT]', amount: 22, spread: 10, schedule: { every: 'random', perMonth: 14 } },
    ],
    overdraftFee: { description: 'OVERDRAFT FEE', amount: 5 },
  },
  {
    id: 'semimonthly',
    label: 'Salary twice a month, car loan',
    fileName: 'statement-2026-10.csv',
    from: '2026-04-21',
    to: '2026-10-20',
    openingBalance: 2100,
    seed: 37,
    moneyIn: [{ description: 'PAYROLL [EMPLOYER]', amount: 2740, schedule: { every: 'semimonthly' } }],
    moneyOut: [
      { description: 'PREAUTHORIZED DEBIT RENT [LANDLORD]', amount: 1900, schedule: { every: 'month', day: 1 } },
      { description: 'LOAN PAYMENT [LENDER]', amount: 420, schedule: { every: 'month', day: 5 } },
      ...bills(104, 90, 168, 0),
      { description: 'POS PURCHASE [GROCERY]', amount: 140, spread: 35, schedule: { every: 'days', days: 7, start: '2026-04-23' } },
      { description: 'POS PURCHASE [RESTAURANT]', amount: 35, spread: 15, schedule: { every: 'random', perMonth: 9 } },
    ],
  },
  {
    id: 'biweekly',
    label: 'Steady pay, smaller rent',
    fileName: 'chequing-export.csv',
    from: '2026-04-18',
    to: '2026-10-17',
    openingBalance: 3200,
    seed: 41,
    moneyIn: [
      { description: 'PAYROLL DEPOSIT [EMPLOYER]', amount: 1950, schedule: { every: 'days', days: 14, start: '2026-04-23' } },
    ],
    moneyOut: [
      { description: 'E-TRANSFER RENT [LANDLORD]', amount: 1400, schedule: { every: 'month', day: 1 } },
      ...bills(88, 75, 62, 156),
      { description: 'POS PURCHASE [GROCERY]', amount: 110, spread: 25, schedule: { every: 'days', days: 7, start: '2026-04-19' } },
      { description: 'POS PURCHASE [RESTAURANT]', amount: 25, spread: 12, schedule: { every: 'random', perMonth: 6 } },
    ],
  },
];

// Deterministic pseudo-random numbers, so the samples are the same every run.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00Z`);
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

function monthsBetween(from: string, to: string) {
  const out: { y: number; m: number }[] = [];
  const end = utc(to).getTime();
  const cursor = utc(from);
  cursor.setUTCDate(1);
  while (cursor.getTime() <= end) {
    out.push({ y: cursor.getUTCFullYear(), m: cursor.getUTCMonth() });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

function datesFor(schedule: Schedule, from: string, to: string, rand: () => number): string[] {
  const inRange = (d: string) => d >= from && d <= to;
  const months = monthsBetween(from, to);
  switch (schedule.every) {
    case 'days': {
      const out: string[] = [];
      for (const d = utc(schedule.start); iso(d) <= to; d.setUTCDate(d.getUTCDate() + schedule.days)) out.push(iso(d));
      return out.filter(inRange);
    }
    case 'month':
      return months
        .map(({ y, m }, i) => iso(new Date(Date.UTC(y, m, Math.min(schedule.day + (schedule.lateBy?.[i] ?? 0), lastDay(y, m))))))
        .filter(inRange);
    case 'semimonthly':
      return months
        .flatMap(({ y, m }) => [iso(new Date(Date.UTC(y, m, 15))), iso(new Date(Date.UTC(y, m, lastDay(y, m))))])
        .filter(inRange);
    case 'random':
      return months
        .flatMap(({ y, m }) =>
          Array.from({ length: schedule.perMonth }, () => iso(new Date(Date.UTC(y, m, 1 + Math.floor(rand() * 28))))),
        )
        .filter(inRange);
  }
}

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const cents = (n: number) => Math.round(n * 100) / 100;

function statementCsv(p: StatementProfile): string {
  const rand = mulberry32(p.seed);
  const txns: { date: string; description: string; amount: number; order: number }[] = [];
  const add = (lines: Line[], sign: 1 | -1) => {
    for (const line of lines) {
      for (const date of datesFor(line.schedule, p.from, p.to, rand)) {
        const base = line.overrides?.[date] ?? line.amount;
        txns.push({
          date,
          description: line.description,
          amount: sign * cents(base + (line.spread ?? 0) * (rand() * 2 - 1)),
          order: sign > 0 ? 0 : 1, // money in before money out on the same day
        });
      }
    }
  };
  add(p.moneyIn, 1);
  add(p.moneyOut, -1);
  txns.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

  const out = ['Date,Description,Amount,Balance'];
  let balance = p.openingBalance;
  let feeCharged = '';
  for (const t of txns) {
    balance = cents(balance + t.amount);
    out.push([t.date, csvCell(t.description), t.amount.toFixed(2), balance.toFixed(2)].join(','));
    if (p.overdraftFee && balance < 0 && t.amount < 0 && feeCharged !== t.date) {
      feeCharged = t.date;
      balance = cents(balance - p.overdraftFee.amount);
      out.push([t.date, p.overdraftFee.description, (-p.overdraftFee.amount).toFixed(2), balance.toFixed(2)].join(','));
    }
  }
  return `${out.join('\n')}\n`;
}

export interface SampleStatement {
  id: string;
  label: string;
  fileName: string;
  csv: string;
}

export const sampleStatements: SampleStatement[] = profiles.map((p) => ({
  id: p.id,
  label: p.label,
  fileName: p.fileName,
  csv: statementCsv(p),
}));

// The same statements as files in samples/ at the repo root, to upload by hand
// when showing the app. The app itself never offers them.
// `npm run samples -w backend` writes them; a test checks they match.
export const sampleFiles = sampleStatements.map((s) => ({
  name: `${s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.csv`,
  csv: s.csv,
}));

// ---- sample applications ---------------------------------------------------

export interface ApplicationSeed {
  id: string;
  applicant: Applicant;
  requestedAmount: number;
  statementId: string;
  uploadedAt: string;
  submittedAt: string;
  borrowerNote?: string;
}

export const applicationSeeds: ApplicationSeed[] = [
  {
    id: '4821',
    applicant: { legalName: 'Jordan Lee', email: 'jordan.lee@example.com', phone: '(416) 555-0148' },
    requestedAmount: 4000,
    statementId: 'steady',
    uploadedAt: '2026-10-21T00:16:00Z',
    submittedAt: '2026-10-21T00:21:00Z',
    borrowerNote: 'My July pay was lower because I took a week of unpaid leave.',
  },
  {
    id: '4817',
    applicant: { legalName: 'Taylor Brooks', email: 'taylor.brooks@example.com', phone: '(647) 555-0127' },
    requestedAmount: 6000,
    statementId: 'semimonthly',
    uploadedAt: '2026-10-20T21:36:00Z',
    submittedAt: '2026-10-20T21:40:00Z',
  },
  {
    id: '4815',
    applicant: { legalName: 'Chris Nguyen', email: 'chris.nguyen@example.com', phone: '(905) 555-0164' },
    requestedAmount: 1000,
    statementId: 'tight',
    uploadedAt: '2026-10-20T18:06:00Z',
    submittedAt: '2026-10-20T18:10:00Z',
    borrowerNote: 'The delivery app sometimes pays late, so rent goes out a few days late.',
  },
  {
    id: '4812',
    applicant: { legalName: 'Morgan Diaz', email: 'morgan.diaz@example.com', phone: '(416) 555-0175' },
    requestedAmount: 3000,
    statementId: 'biweekly',
    uploadedAt: '2026-10-19T14:58:00Z',
    submittedAt: '2026-10-19T15:02:00Z',
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
    followedSuggestion: false,
    overrideNote: 'Regular pay and rent every month, and the balance never went below zero. Starting at the starter limit.',
    reviewerId: 'rv-002',
    decidedAt: '2026-10-19T19:30:00Z',
  },
];
