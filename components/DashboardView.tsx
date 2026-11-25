'use client';

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Hand,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Square,
  Upload,
} from 'lucide-react';
import type {
  AppSettings,
  AutomationLog,
  AutomationMode,
  DeviceInfo,
  FieldVerificationResult,
  Job,
  MockFormValues,
  PoiRecord,
  ScreenType,
  WorkflowProfile,
  WorkflowState,
} from '@/lib/types';
import { AdbStateText, RecordStatusText } from './StatusIndicator';
import AndroidMirrorPanel from './AndroidMirrorPanel';

interface DashboardViewProps {
  activeJob: Job | null;
  records: PoiRecord[];
  logs: AutomationLog[];
  device: DeviceInfo;
  screen: ScreenType;
  formValues: MockFormValues;
  workflowState: WorkflowState;
  isRunning: boolean;
  activeRecord: PoiRecord | null;
  verifications: FieldVerificationResult[];
  profile: WorkflowProfile;
  settings: AppSettings;
  showOcrOverlay: boolean;
  lowConfidence: boolean;
  manualTakeoverActive: boolean;
  selectedRecordIds: string[];
  recoveredCount: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRetryFailed: () => void;
  onProcessSelected: () => void;
  onManualTakeover: () => void;
  onCompleteManualTakeover: () => void;
  onConfirmSubmit: () => void;
  onMarkActiveNeedsReview: () => void;
  onModeChange: (mode: AutomationMode) => void;
  onRefreshDevice: () => void;
  onConnectDevice: () => void;
  onToggleScrcpy: () => void;
  onTakeScreenshot: () => void;
  onToggleOcrOverlay: () => void;
  onManualFormChange: (field: keyof MockFormValues, value: string) => void;
  onManualScreenChange: (screen: ScreenType) => void;
  onOpenImportCsv: () => void;
  onOpenAiAssist: () => void;
  onDismissRecoveryBanner: () => void;
}

function formatLogTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '00:00:00';
  }
}

export default function DashboardView({
  activeJob,
  records,
  logs,
  device,
  screen,
  formValues,
  workflowState,
  isRunning,
  activeRecord,
  verifications,
  profile,
  settings,
  showOcrOverlay,
  lowConfidence,
  manualTakeoverActive,
  selectedRecordIds,
  recoveredCount,
  onStart,
  onPause,
  onResume,
  onStop,
  onRetryFailed,
  onProcessSelected,
  onManualTakeover,
  onCompleteManualTakeover,
  onConfirmSubmit,
  onMarkActiveNeedsReview,
  onModeChange,
  onRefreshDevice,
  onConnectDevice,
  onToggleScrcpy,
  onTakeScreenshot,
  onToggleOcrOverlay,
  onManualFormChange,
  onManualScreenChange,
  onOpenImportCsv,
  onOpenAiAssist,
  onDismissRecoveryBanner,
}: DashboardViewProps) {
  const counts = {
    total: records.length,
    pending: records.filter((r) => r.status === 'PENDING').length,
    inProgress: records.filter((r) => r.status === 'IN_PROGRESS').length,
    success: records.filter((r) => r.status === 'SUCCESS').length,
    skipped: records.filter((r) => r.status === 'SKIPPED').length,
    needsReview: records.filter((r) => r.status === 'NEEDS_REVIEW').length,
    failed: records.filter((r) => r.status === 'FAILED').length,
  };

  const processedCount =
    counts.success + counts.skipped + counts.needsReview + counts.failed;
  const progressPct =
    counts.total > 0 ? Math.round((processedCount / counts.total) * 100) : 0;

  const isWaitingConfirmation = workflowState === 'WAIT_FOR_OPERATOR_CONFIRMATION';
  const isPaused = workflowState === 'PAUSED' || workflowState === 'WAITING_FOR_OPERATOR';
  const hasFailedOrReview = counts.failed > 0 || counts.needsReview > 0;

  return (
    <div className="space-y-6">
      {/* Crash Recovery Banner (PRD Section 12) */}
      {recoveredCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800/80 dark:bg-amber-950/40">
          <div className="flex items-center gap-2.5 text-sm text-amber-950 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <span>
              Pemulihan checkpoint aktif: <strong>{recoveredCount}</strong> baris yang sebelumnya{' '}
              <code className="font-mono text-xs">IN_PROGRESS</code> diubah ke{' '}
              <code className="font-mono text-xs">NEEDS_REVIEW</code> untuk mencegah duplikasi submit.
            </span>
          </div>
          <button
            type="button"
            onClick={onDismissRecoveryBanner}
            className="text-xs font-medium text-amber-900 underline dark:text-amber-300 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Progress Strip (PRD Section 11C) */}
      <section
        aria-label="Ringkasan Progres Batch"
        className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {activeJob ? activeJob.source_filename : 'Belum Ada File CSV'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {activeJob
                ? `Job ${activeJob.job_id} · Delimiter "${activeJob.delimiter}" · State: ${workflowState}`
                : 'Impor file CSV UTF-8 untuk memulai antrean pengisian POI.'}
            </p>
          </div>
          <div className="flex items-center gap-3 text-right">
            <span className="font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {progressPct}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {processedCount}/{counts.total} baris
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-[#008844] dark:bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* 7 Metric Columns separated cleanly */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 pt-1">
          <MetricCell label="Total" value={counts.total} />
          <MetricCell label="Pending" value={counts.pending} />
          <MetricCell label="In Progress" value={counts.inProgress} tone="blue" />
          <MetricCell label="Success" value={counts.success} tone="emerald" />
          <MetricCell label="Skipped" value={counts.skipped} tone="muted" />
          <MetricCell label="Needs Review" value={counts.needsReview} tone="amber" />
          <MetricCell label="Failed" value={counts.failed} tone="red" />
        </div>
      </section>

      {/* Automation Controls Bar (PRD Section 11D) */}
      <section
        aria-label="Kontrol Otomasi"
        className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] p-4 flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          {!isRunning && !isPaused && !isWaitingConfirmation && (
            <button
              type="button"
              onClick={onStart}
              disabled={counts.pending === 0 && selectedRecordIds.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#008844] text-white hover:bg-[#007038] disabled:opacity-45 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" />
              Start
            </button>
          )}

          {isRunning && (
            <button
              type="button"
              onClick={onPause}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Pause className="h-3.5 w-3.5" />
              Pause
            </button>
          )}

          {isPaused && (
            <button
              type="button"
              onClick={onResume}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#008844] text-white hover:bg-[#007038] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" />
              Resume
            </button>
          )}

          <button
            type="button"
            onClick={onStop}
            disabled={workflowState === 'IDLE' || workflowState === 'STOPPED'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </button>

          <button
            type="button"
            onClick={onManualTakeover}
            disabled={manualTakeoverActive || device.adb_state !== 'device'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Hand className="h-3.5 w-3.5" />
            Manual Takeover
          </button>

          <button
            type="button"
            onClick={onRetryFailed}
            disabled={!hasFailedOrReview || isRunning}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry Failed
          </button>

          {selectedRecordIds.length > 0 && (
            <button
              type="button"
              onClick={onProcessSelected}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-emerald-600/40 text-emerald-800 hover:bg-emerald-50 disabled:opacity-40 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-950/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Process Selected ({selectedRecordIds.length})
            </button>
          )}
        </div>

        {/* Mode Toggle + Optional AI */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Mode Pengiriman Formulir"
            className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900"
          >
            <button
              type="button"
              onClick={() => onModeChange('ASSISTED')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                settings.automation_mode === 'ASSISTED'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Assisted Mode
            </button>
            <button
              type="button"
              onClick={() => onModeChange('AUTO_SUBMIT')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                settings.automation_mode === 'AUTO_SUBMIT'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Auto-submit
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenAiAssist}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Asisten AI
          </button>
        </div>
      </section>

      {/* Main 2-Column Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Current Task + Confirmation + Live Activity Log */}
        <div className="lg:col-span-7 space-y-6">
          {/* Current Task Panel (PRD Section 11F) */}
          <section
            aria-label="Tugas Saat Ini"
            className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Current Task & Verifikasi Field
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  State: {workflowState}
                </p>
              </div>
              {activeRecord && <RecordStatusText status={activeRecord.status} />}
            </div>

            <div className="p-5 space-y-4">
              {activeRecord ? (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Baris #{activeRecord.source_row_number} · ID {activeRecord.record_id}
                      </p>
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                        {activeRecord.poi_name}
                      </h4>
                    </div>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      Attempt #{activeRecord.attempt_count}
                    </span>
                  </div>

                  {/* Verification Comparison Table */}
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                    <table className="w-full table-fixed text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2 px-2.5 font-medium w-[23%]">Field</th>
                          <th className="py-2 px-2.5 font-medium w-[31%]">Nilai CSV</th>
                          <th className="py-2 px-2.5 font-medium w-[31%]">Baca Ulang OCR</th>
                          <th className="py-2 px-2.5 font-medium text-right w-[15%]">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {(
                          [
                            ['poi_name', 'Nama Tempat'],
                            ['phone_number', 'Nomor Telepon'],
                            ['website', 'Website'],
                            ['opening_hours', 'Jam Operasional'],
                          ] as const
                        ).map(([key, label]) => {
                          const v = verifications.find((item) => item.field === key);
                          const expected = activeRecord[key];
                          const observed = formValues[key];
                          return (
                            <tr key={key}>
                              <td className="py-2 px-2.5 font-medium text-slate-700 dark:text-slate-300 truncate">
                                {label}
                              </td>
                              <td
                                title={expected || '(kosong)'}
                                className="py-2 px-2.5 font-mono text-slate-900 dark:text-slate-100 truncate"
                              >
                                {expected || <span className="text-slate-400">(kosong)</span>}
                              </td>
                              <td
                                title={observed || '—'}
                                className="py-2 px-2.5 font-mono text-slate-700 dark:text-slate-300 truncate"
                              >
                                {observed || <span className="text-slate-400">—</span>}
                              </td>
                              <td className="py-2 px-2.5 text-right whitespace-nowrap">
                                {v ? (
                                  v.matched ? (
                                    <span className="inline-flex items-center gap-1 font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                      {Math.round(v.confidence * 100)}%
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-mono text-red-700 dark:text-red-400">
                                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                      Mismatch
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-400 font-mono">Menunggu</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Operator Confirmation Action Box (Assisted Mode Gate) */}
                  {isWaitingConfirmation && (
                    <div
                      data-testid="operator-confirmation-gate"
                      className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30 space-y-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <ShieldAlert className="h-4 w-4 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
                        <div className="text-xs text-slate-800 dark:text-slate-200">
                          <p className="font-semibold">
                            Konfirmasi Operator Diperlukan (Assisted Mode)
                          </p>
                          <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                            Seluruh field telah diisi dan diverifikasi oleh OCR. Periksa kecocokan data pada
                            tabel dan layar scrcpy sebelum menekan tombol Kirim.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={onConfirmSubmit}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#008844] text-white hover:bg-[#007038] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Konfirmasi & Kirim
                        </button>
                        <button
                          type="button"
                          onClick={onManualTakeover}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Hand className="h-3.5 w-3.5" />
                          Edit Manual
                        </button>
                        <button
                          type="button"
                          onClick={onMarkActiveNeedsReview}
                          className="px-3 py-2 text-xs font-medium rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Tandai NEEDS_REVIEW
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-6 text-center space-y-3">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {counts.pending > 0
                      ? `${counts.pending} baris POI siap diproses dalam Assisted Mode.`
                      : 'Tidak ada baris PENDING pada antrean saat ini.'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Pastikan perangkat Android terhubung via ADB dan halaman formulir POI Grab sudah terbuka,
                    lalu tekan <strong>Start</strong> untuk memproses satu per satu dengan verifikasi OCR.
                  </p>
                  {counts.total === 0 && (
                    <button
                      type="button"
                      onClick={onOpenImportCsv}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#008844] text-white hover:bg-[#007038] cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Import CSV
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Live Activity Log (PRD Section 11E) */}
          <section
            aria-label="Log Aktivitas Real-Time"
            className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Live Activity Log
              </h3>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {logs.length} entri tersimpan
              </span>
            </div>
            <div
              data-testid="live-activity-log"
              className="max-h-[290px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-xs"
            >
              {logs.length === 0 ? (
                <div className="p-6 text-center text-slate-500 dark:text-slate-400 font-sans">
                  Belum ada aktivitas tercatat.
                </div>
              ) : (
                logs.slice(0, 40).map((log) => (
                  <div
                    key={log.log_id}
                    className="px-4 py-2.5 flex items-start gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-900/40"
                  >
                    <span className="text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                      {formatLogTime(log.timestamp)}
                    </span>
                    <span
                      className={`shrink-0 w-16 font-semibold ${
                        log.level === 'SUCCESS'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : log.level === 'ERROR'
                            ? 'text-red-700 dark:text-red-400'
                            : log.level === 'WARN'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {log.level}
                    </span>
                    <p className="text-slate-800 dark:text-slate-200 font-sans leading-relaxed break-words flex-1">
                      {log.error_code && (
                        <span className="font-mono text-red-700 dark:text-red-400 mr-1.5">
                          [{log.error_code}]
                        </span>
                      )}
                      {log.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right Column (5 cols): Device Connection Strip + Live Android scrcpy Mirror */}
        <div className="lg:col-span-5 space-y-6">
          {/* Device Connection Panel (PRD Section 11A) */}
          <section
            aria-label="Koneksi Perangkat Android"
            className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Device Connection (ADB)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                  {device.model}
                </p>
              </div>
              <AdbStateText state={device.adb_state} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Serial</span>
                <span className="font-mono text-slate-900 dark:text-slate-100">{device.serial}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Resolusi</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {device.resolution}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onRefreshDevice}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <button
                type="button"
                onClick={onConnectDevice}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {device.adb_state === 'device' ? 'Reconnect ADB' : 'Connect Device'}
              </button>
            </div>
          </section>

          {/* Interactive scrcpy Mirror & OCR Overlay */}
          <AndroidMirrorPanel
            device={device}
            screen={screen}
            formValues={formValues}
            workflowState={workflowState}
            showOcrOverlay={showOcrOverlay}
            onToggleOcrOverlay={onToggleOcrOverlay}
            lowConfidence={lowConfidence}
            ocrThreshold={profile.ocr_confidence_threshold}
            manualTakeoverActive={manualTakeoverActive}
            onManualFormChange={onManualFormChange}
            onManualScreenChange={onManualScreenChange}
            onTakeScreenshot={onTakeScreenshot}
            onToggleScrcpy={onToggleScrcpy}
            onCompleteManualTakeover={onCompleteManualTakeover}
          />
        </div>
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'emerald' | 'blue' | 'amber' | 'red' | 'muted';
}) {
  const valueColor =
    tone === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'blue'
        ? 'text-blue-700 dark:text-blue-400'
        : tone === 'amber'
          ? 'text-amber-700 dark:text-amber-400'
          : tone === 'red'
            ? 'text-red-700 dark:text-red-400'
            : tone === 'muted'
              ? 'text-slate-500 dark:text-slate-400'
              : 'text-slate-900 dark:text-slate-100';

  return (
    <div className="px-3 py-2 first:pl-0">
      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{label}</p>
      <p className={`mt-1 text-xl font-semibold font-mono tabular-nums ${valueColor}`}>
        {value}
      </p>
    </div>
  );
}
