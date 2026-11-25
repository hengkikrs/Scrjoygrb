import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectCsvDelimiter,
  exportRecordsToCsv,
  previewAndValidateCsv,
} from './csv-parser';
import type { PoiRecord } from './types';

test('detects comma and semicolon delimiters accurately', () => {
  assert.equal(detectCsvDelimiter('poi_name,phone_number,website\nKopi,0812,'), ',');
  assert.equal(detectCsvDelimiter('poi_name;phone_number;website\nKopi;0812;'), ';');
});

test('preserves leading zero and plus sign on phone numbers without numeric coercion', () => {
  const csv = [
    'poi_name,phone_number,website,opening_hours',
    'Kopi Pagi,081234567890,https://kopipagi.example,Mon-Sun 08:00-22:00',
    'Apotek Sehat,+6281399887766,,24/7',
  ].join('\n');

  const preview = previewAndValidateCsv(csv);
  assert.equal(preview.valid, true);
  assert.deepEqual(preview.added_columns, ['status', 'notes']);
  assert.equal(preview.rows[0].phone_number, '081234567890');
  assert.equal(preview.rows[1].phone_number, '+6281399887766');
  assert.equal(preview.rows[1].website, '');
  assert.equal(preview.summary.ready, 2);
});

test('handles semicolon UTF-8 CSV with BOM, missing poi_name, invalid URL, and existing SUCCESS', () => {
  const csv =
    '\uFEFFpoi_name;phone_number;website;opening_hours;status;notes\n' +
    ';081200001111;https://a.example;Mon-Fri 08:00-17:00;;\n' +
    'Toko Selesai;081299998888;https://done.example;Mon-Sun 09:00-21:00;SUCCESS;Done\n' +
    'Warung Ambigu;081277776666;;Buka pagi sampai habis;;\n' +
    'Klinik URL Salah;081266665555;bukan-url;Mon-Sat 08:00-17:00;;';

  const preview = previewAndValidateCsv(csv);
  assert.equal(preview.valid, true);
  assert.equal(preview.delimiter, ';');
  assert.equal(preview.rows[0].status, 'SKIPPED');
  assert.equal(preview.rows[0].notes, 'MISSING_POI_NAME');
  assert.equal(preview.rows[1].status, 'SUCCESS');
  assert.equal(preview.rows[2].status, 'NEEDS_REVIEW');
  assert.match(preview.rows[2].notes, /UNMAPPABLE_OPENING_HOURS/);
  assert.equal(preview.rows[3].status, 'NEEDS_REVIEW');
  assert.match(preview.rows[3].notes, /INVALID_WEBSITE_URL/);
});

test('rejects CSV missing required poi_name header', () => {
  const preview = previewAndValidateCsv('nama,telepon\nKopi,081234567890');
  assert.equal(preview.valid, false);
  assert.deepEqual(preview.missing_required_headers, ['poi_name']);
});

test('round-trip CSV export preserves status, notes, and leading-zero phone string', () => {
  const records: PoiRecord[] = [
    {
      record_id: 'rec_001',
      job_id: 'job_1',
      source_row_number: 1,
      poi_name: 'Kopi Pagi, Cabang 1',
      phone_number: '081234567890',
      website: 'https://kopipagi.example',
      opening_hours: 'Mon-Sun 08:00-22:00',
      status: 'SUCCESS',
      notes: 'Terverifikasi',
      attempt_count: 1,
      last_error: null,
      updated_at: '2026-11-24T00:00:00.000Z',
    },
  ];

  const exported = exportRecordsToCsv(records, ',');
  const reparsed = previewAndValidateCsv(exported, ',');
  assert.equal(reparsed.valid, true);
  assert.equal(reparsed.rows[0].poi_name, 'Kopi Pagi, Cabang 1');
  assert.equal(reparsed.rows[0].phone_number, '081234567890');
  assert.equal(reparsed.rows[0].status, 'SUCCESS');
  assert.equal(reparsed.rows[0].notes, 'Terverifikasi');
});
