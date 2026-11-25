import type { CsvPreviewResult, PoiRecord, RecordStatus } from './types';
import {
  validateOpeningHours,
  validatePhoneNumber,
  validateWebsiteUrl,
} from './workflow-validation';

const VALID_STATUSES: RecordStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'SUCCESS',
  'SKIPPED',
  'NEEDS_REVIEW',
  'FAILED',
];

/**
 * Detect whether a CSV string uses ',' or ';' as delimiter by inspecting the header line.
 */
export function detectCsvDelimiter(content: string): ',' | ';' {
  const cleaned = stripBom(content);
  const firstLine = cleaned.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
  let commaCount = 0;
  let semicolonCount = 0;
  let inQuotes = false;

  for (let i = 0; i < firstLine.length; i += 1) {
    const ch = firstLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === ',') commaCount += 1;
      if (ch === ';') semicolonCount += 1;
    }
  }

  return semicolonCount > commaCount ? ';' : ',';
}

export function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

/**
 * RFC-4180 compliant CSV tokenizer supporting comma or semicolon delimiters,
 * quoted values, escaped double quotes, and UTF-8 text.
 * Always keeps every cell strictly as string (never coerces phone numbers to Number).
 */
export function parseCsvMatrix(content: string, delimiter: ',' | ';'): string[][] {
  const text = stripBom(content);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  // Filter trailing completely blank rows (e.g. final newline)
  return rows.filter((row) => !(row.length === 1 && row[0].trim() === ''));
}

/**
 * Deterministic stable internal record ID so row reordering never corrupts checkpoints.
 */
export function createStableRecordId(
  sourceRowNumber: number,
  poiName: string,
  phoneNumber: string,
  salt = ''
): string {
  const input = `${sourceRowNumber}|${poiName.trim().toLowerCase()}|${phoneNumber.trim()}|${salt}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `rec_${String(sourceRowNumber).padStart(3, '0')}_${hex}`;
}

export function previewAndValidateCsv(
  content: string,
  forcedDelimiter?: ',' | ';'
): CsvPreviewResult {
  const errors: string[] = [];
  const trimmed = stripBom(content).trim();
  if (!trimmed) {
    return {
      valid: false,
      delimiter: forcedDelimiter ?? ',',
      headers: [],
      missing_required_headers: ['poi_name'],
      added_columns: [],
      rows: [],
      summary: { total: 0, ready: 0, skipped: 0, needs_review: 0, already_success: 0 },
      errors: ['CSV_INVALID: File CSV kosong.'],
    };
  }

  const delimiter = forcedDelimiter ?? detectCsvDelimiter(content);
  const matrix = parseCsvMatrix(content, delimiter);
  if (matrix.length < 2) {
    return {
      valid: false,
      delimiter,
      headers: matrix[0] ?? [],
      missing_required_headers: ['poi_name'],
      added_columns: [],
      rows: [],
      summary: { total: 0, ready: 0, skipped: 0, needs_review: 0, already_success: 0 },
      errors: ['CSV_INVALID: Minimal harus ada baris header dan 1 baris data.'],
    };
  }

  const rawHeaders = matrix[0].map((h) => h.trim().toLowerCase());
  const missingRequired: string[] = [];
  if (!rawHeaders.includes('poi_name')) {
    missingRequired.push('poi_name');
  }

  if (missingRequired.length > 0) {
    errors.push(`CSV_INVALID: Kolom wajib tidak ditemukan: ${missingRequired.join(', ')}`);
    return {
      valid: false,
      delimiter,
      headers: rawHeaders,
      missing_required_headers: missingRequired,
      added_columns: [],
      rows: [],
      summary: { total: 0, ready: 0, skipped: 0, needs_review: 0, already_success: 0 },
      errors,
    };
  }

  const addedColumns: string[] = [];
  if (!rawHeaders.includes('status')) addedColumns.push('status');
  if (!rawHeaders.includes('notes')) addedColumns.push('notes');

  const idx = {
    poi_name: rawHeaders.indexOf('poi_name'),
    phone_number: rawHeaders.indexOf('phone_number'),
    website: rawHeaders.indexOf('website'),
    opening_hours: rawHeaders.indexOf('opening_hours'),
    status: rawHeaders.indexOf('status'),
    notes: rawHeaders.indexOf('notes'),
  };

  const rows: Omit<PoiRecord, 'job_id' | 'updated_at'>[] = [];
  let ready = 0;
  let skipped = 0;
  let needsReview = 0;
  let alreadySuccess = 0;

  for (let r = 1; r < matrix.length; r += 1) {
    const cells = matrix[r];
    const sourceRowNumber = r;
    const poiName = (cells[idx.poi_name] ?? '').trim();
    // Strictly preserve raw string for phone_number (leading 0 and '+' preserved)
    const phoneNumber = idx.phone_number >= 0 ? (cells[idx.phone_number] ?? '').trim() : '';
    const website = idx.website >= 0 ? (cells[idx.website] ?? '').trim() : '';
    const openingHours = idx.opening_hours >= 0 ? (cells[idx.opening_hours] ?? '').trim() : '';
    const rawStatus = idx.status >= 0 ? (cells[idx.status] ?? '').trim().toUpperCase() : '';
    const rawNotes = idx.notes >= 0 ? (cells[idx.notes] ?? '').trim() : '';

    let status: RecordStatus = 'PENDING';
    const notesList: string[] = rawNotes ? [rawNotes] : [];

    // Rule 7: Existing SUCCESS rows are preserved & skipped by default
    if (rawStatus === 'SUCCESS') {
      status = 'SUCCESS';
      alreadySuccess += 1;
      if (!notesList.length) {
        notesList.push('Sudah SUCCESS di sumber CSV (dilewati default)');
      }
    } else if (rawStatus === 'SKIPPED') {
      status = 'SKIPPED';
      skipped += 1;
    } else if (!poiName) {
      // Rule 1: poi_name kosong -> SKIPPED with MISSING_POI_NAME
      status = 'SKIPPED';
      notesList.push('MISSING_POI_NAME');
      skipped += 1;
    } else {
      // Validate phone, website, opening hours
      const phoneCheck = validatePhoneNumber(phoneNumber);
      const urlCheck = validateWebsiteUrl(website);
      const hoursCheck = validateOpeningHours(openingHours);

      if (!phoneCheck.valid && phoneCheck.reason) {
        notesList.push(phoneCheck.reason);
      }
      if (!urlCheck.valid && urlCheck.reason) {
        notesList.push(urlCheck.reason);
      }
      if (!hoursCheck.valid && hoursCheck.reason) {
        notesList.push(hoursCheck.reason);
      }

      if (!phoneCheck.valid || !urlCheck.valid || !hoursCheck.valid) {
        status = 'NEEDS_REVIEW';
        needsReview += 1;
      } else if (VALID_STATUSES.includes(rawStatus as RecordStatus) && rawStatus !== 'IN_PROGRESS') {
        status = rawStatus as RecordStatus;
        if (status === 'PENDING') ready += 1;
        if (status === 'NEEDS_REVIEW') needsReview += 1;
      } else {
        status = 'PENDING';
        ready += 1;
      }
    }

    rows.push({
      record_id: createStableRecordId(sourceRowNumber, poiName, phoneNumber),
      source_row_number: sourceRowNumber,
      poi_name: poiName,
      phone_number: phoneNumber,
      website,
      opening_hours: openingHours,
      status,
      notes: notesList.join('; '),
      attempt_count: 0,
      last_error: null,
    });
  }

  return {
    valid: true,
    delimiter,
    headers: rawHeaders,
    missing_required_headers: [],
    added_columns: addedColumns,
    rows,
    summary: {
      total: rows.length,
      ready,
      skipped,
      needs_review: needsReview,
      already_success: alreadySuccess,
    },
    errors,
  };
}

function escapeCsvCell(value: string, delimiter: ',' | ';'): string {
  if (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serialize POI records back to UTF-8 CSV including status & notes columns.
 * Preserves leading-zero phone strings cleanly.
 */
export function exportRecordsToCsv(
  records: PoiRecord[],
  delimiter: ',' | ';' = ','
): string {
  const headers = ['poi_name', 'phone_number', 'website', 'opening_hours', 'status', 'notes'];
  const lines = [headers.join(delimiter)];

  for (const rec of records) {
    const cells = [
      rec.poi_name,
      rec.phone_number,
      rec.website,
      rec.opening_hours,
      rec.status,
      rec.notes,
    ].map((c) => escapeCsvCell(c ?? '', delimiter));
    lines.push(cells.join(delimiter));
  }

  // Include UTF-8 BOM so Excel on Windows preserves Indonesian characters cleanly
  return `\uFEFF${lines.join('\r\n')}`;
}
