'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, Sparkles, X } from 'lucide-react';
import type {
  AiErrorExplanation,
  AiScheduleInterpretation,
  AppSettings,
  ErrorCode,
} from '@/lib/types';

interface AiAssistModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateConsent: (enabled: boolean, consent: boolean) => void;
  initialScheduleText?: string;
  initialErrorCode?: ErrorCode | null;
  initialErrorMessage?: string;
  currentScreenTitle: string;
  onApplyNormalizedSchedule?: (normalized: string) => void;
}

export default function AiAssistModal({
  open,
  onClose,
  settings,
  onUpdateConsent,
  initialScheduleText = '',
  initialErrorCode = null,
  initialErrorMessage = '',
  currentScreenTitle,
  onApplyNormalizedSchedule,
}: AiAssistModalProps) {
  const [tab, setTab] = useState<'schedule' | 'error'>(
    initialErrorCode ? 'error' : 'schedule'
  );
  const [scheduleInput, setScheduleInput] = useState(
    initialScheduleText || 'Senin sampai Jumat jam 08.30 - 17.30 WIB'
  );
  const [errorCodeInput, setErrorCodeInput] = useState<string>(
    initialErrorCode || 'SCREEN_UNKNOWN'
  );
  const [errorMsgInput, setErrorMsgInput] = useState(
    initialErrorMessage || 'Layar tidak dikenali oleh template workflow setelah scroll.'
  );
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [scheduleResult, setScheduleResult] = useState<AiScheduleInterpretation | null>(null);
  const [errorResult, setErrorResult] = useState<AiErrorExplanation | null>(null);

  if (!open) return null;

  const canCallAi = settings.ai_assistance_enabled && settings.ai_consent_granted;

  async function handleInterpretSchedule() {
    setLoading(true);
    setApiError(null);
    setScheduleResult(null);
    try {
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentGranted: canCallAi,
          task: 'interpret_opening_hours',
          rawSchedule: scheduleInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || 'Gagal menganalisis jadwal.');
      } else {
        setScheduleResult(data as AiScheduleInterpretation);
      }
    } catch {
      setApiError('Tidak dapat terhubung ke server AI lokal.');
    } finally {
      setLoading(false);
    }
  }

  async function handleExplainError() {
    setLoading(true);
    setApiError(null);
    setErrorResult(null);
    try {
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentGranted: canCallAi,
          task: 'explain_error',
          errorCode: errorCodeInput,
          lastMessage: errorMsgInput,
          screenTitle: currentScreenTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || 'Gagal menjelaskan error.');
      } else {
        setErrorResult(data as AiErrorExplanation);
      }
    } catch {
      setApiError('Tidak dapat terhubung ke server AI lokal.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Asisten AI Opsional Gemini"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
    >
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Asisten AI Opsional (Validasi Lokal Ketat)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel Asisten AI"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Privacy & Consent Control */}
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Prinsip Privasi & Kendali Lokal
                </p>
                <p className="mt-0.5">
                  AI hanya digunakan untuk menafsirkan variasi format jam operasional atau menjelaskan
                  pesan error. AI <strong>tidak pernah</strong> menentukan koordinat klik, tidak menerima
                  screenshot sensitif tanpa izin, dan seluruh output divalidasi secara lokal.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={canCallAi}
                onChange={(e) => onUpdateConsent(e.target.checked, e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>
                Saya menyetujui pengiriman teks jadwal/error terbatas ini ke Gemini API (Mode Tanpa AI aktif jika tidak dicentang).
              </span>
            </label>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => {
                setTab('schedule');
                setApiError(null);
              }}
              className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tab === 'schedule'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Tafsirkan Jam Operasional
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('error');
                setApiError(null);
              }}
              className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tab === 'error'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Jelaskan Error & Pemulihan
            </button>
          </div>

          {tab === 'schedule' ? (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="ai-schedule-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Teks jam operasional dari CSV
                </label>
                <input
                  id="ai-schedule-input"
                  type="text"
                  value={scheduleInput}
                  onChange={(e) => setScheduleInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <button
                type="button"
                disabled={!canCallAi || loading}
                onClick={handleInterpretSchedule}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[#008844] text-white hover:bg-[#007038] disabled:opacity-45 transition-colors cursor-pointer"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Analisis Format Jadwal
              </button>

              {scheduleResult && (
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Hasil Validasi Lokal
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-mono ${
                        scheduleResult.local_validation_passed
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {scheduleResult.local_validation_passed ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      {scheduleResult.local_validation_passed ? 'LOLOS VALIDASI' : 'NEEDS_REVIEW'}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{scheduleResult.explanation}</p>
                  <p className="font-mono text-slate-800 dark:text-slate-200">
                    Format Standar: {scheduleResult.normalized_schedule || '(tidak dapat dipetakan aman)'}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {scheduleResult.local_validation_notes}
                  </p>
                  {scheduleResult.local_validation_passed &&
                    scheduleResult.normalized_schedule &&
                    onApplyNormalizedSchedule && (
                      <button
                        type="button"
                        onClick={() => {
                          onApplyNormalizedSchedule(scheduleResult.normalized_schedule);
                          onClose();
                        }}
                        className="mt-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                      >
                        Terapkan Format ke Baris Terpilih
                      </button>
                    )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ai-error-code"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Kode Error
                  </label>
                  <select
                    id="ai-error-code"
                    value={errorCodeInput}
                    onChange={(e) => setErrorCodeInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="SCREEN_UNKNOWN">SCREEN_UNKNOWN</option>
                    <option value="APP_UNEXPECTED_DIALOG">APP_UNEXPECTED_DIALOG</option>
                    <option value="FIELD_NOT_FOUND">FIELD_NOT_FOUND</option>
                    <option value="FIELD_MISMATCH">FIELD_MISMATCH</option>
                    <option value="SUBMIT_UNCONFIRMED">SUBMIT_UNCONFIRMED</option>
                    <option value="DEVICE_UNAUTHORIZED">DEVICE_UNAUTHORIZED</option>
                    <option value="DEVICE_OFFLINE">DEVICE_OFFLINE</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="ai-error-msg"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Pesan Log Terakhir
                  </label>
                  <input
                    id="ai-error-msg"
                    type="text"
                    value={errorMsgInput}
                    onChange={(e) => setErrorMsgInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={!canCallAi || loading}
                onClick={handleExplainError}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[#008844] text-white hover:bg-[#007038] disabled:opacity-45 transition-colors cursor-pointer"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Minta Saran Pemulihan Aman
              </button>

              {errorResult && (
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {errorResult.summary}
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300">
                    {errorResult.safe_recovery_steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Guardrail lokal: {errorResult.local_validation_passed ? 'Aman (tanpa bypass)' : 'Disaring oleh kebijakan keamanan lokal'}
                  </p>
                </div>
              )}
            </div>
          )}

          {apiError && (
            <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {apiError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
