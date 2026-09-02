/** Quotes one CSV cell with formula-injection protection, shared by Tool exports. */
export function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Joins header and rows into one UTF-8 BOM CSV document with CRLF lines. */
export function csvDocument(
  rows: readonly (readonly (string | number | null)[])[],
) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
