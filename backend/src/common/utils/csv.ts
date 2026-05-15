

const DANGEROUS_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

export function csvEscapeField(value: unknown): string {
  if (value == null) return '';

  let str = String(value).replace(/[\r\n]+/g, ' ');

  if (str.length > 0 && DANGEROUS_PREFIXES.includes(str.charAt(0))) {
    str = `'${str}`;
  }

  if (/[",]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function csvRow(fields: unknown[]): string {
  return fields.map(csvEscapeField).join(',');
}

export function csvFromRows(header: string[], rows: unknown[][]): string {
  const lines = [csvRow(header), ...rows.map((r) => csvRow(r))];
  return lines.join('\r\n');
}
