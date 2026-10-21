// Reads a bank statement the applicant uploaded as a CSV and turns it into
// plain-language facts. Every fact is an upload, so it is never verified
// (rule 2); each one keeps the rows it rests on, so a reviewer can check it.
//
// Accepted columns (header names are case-insensitive):
//   Date         YYYY-MM-DD (or YYYY/MM/DD)
//   Description  free text
//   Amount       money in positive, money out negative
//     or Debit + Credit instead of Amount
//   Balance      optional, the balance after each transaction
// This maps onto the single-account statement schema of the cash-flow model
// notebook (date, amount, balance, in/out), if that model is added later.

import type { BlindSpot, EvidenceItem, SourceRecord } from './contract.ts';

export const MAX_STATEMENT_ROWS = 5000;

// A problem with the file, written to be shown to the applicant as is.
export class StatementError extends Error {}

export interface ParsedStatement {
  rows: SourceRecord[];
  hasBalance: boolean;
  firstDate: string;
  lastDate: string;
}

// ---- CSV -------------------------------------------------------------------

// RFC 4180: comma separated, double-quoted fields, "" inside quotes, CRLF or LF.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"' && field === '') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (quoted) throw new StatementError('The file ends in the middle of a quoted value. Check that it’s a complete CSV.');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// ---- statement -------------------------------------------------------------

const COLUMNS = {
  date: ['date', 'transaction date', 'posted date', 'posting date'],
  description: ['description', 'details', 'memo', 'payee', 'transaction description', 'name'],
  amount: ['amount', 'transaction amount'],
  debit: ['debit', 'debits', 'withdrawal', 'withdrawals', 'money out'],
  credit: ['credit', 'credits', 'deposit', 'deposits', 'money in'],
  balance: ['balance', 'running balance'],
};

const normalize = (h: string) => h.trim().toLowerCase().replace(/\s+/g, ' ');

function parseDate(raw: string): string | null {
  const m = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

function parseMoney(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/CAD|\$|,|\s/gi, '');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return negative ? -n : n;
}

export function parseStatement(csv: string): ParsedStatement {
  const table = parseCsv(csv);
  if (table.length === 0) throw new StatementError('The file is empty.');
  const header = table[0]!.map(normalize);
  const find = (names: string[]) => header.findIndex((h) => names.includes(h));
  const col = {
    date: find(COLUMNS.date),
    description: find(COLUMNS.description),
    amount: find(COLUMNS.amount),
    debit: find(COLUMNS.debit),
    credit: find(COLUMNS.credit),
    balance: find(COLUMNS.balance),
  };
  const splitAmount = col.amount < 0 && col.debit >= 0 && col.credit >= 0;
  if (col.date < 0 || col.description < 0 || (col.amount < 0 && !splitAmount)) {
    throw new StatementError(
      'The first row needs Date, Description and Amount column names (Debit and Credit columns work instead of Amount).',
    );
  }

  const body = table.slice(1);
  if (body.length === 0) throw new StatementError('The file has column names but no transactions.');
  if (body.length > MAX_STATEMENT_ROWS) {
    throw new StatementError(`The file has more than ${MAX_STATEMENT_ROWS} transactions. Upload a shorter period.`);
  }

  let balancesComplete = col.balance >= 0;
  const rows: SourceRecord[] = body.map((cells, i) => {
    const line = i + 2;
    const cell = (index: number) => (index >= 0 ? (cells[index] ?? '') : '');
    const date = parseDate(cell(col.date));
    if (!date) {
      throw new StatementError(`Row ${line}: “${cell(col.date)}” isn’t a date we can read. Use the format 2026-03-27.`);
    }
    let amount: number | null;
    if (splitAmount) {
      const debit = parseMoney(cell(col.debit));
      const credit = parseMoney(cell(col.credit));
      if ((cell(col.debit).trim() && debit === null) || (cell(col.credit).trim() && credit === null)) {
        throw new StatementError(`Row ${line}: the debit or credit isn’t a number.`);
      }
      amount = debit === null && credit === null ? null : Math.abs(credit ?? 0) - Math.abs(debit ?? 0);
    } else {
      amount = parseMoney(cell(col.amount));
    }
    if (amount === null) throw new StatementError(`Row ${line}: “${cell(col.amount)}” isn’t an amount we can read.`);

    const balance = col.balance >= 0 ? parseMoney(cell(col.balance)) : null;
    if (balance === null) balancesComplete = false;
    return {
      date,
      description: cell(col.description).trim(),
      amount: Math.round(amount * 100) / 100,
      ...(balance !== null ? { balance } : {}),
    };
  });

  // Keep file order within a day: that's the order balances were computed in.
  const ordered = rows.map((r, i) => ({ r, i })).sort((a, b) => a.r.date.localeCompare(b.r.date) || a.i - b.i);
  const sorted = ordered.map((x) => x.r);
  return {
    rows: balancesComplete ? sorted : sorted.map(({ balance: _balance, ...r }) => r),
    hasBalance: balancesComplete,
    firstDate: sorted[0]!.date,
    lastDate: sorted.at(-1)!.date,
  };
}

// True when the statement spans at least `months` calendar months.
export function coversMonths(statement: ParsedStatement, months: number): boolean {
  const first = new Date(`${statement.firstDate}T00:00:00Z`);
  const target = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + months, first.getUTCDate()));
  const lastPlusOne = new Date(`${statement.lastDate}T00:00:00Z`);
  lastPlusOne.setUTCDate(lastPlusOne.getUTCDate() + 1);
  return target <= lastPlusOne;
}

// ---- facts -----------------------------------------------------------------

export interface FactInput {
  statement: ParsedStatement;
  fileName: string;
  uploadRef: string;
  uploadedAt: string;
  idPrefix: string;
}

export interface FactFormat {
  money: (amount: number) => string; // whole currency units
  day: (isoDate: string) => string;
}

const RENT = /\b(rent|landlord)\b/i;
const FEE = /\b(nsf|overdraft|returned|insufficient funds)\b/i;
const DAYS_PER_MONTH = 365.25 / 12;
const sum = (rows: SourceRecord[]) => rows.reduce((t, r) => t + r.amount, 0);
const month = (date: string) => date.slice(0, 7);

// Calendar months (YYYY-MM) that lie entirely between two dates.
function completeMonths(first: string, last: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${first.slice(0, 7)}-01T00:00:00Z`);
  if (first.slice(8) !== '01') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  for (;;) {
    const end = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    if (end > last) return out;
    out.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
}

export function statementFacts(input: FactInput, f: FactFormat): { items: EvidenceItem[]; blindSpots: BlindSpot[] } {
  const { statement, fileName } = input;
  const { rows } = statement;
  const span = (Date.parse(statement.lastDate) - Date.parse(statement.firstDate)) / 86_400_000 + 1;
  const months = span / DAYS_PER_MONTH;
  const range = `${f.day(statement.firstDate)} to ${f.day(statement.lastDate)}`;
  const fullMonths = completeMonths(statement.firstDate, statement.lastDate);
  const moneyIn = rows.filter((r) => r.amount > 0);
  const moneyOut = rows.filter((r) => r.amount < 0);

  const items: EvidenceItem[] = [];
  const fact = (key: string, item: Omit<EvidenceItem, 'id' | 'sourceType' | 'sourceRef' | 'retrievedAt' | 'verified'>) =>
    items.push({
      id: `${input.idPrefix}-${key}`,
      sourceType: 'upload',
      sourceRef: input.uploadRef,
      retrievedAt: input.uploadedAt,
      verified: false,
      ...item,
    });
  const blindSpots: BlindSpot[] = [
    {
      title: 'Whether the statement is complete and unedited',
      note: 'The applicant uploaded it. It can’t be traced back to their bank.',
    },
    {
      title: 'Whose account this is',
      note: 'A CSV statement doesn’t show the account holder, and identity isn’t checked.',
    },
    {
      title: 'Debts or accounts at other banks',
      note: 'We only see this one account. Ask about other loans or cards.',
    },
    {
      title: 'Cash income, if any',
      note: 'Would make the picture better, not worse, but we can’t count it.',
    },
  ];

  // Capacity
  const monthlyIn = Math.round(sum(moneyIn) / months);
  fact('money-in', {
    category: 'capacity',
    statement: `About ${f.money(monthlyIn)} a month came in, on average`,
    sourceDetail: `${fileName}: ${moneyIn.length} deposits, ${range}`,
    figure: { name: 'monthly_money_in', value: monthlyIn, note: `${moneyIn.length} deposits over ${Math.round(months)} months` },
    records: moneyIn,
  });

  const byDescription = new Map<string, SourceRecord[]>();
  for (const r of moneyIn) {
    const key = r.description.toUpperCase().replace(/\s+/g, ' ');
    byDescription.set(key, [...(byDescription.get(key) ?? []), r]);
  }
  const [regular] = [...byDescription.values()].sort((a, b) => sum(b) - sum(a));
  if (regular && moneyIn.length > 0 && sum(regular) >= sum(moneyIn) / 2 && regular.length >= Math.max(2, Math.floor(months))) {
    const share = Math.round((sum(regular) / sum(moneyIn)) * 100);
    fact('regular-deposit', {
      category: 'capacity',
      statement: `${share}% of it came from ${regular.length} deposits described as “${regular[0]!.description}”, about ${f.money(sum(regular) / regular.length)} each`,
      sourceDetail: `${fileName}: deposits with the same description`,
      records: regular,
    });
  } else {
    blindSpots.push({
      title: 'Where the income comes from',
      note: 'No single regular deposit makes up most of the money coming in.',
    });
  }

  const leftOver = Math.round((sum(moneyIn) + sum(moneyOut)) / months);
  fact('left-over', {
    category: 'capacity',
    statement:
      leftOver >= 0
        ? `On average, ${f.money(leftOver)} more came in than went out each month`
        : `On average, ${f.money(-leftOver)} more went out than came in each month`,
    sourceDetail: `${fileName}: computed from all ${rows.length} transactions`,
    figure: { name: 'monthly_left_over', value: leftOver, note: 'Average, after everything that went out' },
    records: [],
  });

  // Willingness
  const rent = moneyOut.filter((r) => RENT.test(r.description));
  if (rent.length > 0) {
    // Count whole calendar months only, so a statement that starts mid-month
    // doesn't look like a missed payment.
    const rentMonths = new Set(rent.map((r) => month(r.date)).filter((m) => fullMonths.includes(m))).size;
    const typical = Math.round(-sum(rent) / rent.length);
    const inMonths = `in ${rentMonths} of ${fullMonths.length} full ${fullMonths.length === 1 ? 'month' : 'months'}`;
    fact('rent', {
      category: 'willingness',
      statement: `Payments that look like rent, about ${f.money(typical)}, ${inMonths}`,
      sourceDetail: `${fileName}: ${rent.length} payments mentioning rent or a landlord`,
      figure: { name: 'monthly_rent', value: typical, note: inMonths.replace(/^in/, 'In') },
      records: rent,
    });
  } else {
    blindSpots.push({
      title: 'Housing costs',
      note: 'No payment in the file mentions rent or a landlord. Ask how they pay for housing.',
    });
  }

  const fees = moneyOut.filter((r) => FEE.test(r.description));
  fact('fees', {
    category: 'willingness',
    statement:
      fees.length === 0
        ? 'No overdraft or returned-payment fees'
        : `${fees.length} overdraft or returned-payment ${fees.length === 1 ? 'fee' : 'fees'}, ${f.money(-sum(fees))} in total`,
    sourceDetail: `${fileName}: descriptions mentioning NSF, overdraft or returned payments`,
    figure: { name: 'overdraft_fees', value: fees.length, note: 'Over the whole statement' },
    records: fees,
  });

  // Resilience
  if (statement.hasBalance) {
    const withBalance = rows as (SourceRecord & { balance: number })[];
    const lowest = withBalance.reduce((low, r) => (r.balance < low.balance ? r : low));
    fact('lowest-balance', {
      category: 'resilience',
      statement: `Lowest balance was ${f.money(lowest.balance)}, on ${f.day(lowest.date)}`,
      sourceDetail: `${fileName}: Balance column`,
      figure: { name: 'lowest_balance', value: Math.round(lowest.balance), note: `On ${f.day(lowest.date)}` },
      records: [lowest],
    });

    const below = withBalance.filter((r) => r.balance < 0);
    const belowDays = new Set(below.map((r) => r.date)).size;
    fact('below-zero', {
      category: 'resilience',
      statement:
        belowDays === 0
          ? 'The balance never went below zero'
          : `The balance was below zero on ${belowDays} ${belowDays === 1 ? 'day' : 'days'}`,
      sourceDetail: `${fileName}: Balance column`,
      records: below,
    });

    const last = withBalance.at(-1)!;
    fact('ending-balance', {
      category: 'resilience',
      statement: `Balance at the end of the statement: ${f.money(last.balance)}`,
      sourceDetail: `${fileName}: last row`,
      figure: { name: 'ending_balance', value: Math.round(last.balance), note: `On ${f.day(last.date)}` },
      records: [last],
    });
  } else {
    blindSpots.push({
      title: 'Balances over time',
      note: 'The file has no Balance column, so we can’t see how low the account gets.',
    });
  }

  return { items, blindSpots };
}
