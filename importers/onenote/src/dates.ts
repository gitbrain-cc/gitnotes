/**
 * Date parsing for OneNote exports.
 * Supports English and French date formats.
 */

const DAYS_EN = '(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)';
const DAYS_FR = '(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)';
const DAYS = `(?:${DAYS_EN}|${DAYS_FR})`;

const MONTHS_EN = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
const MONTHS_FR = '(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)';
const MONTHS = `(?:${MONTHS_EN}|${MONTHS_FR})`;

// Date patterns OneNote uses
const DATE_PATTERNS = [
  // "Monday 8 February 2021" or "lundi 1 février 2021" (no comma)
  new RegExp(`^${DAYS}\\s+\\d{1,2}\\s+${MONTHS}\\s+\\d{4}$`, 'i'),
  // "Monday, 8 February 2021" (comma after day)
  new RegExp(`^${DAYS},\\s+\\d{1,2}\\s+${MONTHS}\\s+\\d{4}$`, 'i'),
  // "Friday, June 6, 2025" (US format)
  new RegExp(`^${DAYS},\\s+${MONTHS}\\s+\\d{1,2},\\s+\\d{4}$`, 'i'),
];

const TIME_PATTERN = /^\d{1,2}:\d{2}$/;

// French to English month mapping
const FRENCH_MONTHS: Record<string, string> = {
  'janvier': 'January',
  'février': 'February',
  'mars': 'March',
  'avril': 'April',
  'mai': 'May',
  'juin': 'June',
  'juillet': 'July',
  'août': 'August',
  'septembre': 'September',
  'octobre': 'October',
  'novembre': 'November',
  'décembre': 'December',
};

const MONTH_TO_NUMBER: Record<string, number> = {
  'January': 0, 'February': 1, 'March': 2, 'April': 3,
  'May': 4, 'June': 5, 'July': 6, 'August': 7,
  'September': 8, 'October': 9, 'November': 10, 'December': 11,
};

export function isDateLine(line: string): boolean {
  const trimmed = line.trim();
  return DATE_PATTERNS.some(pattern => pattern.test(trimmed));
}

export function isTimeLine(line: string): boolean {
  return TIME_PATTERN.test(line.trim());
}

function normalizeFrenchDate(dateStr: string): string {
  let result = dateStr;
  for (const [fr, en] of Object.entries(FRENCH_MONTHS)) {
    result = result.replace(new RegExp(fr, 'gi'), en);
  }
  return result;
}

export function parseDate(dateStr: string, timeStr: string): Date | null {
  const normalized = normalizeFrenchDate(dateStr.trim());
  const time = timeStr.trim();

  // Remove day name: "Monday 8 February 2021" -> "8 February 2021"
  // Or "Friday, June 6, 2025" -> "June 6, 2025"
  const cleaned = normalized.replace(/^[A-Za-zéû]+,?\s+/, '');

  let day: number;
  let month: number;
  let year: number;

  // Try "8 February 2021" format
  const euMatch = cleaned.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (euMatch) {
    day = parseInt(euMatch[1], 10);
    month = MONTH_TO_NUMBER[euMatch[2]];
    year = parseInt(euMatch[3], 10);
  } else {
    // Try "June 6, 2025" format (US)
    const usMatch = cleaned.match(/^(\w+)\s+(\d{1,2}),\s+(\d{4})$/);
    if (usMatch) {
      month = MONTH_TO_NUMBER[usMatch[1]];
      day = parseInt(usMatch[2], 10);
      year = parseInt(usMatch[3], 10);
    } else {
      return null;
    }
  }

  if (month === undefined) {
    return null;
  }

  // Parse time
  const [hours, minutes] = time.split(':').map(n => parseInt(n, 10));

  return new Date(year, month, day, hours, minutes);
}
