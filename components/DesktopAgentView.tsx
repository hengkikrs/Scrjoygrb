'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FolderArchive,
  FolderTree,
  Laptop,
  Terminal,
} from 'lucide-react';
import type { AppSettings, WorkflowProfile } from '@/lib/types';
import { generateWindowsAgentBundle } from '@/lib/python-exporter';
import { buildZipArchive } from '@/lib/zip-builder';

interface DesktopAgentViewProps {
  profile: WorkflowProfile;
  settings: AppSettings;
}

const PRE_INTEGRATION_ITEMS = [
  'Screenshot halaman Grab sebelum formulir POI dibuka (samarkan data sensitif)',
  'Screenshot formulir POI yang memperlihatkan seluruh field awal',
  'Screenshot bagian formulir setelah scroll (Jam Operasional & tombol Kirim)',
  'Screenshot kondisi konfirmasi setelah tombol simpan/submit ditekan',
  'Contoh CSV UTF-8 berisi 3–5 baris data dummy (uji koma & titik koma)',
  'Informasi resolusi layar HP Android & versi Android',
  'Versi ADB dan scrcpy yang terpasang di Windows 10/11',
];

export default function DesktopAgentView({
  profile,
  settings,
}: DesktopAgentViewProps) {
  const files = useMemo(
    () => generateWindowsAgentBundle(profile, settings),
    [profile, settings]
  );
  const [selectedPath, setSelectedPath] = useState(files[0].path);
  const [copied, setCopied] = useState(false);
  const [downloadedZip, setDownloadedZip] = useState(false);
  const [checkedChecklist, setCheckedChecklist] = useState<number[]>([]);

  const activeFile = files.find((f) => f.path === selectedPath) ?? files[0];

  function handleDownloadFile(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.split('/').pop() || 'file.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleDownloadZip() {
    const zipBytes = buildZipArchive(
      files.map((f) => ({ path: f.path, content: f.content }))
    );
    const arrayBuffer = zipBytes.buffer.slice(
      zipBytes.byteOffset,
      zipBytes.byteOffset + zipBytes.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'grab-desktop-agent-windows.zip';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setDownloadedZip(true);
    setTimeout(() => setDownloadedZip(false), 2600);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API may be restricted in headless browser
    }
  }

  return (
    <div className="space-y-6">
      {/* Intro & 1-Click ZIP Download */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Jalankan di Komputer Lokal (Windows Desktop & Localhost)
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Unduh paket aplikasi desktop Windows lengkap berisi GUI PySide6, skrip{' '}
              <code className="font-mono">run_windows.bat</code>, pembuat{' '}
              <code className="font-mono">.exe</code>, SQLite lokal, dan konfigurasi{' '}
              <code className="font-mono">workflow_profile.json</code> serta{' '}
              <code className="font-mono">app_settings.json</code> yang sudah tersinkronisasi dengan
              pengaturan Anda saat ini.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadZip}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-[#008844] text-white hover:bg-[#007038] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {downloadedZip ? (
                <Check className="h-4 w-4" />
              ) : (
                <FolderArchive className="h-4 w-4" />
              )}
              {downloadedZip
                ? 'Paket ZIP Diunduh'
                : 'Unduh Paket Desktop Windows (.zip)'}
            </button>
          </div>
        </div>

        {/* 2-Option Local Setup Guide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
              <Laptop className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              Opsi A — Aplikasi Desktop Windows Native (PySide6 + ADB)
            </div>
            <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>
                Klik <strong>Unduh Paket Desktop Windows (.zip)</strong> lalu ekstrak ke folder lokal
                (misalnya <code className="font-mono">C:\grab-desktop-agent</code>).
              </li>
              <li>
                Pastikan Python 3.10+, <code className="font-mono">adb</code> (Android Platform-Tools),
                dan <code className="font-mono">scrcpy</code> terpasang di Windows.
              </li>
              <li>
                Klik dua kali <code className="font-mono">run_windows.bat</code> untuk membuat virtual
                environment otomatis dan membuka jendela aplikasi. Jalankan{' '}
                <code className="font-mono">build_exe.bat</code> jika ingin membuat file{' '}
                <code className="font-mono">.exe</code> mandiri.
              </li>
            </ol>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
              <Terminal className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              Opsi B — Jalankan Web Workbench di Localhost (Port 3000)
            </div>
            <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>
                Buka terminal di folder proyek ini (Node.js 20+) lalu jalankan{' '}
                <code className="font-mono">npm install</code> dan{' '}
                <code className="font-mono">npm run dev</code>.
              </li>
              <li>
                Buka <code className="font-mono">http://localhost:3000</code> di browser komputer Anda.
              </li>
              <li>
                Hubungkan HP Android via USB Debugging, lalu buka tab{' '}
                <strong>Perangkat &amp; Vision</strong> dan klik <strong>Pindai ADB Lokal</strong>{' '}
                untuk mendeteksi perangkat USB nyata dan meluncurkan <code className="font-mono">scrcpy</code>.
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Interactive File Explorer + Code Preview */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Isi Paket grab-desktop-agent/
            </span>
            <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
              {files.length} file
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[460px] overflow-y-auto">
            {files.map((file) => {
              const active = file.path === activeFile.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  className={`w-full text-left px-4 py-2.5 transition-colors cursor-pointer ${
                    active
                      ? 'bg-emerald-50/70 text-emerald-950 dark:bg-emerald-950/35 dark:text-emerald-200'
                      : 'hover:bg-slate-50 text-slate-700 dark:hover:bg-slate-900/50 dark:text-slate-300'
                  }`}
                >
                  <p className="font-mono text-xs font-medium truncate">{file.path}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {file.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
              {activeFile.path}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Disalin' : 'Salin'}
              </button>
              <button
                type="button"
                onClick={() => handleDownloadFile(activeFile.path, activeFile.content)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#008844] text-white hover:bg-[#007038] whitespace-nowrap cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh File
              </button>
            </div>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#0D1420] overflow-x-auto max-h-[460px] leading-relaxed">
            {activeFile.content}
          </pre>
        </div>
      </section>

      {/* Pre-Integration Checklist (PRD Section 19) */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Checklist Kalibrasi Sebelum Integrasi Perangkat Grab Nyata
          </h3>
          <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {checkedChecklist.length}/{PRE_INTEGRATION_ITEMS.length} siap
          </span>
        </div>
        <div className="space-y-2">
          {PRE_INTEGRATION_ITEMS.map((item, idx) => {
            const checked = checkedChecklist.includes(idx);
            return (
              <label
                key={idx}
                className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setCheckedChecklist((prev) =>
                      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                    )
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700"
                />
                <span className={checked ? 'line-through text-slate-400' : ''}>{item}</span>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
