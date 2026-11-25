import type {
  AppSettings,
  DeviceInfo,
  MockFormValues,
  OcrBox,
  ScreenType,
  ScreenshotEvidence,
  WorkflowProfile,
} from './types';

export const DEFAULT_WORKFLOW_PROFILE: WorkflowProfile = {
  profile_name: 'Grab POI Form — Calibrated Profile (1080×2400)',
  target_resolution: '1080x2400',
  ocr_confidence_threshold: 0.82,
  max_retries_non_final: 2,
  max_scrolls_per_state: 3,
  action_timeout_ms: 8000,
  fields: [
    {
      key: 'poi_name',
      label_patterns: ['Nama Tempat', 'Place Name', 'POI Name'],
      required: true,
      requires_scroll: false,
      anchor_pct: { x: 50, y: 27 },
      verify_normalization: 'trim_case',
    },
    {
      key: 'phone_number',
      label_patterns: ['Nomor Telepon', 'Phone Number', 'No. Telepon'],
      required: false,
      requires_scroll: false,
      anchor_pct: { x: 50, y: 45 },
      verify_normalization: 'phone_digits',
    },
    {
      key: 'website',
      label_patterns: ['Website', 'Situs Web', 'URL'],
      required: false,
      requires_scroll: false,
      anchor_pct: { x: 50, y: 63 },
      verify_normalization: 'url_clean',
    },
    {
      key: 'opening_hours',
      label_patterns: ['Jam Operasional', 'Opening Hours', 'Jam Buka'],
      required: false,
      requires_scroll: true,
      anchor_pct: { x: 50, y: 48 },
      verify_normalization: 'schedule_clean',
    },
  ],
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  adb_executable_path: 'adb',
  scrcpy_executable_path: 'scrcpy',
  scrcpy_options: {
    max_size: 1280,
    max_fps: 30,
    no_audio: true,
    stay_awake: true,
    always_on_top: false,
    turn_screen_off: false,
  },
  automation_mode: 'ASSISTED',
  auto_submit_policy_acknowledged: false,
  skip_existing_success: true,
  step_delay_ms: 520,
  ai_assistance_enabled: false,
  ai_consent_granted: false,
};

export const INITIAL_MOCK_DEVICES: DeviceInfo[] = [
  {
    serial: 'R58T31MOCK01',
    model: 'Samsung Galaxy A54 (Mock ADB)',
    android_version: 'Android 14 (API 34)',
    resolution: '1080x2400',
    adb_state: 'device',
    adb_path: 'C:\\platform-tools\\adb.exe',
    scrcpy_running: false,
    scrcpy_pid: null,
    is_mock: true,
  },
  {
    serial: 'PIXEL7UNAUTH02',
    model: 'Google Pixel 7 (Simulasi Unauthorized)',
    android_version: 'Android 14 (API 34)',
    resolution: '1080x2400',
    adb_state: 'unauthorized',
    adb_path: 'C:\\platform-tools\\adb.exe',
    scrcpy_running: false,
    scrcpy_pid: null,
    is_mock: true,
  },
];

export const EMPTY_FORM_VALUES: MockFormValues = {
  poi_name: '',
  phone_number: '',
  website: '',
  opening_hours: '',
};

export function getScreenMeta(screen: ScreenType): {
  title: string;
  recognized: boolean;
  isSecurityChallenge: boolean;
  baseConfidence: number;
} {
  switch (screen) {
    case 'GRAB_HOME':
      return {
        title: 'Grab — Beranda Kontribusi POI',
        recognized: true,
        isSecurityChallenge: false,
        baseConfidence: 0.96,
      };
    case 'POI_FORM_TOP':
      return {
        title: 'Formulir Tambah POI (Bagian Atas)',
        recognized: true,
        isSecurityChallenge: false,
        baseConfidence: 0.95,
      };
    case 'POI_FORM_SCROLLED':
      return {
        title: 'Formulir Tambah POI (Setelah Scroll)',
        recognized: true,
        isSecurityChallenge: false,
        baseConfidence: 0.94,
      };
    case 'SUBMIT_CONFIRMATION':
      return {
        title: 'Ringkasan Sebelum Kirim',
        recognized: true,
        isSecurityChallenge: false,
        baseConfidence: 0.96,
      };
    case 'SUBMIT_SUCCESS':
      return {
        title: 'POI Berhasil Dikirim',
        recognized: true,
        isSecurityChallenge: false,
        baseConfidence: 0.97,
      };
    case 'SUBMIT_UNCERTAIN':
      return {
        title: 'Status Pengiriman Tidak Terkonfirmasi',
        recognized: true,
        isSecurityChallenge: false,
        baseConfidence: 0.72,
      };
    case 'SECURITY_DIALOG_OTP':
      return {
        title: 'Dialog Verifikasi OTP Terdeteksi',
        recognized: true,
        isSecurityChallenge: true,
        baseConfidence: 0.98,
      };
    case 'SECURITY_DIALOG_CAPTCHA':
      return {
        title: 'Tantangan Keamanan CAPTCHA Terdeteksi',
        recognized: true,
        isSecurityChallenge: true,
        baseConfidence: 0.97,
      };
    case 'PERMISSION_DIALOG':
      return {
        title: 'Dialog Izin Sistem Android',
        recognized: true,
        isSecurityChallenge: true,
        baseConfidence: 0.95,
      };
    case 'SCREEN_UNKNOWN':
    default:
      return {
        title: 'Layar Tidak Dikenali',
        recognized: false,
        isSecurityChallenge: false,
        baseConfidence: 0.41,
      };
  }
}

/**
 * Generate realistic OCR bounding boxes for the current mock screen and form values.
 */
export function buildOcrDetections(
  screen: ScreenType,
  formValues: MockFormValues,
  lowConfidenceOverride = false
): OcrBox[] {
  const conf = (base: number) =>
    lowConfidenceOverride ? Math.max(0.42, Number((base - 0.35).toFixed(2))) : base;

  if (screen === 'POI_FORM_TOP') {
    return [
      {
        id: 'ocr_poi_name',
        label: 'Nama Tempat *',
        detected_text: formValues.poi_name || '(kosong)',
        confidence: conf(0.96),
        field_key: 'poi_name',
        bbox: { x: 7, y: 20, w: 86, h: 15 },
      },
      {
        id: 'ocr_phone',
        label: 'Nomor Telepon',
        detected_text: formValues.phone_number || '(kosong)',
        confidence: conf(0.95),
        field_key: 'phone_number',
        bbox: { x: 7, y: 39, w: 86, h: 15 },
      },
      {
        id: 'ocr_website',
        label: 'Website',
        detected_text: formValues.website || '(kosong)',
        confidence: conf(0.94),
        field_key: 'website',
        bbox: { x: 7, y: 58, w: 86, h: 15 },
      },
    ];
  }

  if (screen === 'POI_FORM_SCROLLED') {
    return [
      {
        id: 'ocr_website_top',
        label: 'Website',
        detected_text: formValues.website || '(kosong)',
        confidence: conf(0.93),
        field_key: 'website',
        bbox: { x: 7, y: 18, w: 86, h: 14 },
      },
      {
        id: 'ocr_opening_hours',
        label: 'Jam Operasional',
        detected_text: formValues.opening_hours || '(kosong)',
        confidence: conf(0.94),
        field_key: 'opening_hours',
        bbox: { x: 7, y: 37, w: 86, h: 16 },
      },
      {
        id: 'ocr_submit_btn',
        label: 'Kirim Data POI',
        detected_text: 'Kirim Data POI',
        confidence: conf(0.97),
        field_key: 'submit_button',
        bbox: { x: 7, y: 78, w: 86, h: 11 },
      },
    ];
  }

  if (screen === 'SUBMIT_CONFIRMATION') {
    return [
      {
        id: 'ocr_confirm_title',
        label: 'Konfirmasi Kirim POI',
        detected_text: formValues.poi_name,
        confidence: conf(0.96),
        field_key: 'poi_name',
        bbox: { x: 8, y: 22, w: 84, h: 44 },
      },
      {
        id: 'ocr_confirm_btn',
        label: 'Kirim Sekarang',
        detected_text: 'Kirim Sekarang',
        confidence: conf(0.98),
        field_key: 'submit_button',
        bbox: { x: 8, y: 76, w: 84, h: 11 },
      },
    ];
  }

  if (
    screen === 'SECURITY_DIALOG_OTP' ||
    screen === 'SECURITY_DIALOG_CAPTCHA' ||
    screen === 'PERMISSION_DIALOG'
  ) {
    return [
      {
        id: 'ocr_dialog_alert',
        label:
          screen === 'SECURITY_DIALOG_OTP'
            ? 'Verifikasi OTP Diperlukan'
            : screen === 'SECURITY_DIALOG_CAPTCHA'
              ? 'Verifikasi Keamanan (CAPTCHA)'
              : 'Izinkan Akses Lokasi?',
        detected_text: 'Aksi manual operator dibutuhkan',
        confidence: 0.98,
        field_key: 'dialog_alert',
        bbox: { x: 10, y: 32, w: 80, h: 34 },
      },
    ];
  }

  if (screen === 'SCREEN_UNKNOWN') {
    return [
      {
        id: 'ocr_unknown',
        label: 'Konten Tidak Dikenali',
        detected_text: 'Tidak cocok dengan template workflow',
        confidence: 0.41,
        bbox: { x: 12, y: 28, w: 76, h: 30 },
      },
    ];
  }

  return [
    {
      id: 'ocr_home',
      label: screen === 'SUBMIT_SUCCESS' ? 'Data POI Terkirim' : 'Tambah Tempat Baru',
      detected_text:
        screen === 'SUBMIT_SUCCESS' ? 'Tersimpan & Terverifikasi' : 'Siap membuka formulir POI',
      confidence: conf(0.96),
      bbox: { x: 10, y: 35, w: 80, h: 20 },
    },
  ];
}

export function createScreenshotEvidence(
  device: DeviceInfo,
  screen: ScreenType,
  formValues: MockFormValues,
  note: string,
  lowConfidence = false
): ScreenshotEvidence {
  const meta = getScreenMeta(screen);
  const ocr = buildOcrDetections(screen, formValues, lowConfidence);
  const avgConfidence =
    ocr.length > 0
      ? Number((ocr.reduce((acc, item) => acc + item.confidence, 0) / ocr.length).toFixed(2))
      : meta.baseConfidence;

  return {
    id: `shot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    captured_at: new Date().toISOString(),
    device_serial: device.serial,
    resolution: device.resolution,
    screen_type: screen,
    confidence: avgConfidence,
    ocr_summary: ocr.map((o) => `${o.label}: ${o.detected_text}`).join(' | '),
    form_values: { ...formValues },
    note,
  };
}

export function formatAdbCommandPreview(deviceSerial: string): string[] {
  const serial = deviceSerial || 'DEVICE_SERIAL';
  return [
    'adb devices',
    `adb -s ${serial} get-state`,
    `adb -s ${serial} shell wm size`,
    `adb -s ${serial} shell screencap -p /sdcard/screen.png`,
    `adb -s ${serial} pull /sdcard/screen.png ./screen.png`,
  ];
}
