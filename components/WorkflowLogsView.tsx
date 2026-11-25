'use client';

import { useState } from 'react';
import {
  Camera,
  Database,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type {
  AutomationLog,
  LogLevel,
  ScreenshotEvidence,
  WorkflowState,
} from '@/lib/types';
import { WORKFLOW_STATE_SPECS } from '@/lib/state-machine';

interface WorkflowLogsViewProps {
  workflowState: WorkflowState;
  logs: AutomationLog[];
  onPurgeEvidence: (mode: 'screenshots_only' | 'all_logs') => Promise<void>;
  onSimulateCrashRecovery: () => Promise<void>;
  onResetSeedWorkspace: () => Promise<void>;
}

export default function WorkflowLogsView({
  workflowState,
  logs,
  onPurgeEvidence,
  onSimulateCrashRecovery,
  onResetSeedWorkspace,
}: WorkflowLogsViewProps) {
  const [levelFilter, setLevelFilter] = useState<'ALL' | LogLevel>('ALL');
  const [selectedEvidence, setSelectedEvidence] = useState<ScreenshotEvidence | null>(null);

  const filteredLogs = logs.filter(
    (l) => levelFilter === 'ALL' || l.level === levelFilter
  );

  const evidenceCount = logs.filter((l) => Boolean(l.screenshot_snapshot)).length;

  return (
    <div className="space-y-6">
      {/* State Machine Map (PRD Section 9) */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Workflow Engine State Machine
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Setiap state memiliki kondisi masuk, aksi diizinkan, batas timeout, kebijakan retry, dan bukti screenshot saat gagal.
            </p>
          </div>
          <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
            Active: {workflowState}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {WORKFLOW_STATE_SPECS.map((spec, index) => {
            const isActive = spec.state === workflowState;
            return (
              <div
                key={spec.state}
                className={`p-3 rounded-lg border transition-colors ${
                  isActive
                    ? 'border-[#008844] bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/35'
                    : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {String(index + 1).padStart(2, '0')}. {spec.state}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                    {spec.phase}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {spec.allowed_actions}
                </p>
                <p className="mt-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-500">
                  Retry: {spec.retry_policy}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Checkpoint Recovery & Privacy Controls (PRD Sections 12 & 15) */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-2.5 max-w-xl">
          <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Checkpoint Database & Privasi Data Lokal
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Tidak menyimpan password Grab, OTP, token, atau isi clipboard. Progres disimpan setelah setiap baris agar dapat dilanjutkan dengan aman setelah aplikasi tertutup.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSimulateCrashRecovery}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <Database className="h-3.5 w-3.5" />
            Uji Crash Recovery
          </button>
          <button
            type="button"
            onClick={() => onPurgeEvidence('screenshots_only')}
            disabled={evidenceCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Hapus Screenshot ({evidenceCount})
          </button>
          <button
            type="button"
            onClick={() => onPurgeEvidence('all_logs')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/70 dark:text-red-400 dark:hover:bg-red-950/30 whitespace-nowrap cursor-pointer"
          >
            Bersihkan Log
          </button>
          <button
            type="button"
            onClick={onResetSeedWorkspace}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset Data Contoh
          </button>
        </div>
      </section>

      {/* Audit Log & Evidence Viewer */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Audit Log & Bukti Screenshot (automation_logs)
          </h3>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
            {(['ALL', 'INFO', 'SUCCESS', 'WARN', 'ERROR'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevelFilter(lvl)}
                className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                  levelFilter === lvl
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/70 text-slate-500 border-b border-slate-200 dark:border-slate-800 sticky top-0">
              <tr>
                <th className="py-2.5 px-3 font-medium">Waktu</th>
                <th className="py-2.5 px-3 font-medium">Level</th>
                <th className="py-2.5 px-3 font-medium">State</th>
                <th className="py-2.5 px-3 font-medium">Pesan</th>
                <th className="py-2.5 px-3 font-medium text-right">Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredLogs.map((log) => (
                <tr key={log.log_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40">
                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                    <span
                      className={
                        log.level === 'SUCCESS'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : log.level === 'ERROR'
                            ? 'text-red-700 dark:text-red-400'
                            : log.level === 'WARN'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-slate-600 dark:text-slate-400'
                      }
                    >
                      {log.level}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {log.state}
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                    {log.error_code && (
                      <span className="font-mono text-red-700 dark:text-red-400 mr-1.5">
                        [{log.error_code}]
                      </span>
                    )}
                    {log.message}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    {log.screenshot_snapshot ? (
                      <button
                        type="button"
                        onClick={() => setSelectedEvidence(log.screenshot_snapshot ?? null)}
                        className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Lihat Bukti
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Evidence Detail Inspector */}
      {selectedEvidence && (
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Detail Bukti Screenshot ({selectedEvidence.id})
            </h3>
            <button
              type="button"
              onClick={() => setSelectedEvidence(null)}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
            >
              Tutup
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <dl className="space-y-1.5 font-mono text-slate-700 dark:text-slate-300">
              <div>Serial: {selectedEvidence.device_serial}</div>
              <div>Resolusi: {selectedEvidence.resolution}</div>
              <div>Layar: {selectedEvidence.screen_type}</div>
              <div>Confidence OCR: {Math.round(selectedEvidence.confidence * 100)}%</div>
              <div>Catatan: {selectedEvidence.note}</div>
            </dl>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
              <div className="font-semibold text-slate-900 dark:text-slate-100">Ringkasan OCR:</div>
              <div>{selectedEvidence.ocr_summary}</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
