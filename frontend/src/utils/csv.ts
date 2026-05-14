/**
 * CSV Import / Export utility.
 * Handles proper escaping, BOM for Excel compatibility, multilingual headers,
 * flexible parsing of imported files, and ID-based upsert operations.
 */

// ─── EXPORT ───

/** Escape a cell value for CSV (handles commas, quotes, newlines) */
function escapeCell(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvExportOptions<T = Record<string, any>> {
  /** The data rows */
  data: T[];
  /** Column definitions: key = object property, label = CSV header */
  columns: { key: string; label: string }[];
  /** Output filename (without .csv) */
  filename: string;
  /** Optional value formatter per column key */
  formatters?: Record<string, (value: any, row: T) => string>;
}

export function exportCsv<T extends Record<string, any>>({
  data,
  columns,
  filename,
  formatters = {},
}: CsvExportOptions<T>): void {
  const header = columns.map(c => escapeCell(c.label)).join(',');
  const rows = data.map(row =>
    columns
      .map(col => {
        const raw = row[col.key];
        const formatted = formatters[col.key] ? formatters[col.key](raw, row) : raw;
        return escapeCell(formatted);
      })
      .join(',')
  );

  // BOM for Excel to detect UTF-8
  const bom = '\uFEFF';
  const csv = bom + [header, ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── EXAMPLE / TEMPLATE ───

export function downloadTemplate(
  columns: { key: string; label: string }[],
  filename: string,
  exampleRows?: Record<string, string>[]
): void {
  const header = columns.map(c => escapeCell(c.label)).join(',');
  const rows = (exampleRows || []).map(row =>
    columns.map(col => escapeCell(row[col.key] || '')).join(',')
  );
  const bom = '\uFEFF';
  const csv = bom + [header, ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_template.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── IMPORT ───

export interface CsvImportResult<T> {
  data: T[];
  errors: string[];
  skipped: number;
}

/**
 * Parse CSV text into objects.
 * Maps CSV headers → column keys using the provided columns definition.
 * Supports both the localized label and the raw key for matching.
 */
export function parseCsv<T extends Record<string, any>>(
  text: string,
  columns: { key: string; label: string }[],
  validators?: Record<string, (value: string) => string | null>
): CsvImportResult<T> {
  const errors: string[] = [];
  let skipped = 0;

  // Strip BOM
  const clean = text.replace(/^\uFEFF/, '');

  // Split into lines (handle \r\n and \n)
  const lines = splitCsvLines(clean);
  if (lines.length < 2) {
    return { data: [], errors: ['File is empty or has no data rows'], skipped: 0 };
  }

  const headerLine = lines[0];
  const headerCells = parseCsvLine(headerLine);

  // Build header → column key mapping
  const labelToKey: Record<string, string> = {};
  columns.forEach(col => {
    labelToKey[col.label.toLowerCase().trim()] = col.key;
    labelToKey[col.key.toLowerCase().trim()] = col.key;
  });

  const colMap: (string | null)[] = headerCells.map(h => {
    const normalized = h.toLowerCase().trim();
    return labelToKey[normalized] || null;
  });

  const data: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    let rowValid = true;

    colMap.forEach((key, idx) => {
      if (key && idx < cells.length) {
        const val = cells[idx].trim();

        if (validators && validators[key]) {
          const err = validators[key](val);
          if (err) {
            errors.push(`Row ${i + 1}, "${key}": ${err}`);
            rowValid = false;
          }
        }

        row[key] = val;
      }
    });

    if (rowValid && Object.keys(row).length > 0) {
      data.push(row as T);
    } else if (!rowValid) {
      skipped++;
    }
  }

  return { data, errors, skipped };
}

/** Read a File object as text */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file, 'UTF-8');
  });
}

// ─── UPSERT ───

export interface UpsertResult {
  created: number;
  updated: number;
  errors: number;
}

export interface UpsertOptions {
  /** Parsed CSV rows */
  rows: Record<string, any>[];
  /** Key used to identify existing records (e.g. "id") */
  matchKey: string;
  /** Base API URL */
  apiUrl: string;
  /** Endpoint path (POST for create, PUT/:id for update) */
  endpoint: string;
  /** Authorization / content-type headers */
  authHeaders: HeadersInit;
  /** Set of IDs that already exist in the system */
  existingIds: Set<string>;
  /** Optional transform before sending row to API */
  transform?: (row: Record<string, any>) => Record<string, any>;
}

/**
 * Performs ID-based upsert: POST for new records, PUT for existing ones.
 * Returns counts of created, updated, and errored rows.
 */
export async function upsertRows(opts: UpsertOptions): Promise<UpsertResult> {
  const { rows, matchKey, apiUrl, endpoint, authHeaders, existingIds, transform } = opts;
  const result: UpsertResult = { created: 0, updated: 0, errors: 0 };

  for (const raw of rows) {
    const row = transform ? transform(raw) : raw;
    const id = raw[matchKey];
    const isUpdate = id && existingIds.has(String(id));

    try {
      const url = isUpdate
        ? `${apiUrl}${endpoint}/${id}`
        : `${apiUrl}${endpoint}`;

      const res = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: authHeaders,
        body: JSON.stringify(row),
      });

      if (res.ok) {
        if (isUpdate) result.updated++;
        else result.created++;
      } else {
        result.errors++;
      }
    } catch {
      result.errors++;
    }
  }

  return result;
}

// ─── Internal CSV Parsing Helpers ───

/** Split CSV text into lines, respecting quoted fields that contain newlines */
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++; // skip \r\n
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Parse a single CSV line into cells, handling quoted fields */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  cells.push(current);
  return cells;
}
