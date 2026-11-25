export type RecordStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SUCCESS'
  | 'SKIPPED'
  | 'NEEDS_REVIEW'
  | 'FAILED';

export type JobStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED';

export type AdbConnectionState = 'device' | 'unauthorized' | 'offline' | 'disconnected';

export type AutomationMode = 'ASSISTED' | 'AUTO_SUBMIT';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

export type ErrorCode =
  | 'DEVICE_NOT_FOUND'
  | 'DEVICE_UNAUTHORIZED'
  | 'DEVICE_OFFLINE'
  | 'SCRCPY_FAILED'
  | 'CSV_INVALID'
  | 'SCREEN_UNKNOWN'
  | 'FIELD_NOT_FOUND'
  | 'FIELD_MISMATCH'
  | 'SUBMIT_UNCONFIRMED'
  | 'APP_UNEXPECTED_DIALOG';

export type WorkflowState =
  | 'IDLE'
  | 'DEVICE_CHECK'
  | 'WAITING_FOR_OPERATOR'
  | 'SCREEN_CHECK'
  | 'OPEN_POI_FORM'
  | 'READ_NEXT_CSV_ROW'
  | 'VALIDATE_ROW'
  | 'MARK_SKIPPED'
  | 'FILL_POI_NAME'
  | 'VERIFY_POI_NAME'
  | 'FILL_PHONE'
  | 'VERIFY_PHONE'
  | 'FILL_WEBSITE'
  | 'VERIFY_WEBSITE'
  | 'FILL_OPENING_HOURS'
  | 'VERIFY_OPENING_HOURS'
  | 'REVIEW_BEFORE_SUBMIT'
  | 'WAIT_FOR_OPERATOR_CONFIRMATION'
  | 'SUBMIT_IF_APPROVED'
  | 'VERIFY_RESULT'
  | 'MARK_SUCCESS'
  | 'MARK_NEEDS_REVIEW'
  | 'SAVE_CHECKPOINT'
  | 'PAUSED'
  | 'MANUAL_TAKEOVER'
  | 'STOPPED';

export type ScreenType =
  | 'GRAB_HOME'
  | 'POI_FORM_TOP'
  | 'POI_FORM_SCROLLED'
  | 'SUBMIT_CONFIRMATION'
  | 'SUBMIT_SUCCESS'
  | 'SUBMIT_UNCERTAIN'
  | 'SCREEN_UNKNOWN'
  | 'SECURITY_DIALOG_OTP'
  | 'SECURITY_DIALOG_CAPTCHA'
  | 'PERMISSION_DIALOG';

export interface PoiRecord {
  record_id: string;
  job_id: string;
  source_row_number: number;
  poi_name: string;
  phone_number: string;
  website: string;
  opening_hours: string;
  status: RecordStatus;
  notes: string;
  attempt_count: number;
  last_error: ErrorCode | null;
  updated_at: string;
}

export interface Job {
  job_id: string;
  source_filename: string;
  delimiter: ',' | ';';
  created_at: string;
  updated_at: string;
  total_rows: number;
  job_status: JobStatus;
}

export interface AutomationLog {
  log_id: string;
  job_id: string;
  record_id: string | null;
  timestamp: string;
  level: LogLevel;
  state: WorkflowState;
  error_code?: ErrorCode | null;
  message: string;
  screenshot_snapshot?: ScreenshotEvidence | null;
}

export interface ScreenshotEvidence {
  id: string;
  captured_at: string;
  device_serial: string;
  resolution: string;
  screen_type: ScreenType;
  confidence: number;
  ocr_summary: string;
  form_values: MockFormValues;
  note: string;
}

export interface MockFormValues {
  poi_name: string;
  phone_number: string;
  website: string;
  opening_hours: string;
}

export interface DeviceInfo {
  serial: string;
  model: string;
  android_version: string;
  resolution: string;
  adb_state: AdbConnectionState;
  adb_path: string;
  scrcpy_running: boolean;
  scrcpy_pid: number | null;
  is_mock: boolean;
}

export interface OcrBox {
  id: string;
  label: string;
  detected_text: string;
  confidence: number;
  field_key?: keyof MockFormValues | 'submit_button' | 'dialog_alert';
  bbox: { x: number; y: number; w: number; h: number }; // percentage 0..100 for resolution independence
}

export interface FieldCalibration {
  key: keyof MockFormValues;
  label_patterns: string[];
  required: boolean;
  requires_scroll: boolean;
  anchor_pct: { x: number; y: number };
  verify_normalization: 'trim_case' | 'phone_digits' | 'url_clean' | 'schedule_clean';
}

export interface WorkflowProfile {
  profile_name: string;
  target_resolution: string;
  ocr_confidence_threshold: number;
  max_retries_non_final: number;
  max_scrolls_per_state: number;
  action_timeout_ms: number;
  fields: FieldCalibration[];
}

export interface ScrcpyLaunchOptions {
  max_size: 0 | 720 | 1024 | 1280 | 1600 | 1920;
  max_fps: 15 | 30 | 60;
  no_audio: boolean;
  stay_awake: boolean;
  always_on_top: boolean;
  turn_screen_off: boolean;
}

export interface LocalScrcpyDiagnostics {
  adb_available: boolean;
  adb_path: string;
  adb_version: string | null;
  scrcpy_available: boolean;
  scrcpy_path: string;
  scrcpy_version: string | null;
  devices: DeviceInfo[];
  message: string;
  troubleshooting_tips: string[];
  source: 'server_local' | 'pc_bridge';
}

export interface AppSettings {
  adb_executable_path: string;
  scrcpy_executable_path: string;
  scrcpy_options?: ScrcpyLaunchOptions;
  automation_mode: AutomationMode;
  auto_submit_policy_acknowledged: boolean;
  skip_existing_success: boolean;
  step_delay_ms: number;
  ai_assistance_enabled: boolean;
  ai_consent_granted: boolean;
}

export interface PersistedWorkspaceState {
  jobs: Job[];
  active_job_id: string | null;
  records: PoiRecord[];
  logs: AutomationLog[];
  workflow_profile: WorkflowProfile;
  app_settings: AppSettings;
  recovered_interrupted_count?: number;
}

export interface CsvPreviewResult {
  valid: boolean;
  delimiter: ',' | ';';
  headers: string[];
  missing_required_headers: string[];
  added_columns: string[];
  rows: Omit<PoiRecord, 'job_id' | 'updated_at'>[];
  summary: {
    total: number;
    ready: number;
    skipped: number;
    needs_review: number;
    already_success: number;
  };
  errors: string[];
}

export interface FieldVerificationResult {
  field: keyof MockFormValues;
  expected: string;
  observed: string;
  matched: boolean;
  confidence: number;
  reason?: string;
}

export interface AiScheduleInterpretation {
  normalized_schedule: string;
  days: string[];
  open_time: string;
  close_time: string;
  mappable: boolean;
  local_validation_passed: boolean;
  local_validation_notes: string;
  explanation: string;
}

export interface AiErrorExplanation {
  error_code: string;
  summary: string;
  safe_recovery_steps: string[];
  requires_manual_operator: boolean;
  local_validation_passed: boolean;
}
