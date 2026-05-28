export const JST_TIMEZONE = 'Asia/Tokyo';

const JST_DATETIME_PATTERN = 'yyyy-MM-dd HH:mm:ss';
const JST_DATE_PATTERN = 'yyyy-MM-dd';

const ALREADY_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ALREADY_JST_DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const ISO_LIKE = /[TZ]|[+-]\d{2}:?\d{2}$/;

export function nowJstTimestamp(): string {
  return Utilities.formatDate(new Date(), JST_TIMEZONE, JST_DATETIME_PATTERN);
}

export function nowJstDate(): string {
  return Utilities.formatDate(new Date(), JST_TIMEZONE, JST_DATE_PATTERN);
}

export function formatJstTimestamp(date: Date): string {
  return Utilities.formatDate(date, JST_TIMEZONE, JST_DATETIME_PATTERN);
}

export function formatJstDate(date: Date): string {
  return Utilities.formatDate(date, JST_TIMEZONE, JST_DATE_PATTERN);
}

export function toJstTimestamp(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (ALREADY_JST_DATETIME.test(text)) return text;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    const d = value as Date;
    if (Number.isNaN(d.getTime())) return null;
    return formatJstTimestamp(d);
  }
  if (ALREADY_DATE_ONLY.test(text)) return `${text} 00:00:00`;
  if (!ISO_LIKE.test(text)) {
    const parsedLocal = parseLocal(text);
    if (parsedLocal) return formatJstTimestamp(parsedLocal);
    return null;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatJstTimestamp(parsed);
}

export function toJstDate(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (ALREADY_DATE_ONLY.test(text)) return text;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    const d = value as Date;
    if (Number.isNaN(d.getTime())) return null;
    return formatJstDate(d);
  }
  if (ALREADY_JST_DATETIME.test(text)) return text.slice(0, 10);
  if (!ISO_LIKE.test(text)) {
    const parsedLocal = parseLocal(text);
    if (parsedLocal) return formatJstDate(parsedLocal);
    return null;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatJstDate(parsed);
}

function parseLocal(text: string): Date | null {
  const normalized = text.replace(/[.]/g, '-').replace(/\//g, '-');
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;
  const d = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || '0'),
    Number(match[5] || '0'),
    Number(match[6] || '0'),
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

export function classifyTimestampColumn(header: string): 'datetime' | 'date' | null {
  const h = String(header || '').trim().toLowerCase();
  if (!h) return null;
  if (h.endsWith('_at')) return 'datetime';
  if (h.endsWith('_date')) return 'date';
  return null;
}
