import type {
  AutomationMode,
  DeviceInfo,
  ErrorCode,
  FieldVerificationResult,
  MockFormValues,
  PoiRecord,
  RecordStatus,
  ScreenType,
  WorkflowProfile,
  WorkflowState,
} from './types';
import { getScreenMeta } from './mock-device';
import {
  validateOpeningHours,
  validatePhoneNumber,
  validateWebsiteUrl,
  verifyFieldReadback,
} from './workflow-validation';

export interface StateSpec {
  state: WorkflowState;
  label: string;
  phase: 'Setup' | 'Queue' | 'Fill & Verify' | 'Confirmation' | 'Checkpoint' | 'Control';
  allowed_actions: string;
  timeout_ms: number;
  retry_policy: string;
}

export const WORKFLOW_STATE_SPECS: StateSpec[] = [
  {
    state: 'IDLE',
    label: 'Idle',
    phase: 'Setup',
    allowed_actions: 'Menunggu perintah Start dari operator',
    timeout_ms: 0,
    retry_policy: 'Tidak ada',
  },
  {
    state: 'DEVICE_CHECK',
    label: 'Device Check',
    phase: 'Setup',
    allowed_actions: 'Menjalankan adb devices & get-state pada serial terpilih',
    timeout_ms: 5000,
    retry_policy: 'Pause jika offline/unauthorized',
  },
  {
    state: 'WAITING_FOR_OPERATOR',
    label: 'Waiting For Operator',
    phase: 'Setup',
    allowed_actions: 'Menunggu otorisasi USB Debugging atau kesiapan halaman Grab',
    timeout_ms: 0,
    retry_policy: 'Manual operator',
  },
  {
    state: 'SCREEN_CHECK',
    label: 'Screen Check',
    phase: 'Setup',
    allowed_actions: 'Capture screenshot, OCR, dan verifikasi layar dikenal + confidence >= ambang',
    timeout_ms: 6000,
    retry_policy: 'Pause & screenshot jika tidak dikenal',
  },
  {
    state: 'OPEN_POI_FORM',
    label: 'Open POI Form',
    phase: 'Setup',
    allowed_actions: 'Memastikan formulir POI aktif dan bersih sebelum input',
    timeout_ms: 6000,
    retry_policy: 'Maks 2 retry non-final',
  },
  {
    state: 'READ_NEXT_CSV_ROW',
    label: 'Read Next CSV Row',
    phase: 'Queue',
    allowed_actions: 'Mengambil baris PENDING berikutnya (melewati SUCCESS secara default)',
    timeout_ms: 2000,
    retry_policy: 'Tidak ada',
  },
  {
    state: 'VALIDATE_ROW',
    label: 'Validate Row',
    phase: 'Queue',
    allowed_actions: 'Validasi poi_name, format telepon teks, URL, dan jam operasional',
    timeout_ms: 2000,
    retry_policy: 'Invalid -> MARK_SKIPPED / NEEDS_REVIEW',
  },
  {
    state: 'MARK_SKIPPED',
    label: 'Mark Skipped',
    phase: 'Queue',
    allowed_actions: 'Menandai baris SKIPPED dengan alasan eksplisit lalu checkpoint',
    timeout_ms: 2000,
    retry_policy: 'Tidak ada',
  },
  {
    state: 'FILL_POI_NAME',
    label: 'Fill POI Name',
    phase: 'Fill & Verify',
    allowed_actions: 'Fokus kolom Nama Tempat via OCR/template dan ketik nilai CSV',
    timeout_ms: 8000,
    retry_policy: 'Maks 2 retry non-final',
  },
  {
    state: 'VERIFY_POI_NAME',
    label: 'Verify POI Name',
    phase: 'Fill & Verify',
    allowed_actions: 'OCR baca ulang dan bandingkan (normalisasi tanpa ubah sumber)',
    timeout_ms: 6000,
    retry_policy: 'Koreksi terbatas maks 2x -> NEEDS_REVIEW',
  },
  {
    state: 'FILL_PHONE',
    label: 'Fill Phone',
    phase: 'Fill & Verify',
    allowed_actions: 'Fokus kolom Nomor Telepon dan ketik teks utuh (jaga angka awal 0 & +)',
    timeout_ms: 8000,
    retry_policy: 'Maks 2 retry non-final',
  },
  {
    state: 'VERIFY_PHONE',
    label: 'Verify Phone',
    phase: 'Fill & Verify',
    allowed_actions: 'OCR baca ulang nomor telepon dan pastikan angka awal 0 terjaga',
    timeout_ms: 6000,
    retry_policy: 'Koreksi terbatas maks 2x -> NEEDS_REVIEW',
  },
  {
    state: 'FILL_WEBSITE',
    label: 'Fill Website',
    phase: 'Fill & Verify',
    allowed_actions: 'Isi URL jika tersedia; biarkan kosong jika opsional kosong',
    timeout_ms: 8000,
    retry_policy: 'Maks 2 retry non-final',
  },
  {
    state: 'VERIFY_WEBSITE',
    label: 'Verify Website',
    phase: 'Fill & Verify',
    allowed_actions: 'Verifikasi URL tampil sesuai CSV (atau kosong jika sumber kosong)',
    timeout_ms: 6000,
    retry_policy: 'Koreksi terbatas maks 2x -> NEEDS_REVIEW',
  },
  {
    state: 'FILL_OPENING_HOURS',
    label: 'Fill Opening Hours',
    phase: 'Fill & Verify',
    allowed_actions: 'Auto-scroll terkontrol (batas scroll), re-OCR, lalu isi jam operasional',
    timeout_ms: 10000,
    retry_policy: 'Pause jika batas scroll tercapai',
  },
  {
    state: 'VERIFY_OPENING_HOURS',
    label: 'Verify Opening Hours',
    phase: 'Fill & Verify',
    allowed_actions: 'Baca ulang jadwal tampil dan pastikan cocok dengan CSV',
    timeout_ms: 6000,
    retry_policy: 'Koreksi terbatas maks 2x -> NEEDS_REVIEW',
  },
  {
    state: 'REVIEW_BEFORE_SUBMIT',
    label: 'Review Before Submit',
    phase: 'Confirmation',
    allowed_actions: 'Menyusun ringkasan perbandingan CSV vs OCR untuk verifikasi akhir',
    timeout_ms: 3000,
    retry_policy: 'Tidak ada',
  },
  {
    state: 'WAIT_FOR_OPERATOR_CONFIRMATION',
    label: 'Wait Operator Confirm',
    phase: 'Confirmation',
    allowed_actions: 'Assisted Mode: menunggu persetujuan eksplisit operator sebelum Submit',
    timeout_ms: 0,
    retry_policy: 'Menunggu aksi operator',
  },
  {
    state: 'SUBMIT_IF_APPROVED',
    label: 'Submit If Approved',
    phase: 'Confirmation',
    allowed_actions: 'Menekan tombol Submit sekali (tidak pernah auto-retry submit)',
    timeout_ms: 10000,
    retry_policy: 'DILARANG auto-retry submit',
  },
  {
    state: 'VERIFY_RESULT',
    label: 'Verify Result',
    phase: 'Checkpoint',
    allowed_actions: 'Memastikan konfirmasi berhasil tampil; jika ragu -> MARK_NEEDS_REVIEW',
    timeout_ms: 8000,
    retry_policy: 'Uncertain -> NEEDS_REVIEW (bukan SUCCESS)',
  },
  {
    state: 'MARK_SUCCESS',
    label: 'Mark Success',
    phase: 'Checkpoint',
    allowed_actions: 'Menandai baris SUCCESS setelah hasil terverifikasi',
    timeout_ms: 2000,
    retry_policy: 'Tidak ada',
  },
  {
    state: 'MARK_NEEDS_REVIEW',
    label: 'Mark Needs Review',
    phase: 'Checkpoint',
    allowed_actions: 'Menandai baris NEEDS_REVIEW untuk pemeriksaan manual operator',
    timeout_ms: 2000,
    retry_policy: 'Tidak ada',
  },
  {
    state: 'SAVE_CHECKPOINT',
    label: 'Save Checkpoint',
    phase: 'Checkpoint',
    allowed_actions: 'Menyimpan progres baris dan log secara persisten ke database lokal',
    timeout_ms: 3000,
    retry_policy: 'Wajib setelah setiap baris',
  },
];

export interface MachineContext {
  state: WorkflowState;
  activeRecordId: string | null;
  queueRecordIds: string[];
  device: DeviceInfo;
  screen: ScreenType;
  formValues: MockFormValues;
  scrollCount: number;
  fieldRetryCount: number;
  verifications: FieldVerificationResult[];
  automationMode: AutomationMode;
  autoSubmitPolicyAcknowledged: boolean;
  skipExistingSuccess: boolean;
  operatorApprovedSubmit: boolean;
  injectedFault: ErrorCode | null;
  lowOcrConfidence: boolean;
}

export interface StepOutcome {
  nextState: WorkflowState;
  updatedScreen: ScreenType;
  updatedFormValues: MockFormValues;
  activeRecordId: string | null;
  recordUpdate?: {
    record_id: string;
    status: RecordStatus;
    notes?: string;
    last_error?: ErrorCode | null;
    increment_attempt?: boolean;
  };
  verificationAdded?: FieldVerificationResult;
  scrollCount: number;
  fieldRetryCount: number;
  log: {
    level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
    message: string;
    error_code?: ErrorCode | null;
    capture_evidence?: boolean;
  };
  shouldPause: boolean;
  completedBatch: boolean;
  consumeInjectedFault?: boolean;
}

/**
 * Crash recovery rule (PRD Section 12):
 * Any record left IN_PROGRESS after unexpected shutdown MUST become NEEDS_REVIEW,
 * never automatically retried or marked SUCCESS, because submit may already have occurred.
 */
export function recoverInterruptedRecords(records: PoiRecord[]): {
  records: PoiRecord[];
  recoveredIds: string[];
} {
  const recoveredIds: string[] = [];
  const now = new Date().toISOString();

  const updated = records.map((rec) => {
    if (rec.status === 'IN_PROGRESS') {
      recoveredIds.push(rec.record_id);
      const suffix = 'Dipulihkan dari sesi terhenti (IN_PROGRESS -> NEEDS_REVIEW)';
      return {
        ...rec,
        status: 'NEEDS_REVIEW' as RecordStatus,
        notes: rec.notes ? `${rec.notes}; ${suffix}` : suffix,
        last_error: 'SUBMIT_UNCONFIRMED' as ErrorCode,
        updated_at: now,
      };
    }
    return rec;
  });

  return { records: updated, recoveredIds };
}

/**
 * Determine the next eligible record from the job respecting skip rules and optional explicit selection.
 */
export function selectNextEligibleRecord(
  records: PoiRecord[],
  queueRecordIds: string[],
  skipExistingSuccess: boolean
): PoiRecord | null {
  const targetPool =
    queueRecordIds.length > 0
      ? queueRecordIds
          .map((id) => records.find((r) => r.record_id === id))
          .filter((r): r is PoiRecord => Boolean(r))
      : records;

  for (const rec of targetPool) {
    if (rec.status === 'PENDING') return rec;
    if (!skipExistingSuccess && queueRecordIds.includes(rec.record_id) && rec.status === 'SUCCESS') {
      return rec;
    }
  }
  return null;
}

/**
 * Pure deterministic transition function for one tick of the Grab RPA State Machine.
 */
export function stepWorkflowMachine(
  ctx: MachineContext,
  records: PoiRecord[],
  profile: WorkflowProfile
): StepOutcome {
  const base: Omit<StepOutcome, 'nextState' | 'log'> = {
    updatedScreen: ctx.screen,
    updatedFormValues: { ...ctx.formValues },
    activeRecordId: ctx.activeRecordId,
    scrollCount: ctx.scrollCount,
    fieldRetryCount: ctx.fieldRetryCount,
    shouldPause: false,
    completedBatch: false,
  };

  // Global device connection guard during active automation
  if (ctx.state !== 'IDLE' && ctx.state !== 'PAUSED' && ctx.state !== 'STOPPED' && ctx.state !== 'MANUAL_TAKEOVER') {
    if (ctx.device.adb_state === 'unauthorized') {
      return {
        ...base,
        nextState: 'WAITING_FOR_OPERATOR',
        shouldPause: true,
        log: {
          level: 'ERROR',
          error_code: 'DEVICE_UNAUTHORIZED',
          capture_evidence: true,
          message: `Perangkat ${ctx.device.serial} berstatus unauthorized. Setujui dialog USB Debugging di layar HP Android.`,
        },
      };
    }
    if (ctx.device.adb_state === 'offline' || ctx.device.adb_state === 'disconnected') {
      return {
        ...base,
        nextState: 'PAUSED',
        shouldPause: true,
        log: {
          level: 'ERROR',
          error_code: ctx.device.adb_state === 'offline' ? 'DEVICE_OFFLINE' : 'DEVICE_NOT_FOUND',
          capture_evidence: true,
          message: `Koneksi ADB terputus (${ctx.device.adb_state}). Proses dijeda secara aman; periksa kabel USB lalu Resume.`,
        },
      };
    }
  }

  // Global vision & security dialog safety guard (PRD Section 8)
  const screenMeta = getScreenMeta(ctx.screen);
  const visionActiveStates: WorkflowState[] = [
    'SCREEN_CHECK',
    'OPEN_POI_FORM',
    'FILL_POI_NAME',
    'VERIFY_POI_NAME',
    'FILL_PHONE',
    'VERIFY_PHONE',
    'FILL_WEBSITE',
    'VERIFY_WEBSITE',
    'FILL_OPENING_HOURS',
    'VERIFY_OPENING_HOURS',
    'SUBMIT_IF_APPROVED',
    'VERIFY_RESULT',
  ];

  if (visionActiveStates.includes(ctx.state)) {
    if (screenMeta.isSecurityChallenge) {
      return {
        ...base,
        nextState: 'PAUSED',
        shouldPause: true,
        log: {
          level: 'ERROR',
          error_code: 'APP_UNEXPECTED_DIALOG',
          capture_evidence: true,
          message: `${screenMeta.title}. Otomasi dihentikan otomatis (tidak pernah melewati OTP/CAPTCHA/izin). Gunakan Manual Takeover.`,
        },
      };
    }
    if (!screenMeta.recognized) {
      return {
        ...base,
        nextState: 'PAUSED',
        shouldPause: true,
        log: {
          level: 'ERROR',
          error_code: 'SCREEN_UNKNOWN',
          capture_evidence: true,
          message: 'Layar tidak dikenali oleh lapisan Vision. Agent menolak menebak koordinat — screenshot bukti disimpan, tunggu Manual Takeover.',
        },
      };
    }
  }

  const activeRecord = ctx.activeRecordId
    ? records.find((r) => r.record_id === ctx.activeRecordId) ?? null
    : null;

  switch (ctx.state) {
    case 'IDLE':
    case 'DEVICE_CHECK': {
      return {
        ...base,
        nextState: 'SCREEN_CHECK',
        log: {
          level: 'INFO',
          message: `Perangkat terverifikasi via ADB: ${ctx.device.model} (${ctx.device.serial}, ${ctx.device.resolution})`,
        },
      };
    }

    case 'SCREEN_CHECK': {
      const confidence = ctx.lowOcrConfidence
        ? Math.max(0.45, screenMeta.baseConfidence - 0.35)
        : screenMeta.baseConfidence;

      if (confidence < profile.ocr_confidence_threshold) {
        return {
          ...base,
          nextState: 'PAUSED',
          shouldPause: true,
          log: {
            level: 'WARN',
            error_code: 'SCREEN_UNKNOWN',
            capture_evidence: true,
            message: `Confidence OCR (${Math.round(confidence * 100)}%) di bawah ambang batas (${Math.round(profile.ocr_confidence_threshold * 100)}%). Jeda dan minta pemeriksaan operator.`,
          },
        };
      }

      return {
        ...base,
        nextState: 'OPEN_POI_FORM',
        log: {
          level: 'INFO',
          message: `Layar dikenali: ${screenMeta.title} (confidence ${Math.round(confidence * 100)}%)`,
        },
      };
    }

    case 'OPEN_POI_FORM': {
      return {
        ...base,
        nextState: 'READ_NEXT_CSV_ROW',
        updatedScreen: 'POI_FORM_TOP',
        updatedFormValues: {
          poi_name: '',
          phone_number: '',
          website: '',
          opening_hours: '',
        },
        scrollCount: 0,
        fieldRetryCount: 0,
        log: {
          level: 'INFO',
          message: 'Formulir POI Grab siap digunakan (bagian atas terdeteksi).',
        },
      };
    }

    case 'READ_NEXT_CSV_ROW': {
      const nextRec = selectNextEligibleRecord(
        records,
        ctx.queueRecordIds,
        ctx.skipExistingSuccess
      );

      if (!nextRec) {
        return {
          ...base,
          nextState: 'IDLE',
          activeRecordId: null,
          shouldPause: true,
          completedBatch: true,
          log: {
            level: 'SUCCESS',
            message: 'Semua baris yang memenuhi syarat pada batch telah selesai diproses.',
          },
        };
      }

      return {
        ...base,
        nextState: 'VALIDATE_ROW',
        activeRecordId: nextRec.record_id,
        updatedScreen: 'POI_FORM_TOP',
        updatedFormValues: {
          poi_name: '',
          phone_number: '',
          website: '',
          opening_hours: '',
        },
        scrollCount: 0,
        fieldRetryCount: 0,
        recordUpdate: {
          record_id: nextRec.record_id,
          status: 'IN_PROGRESS',
          increment_attempt: true,
        },
        log: {
          level: 'INFO',
          message: `Memproses baris #${nextRec.source_row_number}: ${nextRec.poi_name || '(Tanpa Nama POI)'}`,
        },
      };
    }

    case 'VALIDATE_ROW': {
      if (!activeRecord) {
        return {
          ...base,
          nextState: 'READ_NEXT_CSV_ROW',
          log: { level: 'WARN', message: 'Record aktif tidak ditemukan, membaca baris berikutnya.' },
        };
      }

      if (!activeRecord.poi_name.trim()) {
        return {
          ...base,
          nextState: 'MARK_SKIPPED',
          recordUpdate: {
            record_id: activeRecord.record_id,
            status: 'SKIPPED',
            notes: 'MISSING_POI_NAME',
          },
          log: {
            level: 'WARN',
            message: `Baris #${activeRecord.source_row_number} dilewati (MISSING_POI_NAME).`,
          },
        };
      }

      const phoneCheck = validatePhoneNumber(activeRecord.phone_number);
      const urlCheck = validateWebsiteUrl(activeRecord.website);
      const hoursCheck = validateOpeningHours(activeRecord.opening_hours);

      if (!phoneCheck.valid || !urlCheck.valid || !hoursCheck.valid) {
        const reasons = [phoneCheck.reason, urlCheck.reason, hoursCheck.reason]
          .filter(Boolean)
          .join(', ');
        return {
          ...base,
          nextState: 'MARK_NEEDS_REVIEW',
          recordUpdate: {
            record_id: activeRecord.record_id,
            status: 'NEEDS_REVIEW',
            notes: `Validasi data gagal: ${reasons}`,
          },
          log: {
            level: 'WARN',
            message: `Baris #${activeRecord.source_row_number} (${activeRecord.poi_name}) ditandai NEEDS_REVIEW (${reasons}).`,
          },
        };
      }

      return {
        ...base,
        nextState: 'FILL_POI_NAME',
        log: {
          level: 'INFO',
          message: `Validasi baris #${activeRecord.source_row_number} lolos. Memulai pengisian formulir.`,
        },
      };
    }

    case 'MARK_SKIPPED': {
      return {
        ...base,
        nextState: 'SAVE_CHECKPOINT',
        log: {
          level: 'INFO',
          message: `Status SKIPPED dicatat untuk baris #${activeRecord?.source_row_number ?? '-'}.`,
        },
      };
    }

    case 'FILL_POI_NAME': {
      if (!activeRecord) {
        return { ...base, nextState: 'READ_NEXT_CSV_ROW', log: { level: 'WARN', message: 'Record aktif hilang.' } };
      }
      if (ctx.injectedFault === 'FIELD_NOT_FOUND') {
        if (ctx.fieldRetryCount < profile.max_retries_non_final) {
          return {
            ...base,
            nextState: 'FILL_POI_NAME',
            fieldRetryCount: ctx.fieldRetryCount + 1,
            log: {
              level: 'WARN',
              error_code: 'FIELD_NOT_FOUND',
              capture_evidence: true,
              message: `FIELD_NOT_FOUND pada Nama Tempat. Retry non-final ${ctx.fieldRetryCount + 1}/${profile.max_retries_non_final}.`,
            },
          };
        }
        return {
          ...base,
          nextState: 'MARK_NEEDS_REVIEW',
          fieldRetryCount: 0,
          consumeInjectedFault: true,
          recordUpdate: {
            record_id: activeRecord.record_id,
            status: 'NEEDS_REVIEW',
            last_error: 'FIELD_NOT_FOUND',
            notes: 'FIELD_NOT_FOUND setelah batas retry',
          },
          log: {
            level: 'ERROR',
            error_code: 'FIELD_NOT_FOUND',
            capture_evidence: true,
            message: 'Field Nama Tempat tetap tidak ditemukan setelah batas retry. Ditandai NEEDS_REVIEW.',
          },
        };
      }

      const typedValue =
        ctx.injectedFault === 'FIELD_MISMATCH'
          ? `${activeRecord.poi_name.slice(0, Math.max(2, activeRecord.poi_name.length - 2))}`
          : activeRecord.poi_name;

      return {
        ...base,
        nextState: 'VERIFY_POI_NAME',
        updatedScreen: 'POI_FORM_TOP',
        updatedFormValues: {
          ...ctx.formValues,
          poi_name: typedValue,
        },
        log: {
          level: 'INFO',
          message: `Mengisi field Nama Tempat: "${activeRecord.poi_name}"`,
        },
      };
    }

    case 'VERIFY_POI_NAME': {
      if (!activeRecord) {
        return { ...base, nextState: 'READ_NEXT_CSV_ROW', log: { level: 'WARN', message: 'Record aktif hilang.' } };
      }
      const conf = ctx.lowOcrConfidence ? 0.61 : 0.96;
      const result = verifyFieldReadback(
        'poi_name',
        activeRecord.poi_name,
        ctx.formValues.poi_name,
        conf,
        profile.ocr_confidence_threshold
      );

      if (!result.matched) {
        if (ctx.fieldRetryCount < profile.max_retries_non_final) {
          return {
            ...base,
            nextState: 'FILL_POI_NAME',
            fieldRetryCount: ctx.fieldRetryCount + 1,
            verificationAdded: result,
            consumeInjectedFault: ctx.fieldRetryCount + 1 >= profile.max_retries_non_final,
            log: {
              level: 'WARN',
              error_code: 'FIELD_MISMATCH',
              capture_evidence: true,
              message: `Verifikasi Nama Tempat gagal (${result.reason}). Koreksi terbatas ${ctx.fieldRetryCount + 1}/${profile.max_retries_non_final}.`,
            },
          };
        }
        return {
          ...base,
          nextState: 'MARK_NEEDS_REVIEW',
          fieldRetryCount: 0,
          verificationAdded: result,
          consumeInjectedFault: true,
          recordUpdate: {
            record_id: activeRecord.record_id,
            status: 'NEEDS_REVIEW',
            last_error: 'FIELD_MISMATCH',
            notes: `FIELD_MISMATCH pada poi_name: ${result.reason}`,
          },
          log: {
            level: 'ERROR',
            error_code: 'FIELD_MISMATCH',
            capture_evidence: true,
            message: 'Koreksi Nama Tempat mencapai batas retry. Baris ditandai NEEDS_REVIEW.',
          },
        };
      }

      return {
        ...base,
        nextState: 'FILL_PHONE',
        fieldRetryCount: 0,
        verificationAdded: result,
        log: {
          level: 'SUCCESS',
          message: `POI name verified (${Math.round(result.confidence * 100)}% OCR match)`,
        },
      };
    }

    case 'FILL_PHONE': {
      if (!activeRecord) {
        return { ...base, nextState: 'READ_NEXT_CSV_ROW', log: { level: 'WARN', message: 'Record aktif hilang.' } };
      }
      if (!activeRecord.phone_number.trim()) {
        return {
          ...base,
          nextState: 'VERIFY_PHONE',
          log: {
            level: 'INFO',
            message: 'Nomor telepon kosong pada CSV — dibiarkan kosong tanpa nilai palsu.',
          },
        };
      }
      return {
        ...base,
        nextState: 'VERIFY_PHONE',
        updatedFormValues: {
          ...ctx.formValues,
          phone_number: activeRecord.phone_number,
        },
        log: {
          level: 'INFO',
          message: `Mengisi field Nomor Telepon (teks utuh): "${activeRecord.phone_number}"`,
        },
      };
    }

    case 'VERIFY_PHONE': {
      if (!activeRecord) {
        return { ...base, nextState: 'READ_NEXT_CSV_ROW', log: { level: 'WARN', message: 'Record aktif hilang.' } };
      }
      const conf = ctx.lowOcrConfidence ? 0.6 : 0.95;
      const result = verifyFieldReadback(
        'phone_number',
        activeRecord.phone_number,
        ctx.formValues.phone_number,
        conf,
        profile.ocr_confidence_threshold
      );
      if (!result.matched) {
        return {
          ...base,
          nextState: 'MARK_NEEDS_REVIEW',
          verificationAdded: result,
          recordUpdate: {
            record_id: activeRecord.record_id,
            status: 'NEEDS_REVIEW',
            last_error: 'FIELD_MISMATCH',
            notes: `FIELD_MISMATCH pada phone_number: ${result.reason}`,
          },
          log: {
            level: 'ERROR',
            error_code: 'FIELD_MISMATCH',
            capture_evidence: true,
            message: `Verifikasi Nomor Telepon tidak cocok (${result.reason}). Ditandai NEEDS_REVIEW.`,
          },
        };
      }
      return {
        ...base,
        nextState: 'FILL_WEBSITE',
        verificationAdded: result,
        log: {
          level: 'SUCCESS',
          message: activeRecord.phone_number
            ? `Phone number verified (${activeRecord.phone_number})`
            : 'Phone number verified (kosong sesuai CSV)',
        },
      };
    }

    case 'FILL_WEBSITE': {
      if (!activeRecord) {
        return { ...base, nextState: 'READ_NEXT_CSV_ROW', log: { level: 'WARN', message: 'Record aktif hilang.' } };
      }
      if (!activeRecord.website.trim()) {
        return {
          ...base,
          nextState: 'VERIFY_WEBSITE',
          log: {
            level: 'INFO',
            message: 'Kolom Website opsional kosong — dibiarkan kosong sesuai aturan data.',
          },
        };
      }
      return {
        ...base,
        nextState: 'VERIFY_WEBSITE',
        updatedFormValues: {
          ...ctx.formValues,
          website: activeRecord.website,
        },
        log: {
          level: 'INFO',
          message: `Mengisi field Website: "${activeRecord.website}"`,
        },
      };
    }

    case 'VERIFY_WEBSITE': {
      if (!activeRecord) {
        return { ...base, nextState: 'READ_NEXT_CSV_ROW', log: { level: 'WARN', message: 'Record aktif hilang.' } };
      }
      const conf = ctx.lowOcrConfidence ? 0.59 : 0.94;
      const result = verifyFieldReadback(
        'website',
        activeRecord.website,
        ctx.formValues.website,
        conf,
        profile.ocr_confidence_threshold
      );
      if (!result.matched) {
        return {
          ...base,
          nextState: 'MARK_NEEDS_REVIEW',
          verificationAdded: result,
          recordUpdate: {
            record_id: activeRecord.record_id,
            status: 'NEEDS_REVIEW',
            last_error: 'FIELD_MISMATCH',
            notes: `FIELD_MISMATCH pada website: ${result.reason}`,
          },
          log: {
            level: 'ERROR',
            error_code: 'FIELD_MISMATCH',
            capture_evidence: true,
            message: `Verifikasi Website gagal (${result.reason}). Ditandai NEEDS_REVIEW.`,
          },
        };
      }
      return {
        ...base,
        nextState: 'FILL_OPENING_HOURS',
        verificationAdded: result,
        log: {
          level: 'SUCCESS',
          message: activeRecord.website
            ? `Website verified (${activeRecord.website})`
            : 'Website verified (opsional kosong)',
        },
      };
    }

    case 'FILL_OPENING_HOURS': {
      if (!activeRecord) {
        return { ...base, nextState: 'READ_NEXT_CSV_ROW', log: { level: 'WARN', message: 'Record aktif hilang.' } };
      }

      // Controlled auto-scroll: scroll ONLY when opening_hours is offscreen and check scroll limit
      if (ctx.screen === 'POI_FORM_TOP') {
        if (ctx.scrollCount >= profile.max_scrolls_per_state) {
          return {
            ...base,
            nextState: 'PAUSED',
            shouldPause: true,
            log: {
              level: 'ERROR',
              error_code: 'FIELD_NOT_FOUND',
              capture_evidence: true,
              message: `Batas scroll maksimum (${profile.max_scrolls_per_state}) tercapai tanpa menemukan Jam Operasional. Jeda dan minta pemeriksaan manual.`,
            },
          };
        }
        return {
          ...base,
          nextState: 'FILL_OPENING_HOURS',
          updatedScreen: 'POI_FORM_SCROLLED',
          scrollCount: ctx.scrollCount + 1,
          log: {
            level: 'INFO',
            message: `Auto-scroll terkontrol (${ctx.scrollCount + 1}/${profile.max_scrolls_per_state}) untuk menampilkan field Jam Operasional & re-OCR layar.`,
          },
        };
      }

      if (!activeRecord.opening_hours.trim()) {
        return {
          ...base,
          nextState: 'VERIFY_OPENING_HOURS',
          log: {
            level: 'INFO',
            message: 'Jam operasional kosong pada CSV — tidak menebak jadwal.',
          },
        };
      }

      return {
        ...base,
        nextState: 'VERIFY_OPENING_HOURS',
        updatedScreen: 'POI_FORM_SCROLLED',
        updatedFormValues: {
          ...ctx.formValues,
          opening_hours: activeRecord.opening_hours,
        },
        log: {
          level: 'INFO',
          message: `Mengisi field Jam Operasional: "${activeRecord.opening_hours}"`,
        },
      };
    }

    case 'VERIFY_OPENING_HOURS': {
      if (!activeRecord) {
        return { ...base, nextState: 'READ_NEXT_CSV_ROW', log: { level: 'WARN', message: 'Record aktif hilang.' } };
      }
      const conf = ctx.lowOcrConfidence ? 0.58 : 0.94;
      const result = verifyFieldReadback(
        'opening_hours',
        activeRecord.opening_hours,
        ctx.formValues.opening_hours,
        conf,
        profile.ocr_confidence_threshold
      );
      if (!result.matched) {
        return {
          ...base,
          nextState: 'MARK_NEEDS_REVIEW',
          verificationAdded: result,
          recordUpdate: {
            record_id: activeRecord.record_id,
            status: 'NEEDS_REVIEW',
            last_error: 'FIELD_MISMATCH',
            notes: `FIELD_MISMATCH pada opening_hours: ${result.reason}`,
          },
          log: {
            level: 'ERROR',
            error_code: 'FIELD_MISMATCH',
            capture_evidence: true,
            message: `Verifikasi Jam Operasional gagal (${result.reason}). Ditandai NEEDS_REVIEW.`,
          },
        };
      }
      return {
        ...base,
        nextState: 'REVIEW_BEFORE_SUBMIT',
        verificationAdded: result,
        log: {
          level: 'SUCCESS',
          message: activeRecord.opening_hours
            ? `Opening hours verified (${activeRecord.opening_hours})`
            : 'Opening hours verified (kosong sesuai CSV)',
        },
      };
    }

    case 'REVIEW_BEFORE_SUBMIT': {
      if (ctx.automationMode === 'AUTO_SUBMIT' && ctx.autoSubmitPolicyAcknowledged) {
        return {
          ...base,
          nextState: 'SUBMIT_IF_APPROVED',
          updatedScreen: 'SUBMIT_CONFIRMATION',
          log: {
            level: 'INFO',
            message: 'Seluruh field terverifikasi. Auto-submit diaktifkan eksplisit oleh operator — melanjutkan submit.',
          },
        };
      }

      return {
        ...base,
        nextState: 'WAIT_FOR_OPERATOR_CONFIRMATION',
        updatedScreen: 'SUBMIT_CONFIRMATION',
        shouldPause: true,
        log: {
          level: 'INFO',
          message: 'Waiting for operator confirmation — periksa ringkasan CSV vs OCR lalu tekan Konfirmasi & Kirim.',
        },
      };
    }

    case 'WAIT_FOR_OPERATOR_CONFIRMATION': {
      if (!ctx.operatorApprovedSubmit) {
        return {
          ...base,
          nextState: 'WAIT_FOR_OPERATOR_CONFIRMATION',
          shouldPause: true,
          log: {
            level: 'INFO',
            message: 'Menunggu persetujuan eksplisit operator sebelum menekan tombol Kirim.',
          },
        };
      }
      return {
        ...base,
        nextState: 'SUBMIT_IF_APPROVED',
        log: {
          level: 'INFO',
          message: 'Operator menyetujui pengiriman. Mengeksekusi aksi Submit satu kali.',
        },
      };
    }

    case 'SUBMIT_IF_APPROVED': {
      // Never auto-retry submit! Transition directly to VERIFY_RESULT.
      const nextScreen: ScreenType =
        ctx.injectedFault === 'SUBMIT_UNCONFIRMED' ? 'SUBMIT_UNCERTAIN' : 'SUBMIT_SUCCESS';
      return {
        ...base,
        nextState: 'VERIFY_RESULT',
        updatedScreen: nextScreen,
        consumeInjectedFault: ctx.injectedFault === 'SUBMIT_UNCONFIRMED',
        log: {
          level: 'INFO',
          message: 'Tombol Kirim ditekan. Memverifikasi respons layar aplikasi Grab...',
        },
      };
    }

    case 'VERIFY_RESULT': {
      if (!activeRecord) {
        return { ...base, nextState: 'READ_NEXT_CSV_ROW', log: { level: 'WARN', message: 'Record aktif hilang.' } };
      }

      if (ctx.screen === 'SUBMIT_SUCCESS') {
        return {
          ...base,
          nextState: 'MARK_SUCCESS',
          recordUpdate: {
            record_id: activeRecord.record_id,
            status: 'SUCCESS',
            last_error: null,
            notes: 'Terverifikasi berhasil terkirim pada formulir POI',
          },
          log: {
            level: 'SUCCESS',
            message: `Pengiriman terkonfirmasi untuk "${activeRecord.poi_name}".`,
          },
        };
      }

      // PRD Rule: Never retry submit if result is uncertain; mark NEEDS_REVIEW
      return {
        ...base,
        nextState: 'MARK_NEEDS_REVIEW',
        recordUpdate: {
          record_id: activeRecord.record_id,
          status: 'NEEDS_REVIEW',
          last_error: 'SUBMIT_UNCONFIRMED',
          notes: 'SUBMIT_UNCONFIRMED — tidak dilakukan retry otomatis demi mencegah duplikat',
        },
        log: {
          level: 'WARN',
          error_code: 'SUBMIT_UNCONFIRMED',
          capture_evidence: true,
          message: `Hasil submit untuk "${activeRecord.poi_name}" tidak dapat dipastikan. Ditandai NEEDS_REVIEW tanpa retry otomatis.`,
        },
      };
    }

    case 'MARK_SUCCESS': {
      return {
        ...base,
        nextState: 'SAVE_CHECKPOINT',
        log: {
          level: 'SUCCESS',
          message: `Baris #${activeRecord?.source_row_number ?? '-'} diperbarui menjadi SUCCESS.`,
        },
      };
    }

    case 'MARK_NEEDS_REVIEW': {
      return {
        ...base,
        nextState: 'SAVE_CHECKPOINT',
        log: {
          level: 'WARN',
          message: `Baris #${activeRecord?.source_row_number ?? '-'} ditandai NEEDS_REVIEW untuk pemeriksaan manual.`,
        },
      };
    }

    case 'SAVE_CHECKPOINT': {
      return {
        ...base,
        nextState: 'READ_NEXT_CSV_ROW',
        updatedScreen: 'POI_FORM_TOP',
        updatedFormValues: {
          poi_name: '',
          phone_number: '',
          website: '',
          opening_hours: '',
        },
        activeRecordId: null,
        scrollCount: 0,
        fieldRetryCount: 0,
        log: {
          level: 'INFO',
          message: 'Checkpoint tersimpan ke database lokal. Melanjutkan ke baris berikutnya.',
        },
      };
    }

    default:
      return {
        ...base,
        nextState: ctx.state,
        shouldPause: true,
        log: {
          level: 'INFO',
          message: `State saat ini: ${ctx.state}`,
        },
      };
  }
}
