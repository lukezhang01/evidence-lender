import type { ProductConfig } from '@evidence-lender/backend/contract';

type LocaleSettings = Pick<ProductConfig, 'locale' | 'currency' | 'timeZone'>;

// Built on the server from the backend config, so every page formats money and
// times the same way and server and browser never disagree.
export function createFormatters({ locale, currency, timeZone }: LocaleSettings) {
  const wholeMoney = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const dateTime = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return {
    wholeMoney: (amount: number) => wholeMoney.format(amount),
    dateTime: (iso: string) => dateTime.format(new Date(iso)),
  };
}

export type Formatters = ReturnType<typeof createFormatters>;
