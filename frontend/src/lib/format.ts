import type { ProductConfig } from '@evidence-lender/backend/contract';

type LocaleSettings = Pick<ProductConfig, 'locale' | 'currency' | 'timeZone'>;

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Built on the server from the backend config, so every page formats money and
// times the same way and server and browser never disagree.
export function createFormatters({ locale, currency, timeZone }: LocaleSettings) {
  const wholeMoney = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const count = new Intl.NumberFormat(locale);
  const dateTime = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  // Calendar dates (YYYY-MM-DD) have no time zone; show them as written.
  const day = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });
  const longDay = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
  const calendar = (iso: string) => new Date(`${iso}T00:00:00Z`);

  return {
    wholeMoney: (amount: number) => wholeMoney.format(amount),
    money: (amount: number) => money.format(amount),
    percent: (ratio: number) => percent.format(ratio),
    count: (n: number) => count.format(n),
    dateTime: (iso: string) => dateTime.format(new Date(iso)),
    day: (isoDate: string) => day.format(calendar(isoDate)),
    longDay: (isoDate: string) => longDay.format(calendar(isoDate)),
    recordDate: (value: string) => (CALENDAR_DATE.test(value) ? day.format(calendar(value)) : dateTime.format(new Date(value))),
  };
}

export type Formatters = ReturnType<typeof createFormatters>;
