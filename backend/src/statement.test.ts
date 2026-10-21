import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { coversMonths, parseCsv, parseStatement, StatementError, statementFacts } from './statement.ts';

const fmt = {
  money: (n: number) => `$${Math.round(n)}`,
  day: (d: string) => d,
};
const facts = (csv: string) =>
  statementFacts(
    { statement: parseStatement(csv), fileName: 's.csv', uploadRef: 'upload-1', uploadedAt: '2026-10-21T00:00:00Z', idPrefix: 'ev-1' },
    fmt,
  );
const find = (csv: string, key: string) => facts(csv).items.find((i) => i.id === `ev-1-${key}`);

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas inside quotes and CRLF', () => {
    assert.deepEqual(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n\r\n'), [
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ]);
  });

  it('strips a byte-order mark', () => {
    assert.deepEqual(parseCsv('﻿Date\n2026-01-01'), [['Date'], ['2026-01-01']]);
  });

  it('rejects an unterminated quote', () => {
    assert.throws(() => parseCsv('a\n"oops'), StatementError);
  });
});

describe('parseStatement', () => {
  it('reads Date, Description, Amount and Balance, in any case, and sorts by date', () => {
    const s = parseStatement('date,DESCRIPTION,Amount,Balance\n2026-02-01,Rent,"-1,650.00",350\n2026-01-15,Pay,$2000,2000\n');
    assert.deepEqual(s.rows, [
      { date: '2026-01-15', description: 'Pay', amount: 2000, balance: 2000 },
      { date: '2026-02-01', description: 'Rent', amount: -1650, balance: 350 },
    ]);
    assert.equal(s.hasBalance, true);
  });

  it('accepts Debit and Credit instead of Amount, and parentheses as negative', () => {
    const s = parseStatement('Date,Details,Debit,Credit\n2026-01-02,Pay,,2000\n2026-01-03,Fee,(5.00),\n2026-01-04,Shop,40,\n');
    assert.deepEqual(
      s.rows.map((r) => r.amount),
      [2000, -5, -40],
    );
    assert.equal(s.hasBalance, false);
  });

  it('treats the balance as missing unless every row has one', () => {
    const s = parseStatement('Date,Description,Amount,Balance\n2026-01-01,A,10,10\n2026-01-02,B,5,\n');
    assert.equal(s.hasBalance, false);
    assert.ok(s.rows.every((r) => r.balance === undefined));
  });

  it('explains what is wrong, with the row number', () => {
    const cases: [string, RegExp][] = [
      ['', /empty/],
      ['Date,Amount\n2026-01-01,5', /Description/],
      ['Date,Description,Amount\n', /no transactions/],
      ['Date,Description,Amount\n03/27/2026,A,5', /Row 2: “03\/27\/2026”/],
      ['Date,Description,Amount\n2026-02-30,A,5', /Row 2/],
      ['Date,Description,Amount\n2026-01-01,A,5\n2026-01-02,B,abc', /Row 3: “abc”/],
    ];
    for (const [csv, message] of cases) assert.throws(() => parseStatement(csv), message, csv);
  });
});

describe('coversMonths', () => {
  const span = (first: string, last: string) =>
    parseStatement(`Date,Description,Amount\n${first},A,1\n${last},B,1\n`);
  it('counts calendar months from the first transaction', () => {
    assert.equal(coversMonths(span('2026-07-21', '2026-10-20'), 3), true);
    assert.equal(coversMonths(span('2026-07-21', '2026-10-19'), 3), false);
  });
});

describe('statementFacts', () => {
  const csv = [
    'Date,Description,Amount,Balance',
    '2026-01-01,E-TRANSFER RENT [LANDLORD],-1000,500',
    '2026-01-02,PAYROLL [EMPLOYER],2000,2500',
    '2026-01-16,PAYROLL [EMPLOYER],2000,4500',
    '2026-01-20,GROCERY,-600,3900',
    '2026-02-01,E-TRANSFER RENT [LANDLORD],-1000,2900',
    '2026-02-02,PAYROLL [EMPLOYER],2000,4900',
    '2026-02-10,NSF FEE,-48,-20',
    '2026-02-16,PAYROLL [EMPLOYER],2000,1980',
    '2026-03-01,E-TRANSFER RENT [LANDLORD],-1000,980',
    '2026-03-02,PAYROLL [EMPLOYER],2000,2980',
    '2026-03-31,GIFT FROM FAMILY,100,3080',
  ].join('\n');

  it('marks every fact as an unverified upload with its rows (rules 1 and 2)', () => {
    const { items } = facts(csv);
    assert.ok(items.length > 0);
    for (const i of items) {
      assert.equal(i.verified, false);
      assert.equal(i.sourceType, 'upload');
      assert.equal(i.sourceRef, 'upload-1');
      assert.ok(i.sourceDetail.startsWith('s.csv'));
    }
    assert.equal(find(csv, 'money-in')?.records.length, 6);
  });

  it('finds the regular deposit, rent, fees and balances', () => {
    assert.match(find(csv, 'regular-deposit')!.statement, /5 deposits described as “PAYROLL \[EMPLOYER\]”/);
    assert.match(find(csv, 'rent')!.statement, /in 3 of 3 full months/);
    assert.equal(find(csv, 'fees')?.figure?.value, 1);
    assert.equal(find(csv, 'lowest-balance')?.figure?.value, -20);
    assert.match(find(csv, 'below-zero')!.statement, /below zero on 1 day/);
    assert.equal(find(csv, 'ending-balance')?.figure?.value, 3080);
  });

  it('says which way the money went on average', () => {
    assert.match(find(csv, 'left-over')!.statement, /more came in than went out/);
    const short = 'Date,Description,Amount\n2026-01-01,PAY,100\n2026-03-31,RENT,-500\n';
    assert.match(find(short, 'left-over')!.statement, /more went out than came in/);
  });

  it('adds blind spots for what the file can’t show', () => {
    const noBalanceNoRent = 'Date,Description,Amount\n2026-01-01,PAY,100\n2026-03-31,SHOP,-50\n';
    const titles = facts(noBalanceNoRent).blindSpots.map((b) => b.title);
    assert.ok(titles.includes('Housing costs'));
    assert.ok(titles.includes('Balances over time'));
    assert.ok(titles.includes('Whose account this is'));
    assert.equal(find(noBalanceNoRent, 'lowest-balance'), undefined);
  });
});
