const PAKISTAN_LOCALE = 'en-PK';

type DateInput = string | number | Date;

function toDate(value: DateInput) {
  return value instanceof Date ? value : new Date(value);
}

export function formatDatePK(value: DateInput, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(PAKISTAN_LOCALE, options).format(toDate(value));
}

export function formatDateTimePK(value: DateInput, options: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' }) {
  return new Intl.DateTimeFormat(PAKISTAN_LOCALE, options).format(toDate(value));
}

export function formatTimePK(value: DateInput, options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }) {
  return new Intl.DateTimeFormat(PAKISTAN_LOCALE, options).format(toDate(value));
}
