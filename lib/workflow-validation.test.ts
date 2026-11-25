import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeForComparison,
  validateAiErrorLocally,
  validateAiScheduleLocally,
  validateOpeningHours,
  validatePhoneNumber,
  validateWebsiteUrl,
  verifyFieldReadback,
} from './workflow-validation';

test('validates phone numbers as strings preserving leading zero and plus', () => {
  assert.equal(validatePhoneNumber('081234567890').valid, true);
  assert.equal(validatePhoneNumber('+62 812-3456-7890').valid, true);
  assert.equal(validatePhoneNumber('').valid, true);
  assert.equal(validatePhoneNumber('abc123').valid, false);
  assert.equal(normalizeForComparison('phone_number', '0812-3456 7890'), '081234567890');
});

test('validates URLs without mutating empty optional URLs', () => {
  assert.equal(validateWebsiteUrl('').valid, true);
  assert.equal(validateWebsiteUrl('https://kopipagi.example').valid, true);
  assert.equal(validateWebsiteUrl('ftp://invalid.example').valid, false);
  assert.equal(validateWebsiteUrl('not-a-url').valid, false);
});

test('validates opening hours and rejects ambiguous schedules for NEEDS_REVIEW', () => {
  assert.equal(validateOpeningHours('Mon-Sun 08:00-22:00').valid, true);
  assert.equal(validateOpeningHours('Senin-Sabtu 09:00-17:30').valid, true);
  assert.equal(validateOpeningHours('24/7').valid, true);
  assert.equal(validateOpeningHours('Buka pagi sampai habis').valid, false);
});

test('OCR readback verification fails below threshold or on mismatch', () => {
  const ok = verifyFieldReadback('phone_number', '081234567890', '0812-3456-7890', 0.95, 0.82);
  assert.equal(ok.matched, true);

  const lowConf = verifyFieldReadback('poi_name', 'Kopi Pagi', 'Kopi Pagi', 0.65, 0.82);
  assert.equal(lowConf.matched, false);

  const mismatch = verifyFieldReadback('phone_number', '081234567890', '81234567890', 0.96, 0.82);
  assert.equal(mismatch.matched, false);
});

test('local AI output validation rejects hallucinated schedules and unsafe security bypass advice', () => {
  const badSchedule = validateAiScheduleLocally({
    normalized_schedule: 'Setiap hari pagi',
    days: [],
    open_time: '99:00',
    close_time: '25:00',
    mappable: true,
  });
  assert.equal(badSchedule.local_validation_passed, false);
  assert.equal(badSchedule.mappable, false);

  const goodSchedule = validateAiScheduleLocally({
    normalized_schedule: 'Mon-Sun 08:00-22:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    open_time: '08:00',
    close_time: '22:00',
    mappable: true,
    explanation: 'Jadwal eksplisit setiap hari pukul 08:00 sampai 22:00.',
  });
  assert.equal(goodSchedule.local_validation_passed, true);

  const unsafeErrorAdvice = validateAiErrorLocally(
    {
      summary: 'CAPTCHA muncul di layar.',
      safe_recovery_steps: [
        'Bypass CAPTCHA otomatis dengan skrip',
        'Gunakan Manual Takeover untuk menyelesaikan CAPTCHA secara manual',
      ],
      requires_manual_operator: true,
    },
    'APP_UNEXPECTED_DIALOG'
  );
  assert.equal(unsafeErrorAdvice.local_validation_passed, false);
  assert.equal(unsafeErrorAdvice.safe_recovery_steps.length, 1);
});
