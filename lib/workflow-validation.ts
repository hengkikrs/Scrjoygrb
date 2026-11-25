import type {
  AiErrorExplanation,
  AiScheduleInterpretation,
  FieldVerificationResult,
  MockFormValues,
} from './types';

const VALID_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const DAY_ALIASES: Record<string, (typeof VALID_DAYS)[number]> = {
  mon: 'Mon',
  senin: 'Mon',
  sen: 'Mon',
  tue: 'Tue',
  selasa: 'Tue',
  sel: 'Tue',
  wed: 'Wed',
  rabu: 'Wed',
  rab: 'Wed',
  thu: 'Thu',
  kamis: 'Thu',
  kam: 'Thu',
  fri: 'Fri',
  jumat: 'Fri',
  jum: 'Fri',
  sat: 'Sat',
  sabtu: 'Sat',
  sab: 'Sat',
  sun: 'Sun',
  minggu: 'Sun',
  min: 'Sun',
};

/**
 * Validate phone number as text only. Preserves leading 0 and '+' prefix.
 */
export function validatePhoneNumber(raw: string): { valid: boolean; reason?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: true };
  }
  // Allow optional leading '+', digits, spaces, hyphens, parentheses
  if (!/^\+?[\d\s\-()]{7,20}$/.test(trimmed)) {
    return { valid: false, reason: 'INVALID_PHONE_FORMAT' };
  }
  const digitCount = trimmed.replace(/\D/g, '').length;
  if (digitCount < 7 || digitCount > 15) {
    return { valid: false, reason: 'INVALID_PHONE_LENGTH' };
  }
  return { valid: true };
}

/**
 * Validate optional website URL without fabricating or mutating user input.
 */
export function validateWebsiteUrl(raw: string): { valid: boolean; reason?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: true };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: 'INVALID_URL_PROTOCOL' };
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return { valid: false, reason: 'INVALID_URL_HOST' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'INVALID_WEBSITE_URL' };
  }
}

/**
 * Validate opening hours format safely.
 * Supported standard patterns:
 * - "Mon-Sun 08:00-22:00"
 * - "Mon-Sat 09:00-17:00"
 * - "Senin-Minggu 08:00-21:00"
 * - "24/7" or "24 Hours"
 * Unmappable schedules return valid: false so the row is flagged NEEDS_REVIEW.
 */
export function validateOpeningHours(raw: string): {
  valid: boolean;
  normalized?: string;
  reason?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: true };
  }

  if (/^(24\/7|24\s*hours?|24\s*jam)$/i.test(trimmed)) {
    return { valid: true, normalized: 'Mon-Sun 00:00-23:59' };
  }

  // Match pattern: <DayRange> <HH:MM>-<HH:MM>
  const match = trimmed.match(
    /^([A-Za-z]+)(?:\s*[-–]\s*([A-Za-z]+))?\s+(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})$/
  );
  if (!match) {
    return { valid: false, reason: 'UNMAPPABLE_OPENING_HOURS' };
  }

  const [, startDayRaw, endDayRaw, openHStr, openMStr, closeHStr, closeMStr] = match;
  const startDay = DAY_ALIASES[startDayRaw.toLowerCase()];
  const endDay = endDayRaw ? DAY_ALIASES[endDayRaw.toLowerCase()] : startDay;

  if (!startDay || !endDay) {
    return { valid: false, reason: 'UNKNOWN_DAY_TOKEN' };
  }

  const openH = Number(openHStr);
  const openM = Number(openMStr);
  const closeH = Number(closeHStr);
  const closeM = Number(closeMStr);

  if (
    openH < 0 ||
    openH > 23 ||
    openM < 0 ||
    openM > 59 ||
    closeH < 0 ||
    closeH > 23 ||
    closeM < 0 ||
    closeM > 59
  ) {
    return { valid: false, reason: 'INVALID_TIME_RANGE' };
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const dayPart = endDayRaw ? `${startDay}-${endDay}` : startDay;
  return {
    valid: true,
    normalized: `${dayPart} ${pad(openH)}:${pad(openM)}-${pad(closeH)}:${pad(closeM)}`,
  };
}

/**
 * Normalize values ONLY for comparison against OCR readback.
 * Never mutates the underlying CSV record.
 */
export function normalizeForComparison(
  field: keyof MockFormValues,
  value: string
): string {
  const trimmed = value.trim();
  switch (field) {
    case 'poi_name':
      return trimmed.replace(/\s+/g, ' ').toLowerCase();
    case 'phone_number':
      // Preserve leading '+' and leading zero while ignoring formatting spaces/dashes
      return trimmed.replace(/[\s\-()]/g, '');
    case 'website':
      return trimmed.replace(/\/+$/, '').toLowerCase();
    case 'opening_hours':
      return trimmed.replace(/\s+/g, ' ').replace(/[–—]/g, '-').toLowerCase();
    default:
      return trimmed.toLowerCase();
  }
}

export function verifyFieldReadback(
  field: keyof MockFormValues,
  expected: string,
  observed: string,
  confidence: number,
  threshold: number
): FieldVerificationResult {
  if (confidence < threshold) {
    return {
      field,
      expected,
      observed,
      matched: false,
      confidence,
      reason: `OCR confidence ${(confidence * 100).toFixed(0)}% di bawah ambang batas ${(threshold * 100).toFixed(0)}%`,
    };
  }

  const normExpected = normalizeForComparison(field, expected);
  const normObserved = normalizeForComparison(field, observed);

  if (normExpected !== normObserved) {
    return {
      field,
      expected,
      observed,
      matched: false,
      confidence,
      reason: `Nilai terbaca ("${observed || '(kosong)'}") tidak cocok dengan CSV ("${expected || '(kosong)'}")`,
    };
  }

  return {
    field,
    expected,
    observed,
    matched: true,
    confidence,
  };
}

/**
 * Strictly validate optional Gemini AI schedule interpretation locally before presenting or applying.
 */
export function validateAiScheduleLocally(
  raw: Partial<AiScheduleInterpretation>
): AiScheduleInterpretation {
  const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const days = Array.isArray(raw.days)
    ? raw.days.filter((d): d is string =>
        VALID_DAYS.includes(d as (typeof VALID_DAYS)[number])
      )
    : [];
  const openTime = typeof raw.open_time === 'string' ? raw.open_time.trim() : '';
  const closeTime = typeof raw.close_time === 'string' ? raw.close_time.trim() : '';
  const normalized =
    typeof raw.normalized_schedule === 'string' ? raw.normalized_schedule.trim() : '';

  const timesValid = timeRe.test(openTime) && timeRe.test(closeTime);
  const scheduleCheck = normalized ? validateOpeningHours(normalized) : { valid: false };
  const localPassed =
    Boolean(raw.mappable) && days.length > 0 && timesValid && scheduleCheck.valid;

  return {
    normalized_schedule: localPassed ? scheduleCheck.normalized ?? normalized : '',
    days,
    open_time: timesValid ? openTime : '',
    close_time: timesValid ? closeTime : '',
    mappable: Boolean(raw.mappable) && localPassed,
    local_validation_passed: localPassed,
    local_validation_notes: localPassed
      ? 'Lolos validasi lokal: format hari & jam 24-jam valid.'
      : 'Ditolak validasi lokal: jadwal tidak dapat dipetakan dengan aman, tandai NEEDS_REVIEW.',
    explanation:
      typeof raw.explanation === 'string' && raw.explanation.trim()
        ? raw.explanation.trim()
        : 'Analisis jadwal dari asisten AI.',
  };
}

/**
 * Strictly validate optional Gemini AI error explanation locally.
 * Rejects any suggestion attempting to bypass CAPTCHA/OTP/security mechanisms.
 */
export function validateAiErrorLocally(
  raw: Partial<AiErrorExplanation>,
  errorCode: string
): AiErrorExplanation {
  const bannedPattern = /(bypass|crack|hack|skip\s*captcha|solve\s*captcha|auto\s*otp|spoof)/i;
  const rawSteps = Array.isArray(raw.safe_recovery_steps)
    ? raw.safe_recovery_steps.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];

  const safeSteps = rawSteps.filter((step) => !bannedPattern.test(step));
  const summary =
    typeof raw.summary === 'string' && raw.summary.trim() && !bannedPattern.test(raw.summary)
      ? raw.summary.trim()
      : `Terjadi error ${errorCode}. Lakukan pemeriksaan layar sebelum melanjutkan.`;

  const passed = safeSteps.length > 0 && safeSteps.length === rawSteps.length;

  return {
    error_code: errorCode,
    summary,
    safe_recovery_steps:
      safeSteps.length > 0
        ? safeSteps
        : [
            'Jeda otomasi dan cek layar HP melalui scrcpy.',
            'Tangani dialog atau gangguan secara manual melalui Manual Takeover.',
            'Ambil screenshot baru dan validasi layar sebelum Resume.',
          ],
    requires_manual_operator: raw.requires_manual_operator !== false,
    local_validation_passed: passed,
  };
}
