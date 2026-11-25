'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Camera,
  Check,
  FolderArchive,
  Link2,
  Monitor,
  MonitorOff,
  RefreshCw,
  Save,
  ShieldAlert,
  Smartphone,
  Terminal,
  Usb,
  Wifi,
} from 'lucide-react';
import type {
  AdbConnectionState,
  AppSettings,
  DeviceInfo,
  ErrorCode,
  LocalScrcpyDiagnostics,
  ScrcpyLaunchOptions,
  ScreenType,
  WorkflowProfile,
} from '@/lib/types';
import { formatAdbCommandPreview } from '@/lib/mock-device';
import {
  DEFAULT_SCRCPY_OPTIONS_CLIENT,
  formatScrcpyCommandPreview,
} from '@/lib/scrcpy-client';
import { generateScrcpyBridgeBundle } from '@/lib/scrcpy-bridge-exporter';
import { buildZipArchive } from '@/lib/zip-builder';
import { AdbStateText } from './StatusIndicator';

export type LocalBridgeTransport = 'server_local' | 'pc_bridge';

interface DeviceVisionViewProps {
  devices: DeviceInfo[];
  selectedSerial: string;
  onSelectDevice: (serial: string) => void;
  onRefreshDevices: () => void;
  onScanLocalAdb: () => Promise<void>;
  isScanningLocalAdb: boolean;
  localDiagnostics: LocalScrcpyDiagnostics | null;
  bridgeTransport: LocalBridgeTransport;
  onChangeBridgeTransport: (mode: LocalBridgeTransport) => void;
  bridgeUrl: string;
  onChangeBridgeUrl: (url: string) => void;
  bridgeToken: string;
  onChangeBridgeToken: (token: string) => void;
  onConnectWirelessAdb: (hostPort: string) => Promise<{ ok: boolean; message: string }>;
  liveScreenshotUrl: string | null;
  onSetDeviceAdbState: (serial: string, state: AdbConnectionState) => void;
  onToggleScrcpy: () => void;
  onTakeScreenshot: () => void;
  screen: ScreenType;
  onInjectScreen: (screen: ScreenType) => void;
  injectedFault: ErrorCode | null;
  onSetInjectedFault: (fault: ErrorCode | null) => void;
  lowConfidence: boolean;
  onToggleLowConfidence: () => void;
  profile: WorkflowProfile;
  onSaveProfile: (profile: WorkflowProfile) => Promise<void>;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
}

export default function DeviceVisionView({
  devices,
  selectedSerial,
  onSelectDevice,
  onRefreshDevices,
  onScanLocalAdb,
  isScanningLocalAdb,
  localDiagnostics,
  bridgeTransport,
  onChangeBridgeTransport,
  bridgeUrl,
  onChangeBridgeUrl,
  bridgeToken,
  onChangeBridgeToken,
  onConnectWirelessAdb,
  liveScreenshotUrl,
  onSetDeviceAdbState,
  onToggleScrcpy,
  onTakeScreenshot,
  screen,
  onInjectScreen,
  injectedFault,
  onSetInjectedFault,
  lowConfidence,
  onToggleLowConfidence,
  profile,
  onSaveProfile,
  settings,
  onSaveSettings,
}: DeviceVisionViewProps) {
  const [draftProfile, setDraftProfile] = useState<WorkflowProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [adbPathDraft, setAdbPathDraft] = useState(settings.adb_executable_path);
  const [scrcpyPathDraft, setScrcpyPathDraft] = useState(settings.scrcpy_executable_path);
  const [scrcpyOpts, setScrcpyOpts] = useState<ScrcpyLaunchOptions>(
    settings.scrcpy_options ?? DEFAULT_SCRCPY_OPTIONS_CLIENT
  );
  const [savingPaths, setSavingPaths] = useState(false);
  const [savedPathsNotice, setSavedPathsNotice] = useState(false);
  const [bridgeDownloaded, setBridgeDownloaded] = useState(false);
  const [wirelessHostPort, setWirelessHostPort] = useState('');
  const [wirelessBusy, setWirelessBusy] = useState(false);
  const [wirelessStatus, setWirelessStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const selectedDevice =
    devices.find((d) => d.serial === selectedSerial) ?? devices[0];
  const adbCommands = formatAdbCommandPreview(selectedDevice?.serial ?? '');
  const scrcpyPreview = formatScrcpyCommandPreview(
    scrcpyPathDraft,
    selectedDevice?.serial ?? '',
    scrcpyOpts
  );

  async function handleSaveCalibration(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      await onSaveProfile(draftProfile);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLocalPaths(e: React.FormEvent) {
    e.preventDefault();
    setSavingPaths(true);
    setSavedPathsNotice(false);
    try {
      await onSaveSettings({
        ...settings,
        adb_executable_path: adbPathDraft.trim() || 'adb',
        scrcpy_executable_path: scrcpyPathDraft.trim() || 'scrcpy',
        scrcpy_options: scrcpyOpts,
      });
      setSavedPathsNotice(true);
      setTimeout(() => setSavedPathsNotice(false), 2500);
    } finally {
      setSavingPaths(false);
    }
  }

  function handleDownloadScrcpyBridgeZip() {
    const files = generateScrcpyBridgeBundle({
      ...settings,
      adb_executable_path: adbPathDraft.trim() || 'adb',
      scrcpy_executable_path: scrcpyPathDraft.trim() || 'scrcpy',
    });
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
    link.download = 'grab-scrcpy-bridge-windows.zip';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setBridgeDownloaded(true);
    setTimeout(() => setBridgeDownloaded(false), 2500);
  }

  async function handleWirelessSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!wirelessHostPort.trim()) return;
    setWirelessBusy(true);
    setWirelessStatus(null);
    try {
      const res = await onConnectWirelessAdb(wirelessHostPort.trim());
      setWirelessStatus({ ok: res.ok, text: res.message });
    } finally {
      setWirelessBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ADB & genymobile/scrcpy Device Manager */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Integrasi genymobile/scrcpy &amp; Device Manager (ADB)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Otomatis mendeteksi <code className="font-mono">scrcpy</code> dan{' '}
              <code className="font-mono">adb.exe</code> bawaan folder scrcpy agar tidak terjadi konflik versi ADB.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void onScanLocalAdb()}
              disabled={isScanningLocalAdb}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-emerald-700/30 bg-emerald-50 text-[#007038] hover:bg-emerald-100/70 disabled:opacity-50 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70 whitespace-nowrap cursor-pointer"
            >
              <Usb className="h-3.5 w-3.5" />
              {isScanningLocalAdb ? 'Memindai...' : 'Pindai ADB & scrcpy'}
            </button>
            <button
              type="button"
              onClick={onRefreshDevices}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Device
            </button>
            <button
              type="button"
              onClick={onToggleScrcpy}
              disabled={selectedDevice?.adb_state !== 'device'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
            >
              {selectedDevice?.scrcpy_running ? (
                <>
                  <MonitorOff className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  Close scrcpy
                </>
              ) : (
                <>
                  <Monitor className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Launch scrcpy
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onTakeScreenshot}
              disabled={selectedDevice?.adb_state !== 'device'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#008844] text-white hover:bg-[#007038] disabled:opacity-40 whitespace-nowrap cursor-pointer"
            >
              <Camera className="h-3.5 w-3.5" />
              Take Screenshot
            </button>
          </div>
        </div>

        {/* Connection Transport Selector: Localhost Server vs PC Bridge (for Cloud Preview) */}
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
              <Link2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              Jalur Koneksi ke scrcpy di PC Anda
            </div>
            <div
              role="group"
              aria-label="Pilih jalur koneksi scrcpy"
              className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
            >
              <button
                type="button"
                onClick={() => onChangeBridgeTransport('server_local')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  bridgeTransport === 'server_local'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                Server Lokal (localhost:3000)
              </button>
              <button
                type="button"
                onClick={() => onChangeBridgeTransport('pc_bridge')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  bridgeTransport === 'pc_bridge'
                    ? 'bg-[#008844] text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                Bridge PC Lokal (127.0.0.1:17890)
              </button>
            </div>
          </div>

          {bridgeTransport === 'pc_bridge' ? (
            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                <strong>Sudah install scrcpy di PC tapi membuka tools lewat browser/cloud?</strong>{' '}
                Unduh Bridge ringan (tanpa <code className="font-mono">pip install</code>), jalankan{' '}
                <code className="font-mono">start_scrcpy_bridge.bat</code> di PC Anda, lalu tempel{' '}
                <strong>Token Sesi</strong> yang muncul di terminal dan klik <strong>Pindai ADB &amp; scrcpy</strong>.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-4">
                  <label
                    htmlFor="bridge-url-input"
                    className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    URL Bridge Lokal (Hanya 127.0.0.1 / localhost)
                  </label>
                  <input
                    id="bridge-url-input"
                    type="text"
                    value={bridgeUrl}
                    onChange={(e) => onChangeBridgeUrl(e.target.value)}
                    placeholder="http://127.0.0.1:17890"
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="md:col-span-4">
                  <label
                    htmlFor="bridge-token-input"
                    className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Token Sesi Bridge (dari jendela terminal)
                  </label>
                  <input
                    id="bridge-token-input"
                    type="text"
                    value={bridgeToken}
                    onChange={(e) => onChangeBridgeToken(e.target.value)}
                    placeholder="Contoh: GRAB-A1B2C3D4"
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="md:col-span-4">
                  <button
                    type="button"
                    onClick={handleDownloadScrcpyBridgeZip}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#008844] text-white hover:bg-[#007038] whitespace-nowrap cursor-pointer"
                  >
                    {bridgeDownloaded ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <FolderArchive className="h-3.5 w-3.5" />
                    )}
                    {bridgeDownloaded ? 'Bridge ZIP Diunduh' : 'Unduh Bridge scrcpy (.zip)'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Mode <strong>Server Lokal</strong> langsung memanggil <code className="font-mono">scrcpy</code> dan{' '}
              <code className="font-mono">adb</code> di komputer tempat <code className="font-mono">npm run dev</code>{' '}
              berjalan. Jika halaman ini dibuka dari URL cloud, alihkan ke{' '}
              <strong>Bridge PC Lokal (127.0.0.1:17890)</strong> agar tersambung ke scrcpy di komputer Anda.
            </p>
          )}
        </div>

        {/* Live Diagnostics Result & Troubleshooting Tips */}
        {localDiagnostics && (
          <div
            role="status"
            className={`p-3.5 rounded-lg border text-xs space-y-2 ${
              localDiagnostics.adb_available && localDiagnostics.scrcpy_available
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-200'
                : 'border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{localDiagnostics.message}</span>
              <span className="font-mono text-[11px] opacity-80 whitespace-nowrap">
                {localDiagnostics.adb_available && localDiagnostics.scrcpy_available
                  ? 'scrcpy & ADB Siap'
                  : 'Fallback: Mock ADB Mode'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px] opacity-90">
              <div>
                ADB: {localDiagnostics.adb_available ? localDiagnostics.adb_version || 'Aktif' : 'Belum terdeteksi'} ({localDiagnostics.adb_path})
              </div>
              <div>
                scrcpy: {localDiagnostics.scrcpy_available ? localDiagnostics.scrcpy_version || 'Aktif' : 'Belum terdeteksi'} ({localDiagnostics.scrcpy_path})
              </div>
            </div>
            {localDiagnostics.troubleshooting_tips.length > 0 && (
              <ul className="list-disc list-inside space-y-1 pt-1 text-[11px] opacity-90">
                {localDiagnostics.troubleshooting_tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Detected Devices Table */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3 font-medium">Pilih</th>
                <th className="py-2.5 px-3 font-medium">Serial Perangkat</th>
                <th className="py-2.5 px-3 font-medium">Model &amp; OS</th>
                <th className="py-2.5 px-3 font-medium">Resolusi</th>
                <th className="py-2.5 px-3 font-medium">Status ADB</th>
                <th className="py-2.5 px-3 font-medium text-right">Uji Status Koneksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {devices.map((dev) => {
                const isSelected = dev.serial === selectedDevice?.serial;
                return (
                  <tr
                    key={dev.serial}
                    className={isSelected ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''}
                  >
                    <td className="py-3 px-3">
                      <input
                        type="radio"
                        name="selected-adb-device"
                        aria-label={`Pilih perangkat ${dev.serial}`}
                        checked={isSelected}
                        onChange={() => onSelectDevice(dev.serial)}
                        className="h-4 w-4 text-emerald-700"
                      />
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                      <span className="inline-flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{dev.serial}</span>
                        <span className="text-[11px] font-sans font-normal text-slate-500 dark:text-slate-400">
                          ({dev.is_mock ? 'Mock' : 'USB/Wi-Fi Lokal'})
                        </span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      {dev.model} · <span className="text-slate-500">{dev.android_version}</span>
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {dev.resolution}
                    </td>
                    <td className="py-3 px-3">
                      <AdbStateText state={dev.adb_state} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      {dev.is_mock ? (
                        <div className="inline-flex items-center gap-1">
                          {(['device', 'unauthorized', 'offline'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => onSetDeviceAdbState(dev.serial, st)}
                              className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                                dev.adb_state === st
                                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                          {dev.scrcpy_running ? `scrcpy PID ${dev.scrcpy_pid}` : 'Siap scrcpy'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Live Captured Screenshot from Real Device (if available) */}
        {liveScreenshotUrl && (
          <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/20 flex flex-wrap items-start gap-4">
            <Image
              src={liveScreenshotUrl}
              alt="Screenshot langsung dari perangkat Android"
              width={144}
              height={320}
              referrerPolicy="no-referrer"
              className="w-36 h-auto rounded-lg border border-slate-300 dark:border-slate-700"
            />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Frame Langsung dari Perangkat Android ({selectedDevice?.serial})
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Diambil langsung melalui <code className="font-mono">adb exec-out screencap -p</code>.
              </p>
            </div>
          </div>
        )}

        {/* Local Paths + scrcpy CLI Flags Form */}
        <form
          onSubmit={handleSaveLocalPaths}
          className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <label
                htmlFor="local-scrcpy-path"
                className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Path Executable scrcpy Lokal (genymobile/scrcpy)
              </label>
              <input
                id="local-scrcpy-path"
                type="text"
                value={scrcpyPathDraft}
                onChange={(e) => setScrcpyPathDraft(e.target.value)}
                placeholder="scrcpy atau C:\scrcpy-win64-v3.1\scrcpy.exe"
                className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="md:col-span-5">
              <label
                htmlFor="local-adb-path"
                className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Path Executable ADB Lokal (Otomatis deteksi bawaan scrcpy)
              </label>
              <input
                id="local-adb-path"
                type="text"
                value={adbPathDraft}
                onChange={(e) => setAdbPathDraft(e.target.value)}
                placeholder="adb atau C:\scrcpy-win64-v3.1\adb.exe"
                className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={savingPaths}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                {savedPathsNotice ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {savedPathsNotice ? 'Disimpan' : 'Simpan Opsi'}
              </button>
            </div>
          </div>

          {/* scrcpy CLI Launch Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-center">
            <div>
              <label htmlFor="scrcpy-max-size" className="block text-[11px] text-slate-500 mb-1">
                Resolusi (--max-size)
              </label>
              <select
                id="scrcpy-max-size"
                value={scrcpyOpts.max_size}
                onChange={(e) =>
                  setScrcpyOpts({
                    ...scrcpyOpts,
                    max_size: Number(e.target.value) as ScrcpyLaunchOptions['max_size'],
                  })
                }
                className="w-full px-2.5 py-1.5 font-mono rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value={0}>Asli (Native)</option>
                <option value={720}>720px</option>
                <option value={1024}>1024px</option>
                <option value={1280}>1280px (Stabil)</option>
                <option value={1600}>1600px</option>
                <option value={1920}>1920px</option>
              </select>
            </div>
            <div>
              <label htmlFor="scrcpy-max-fps" className="block text-[11px] text-slate-500 mb-1">
                Frame Rate (--max-fps)
              </label>
              <select
                id="scrcpy-max-fps"
                value={scrcpyOpts.max_fps}
                onChange={(e) =>
                  setScrcpyOpts({
                    ...scrcpyOpts,
                    max_fps: Number(e.target.value) as ScrcpyLaunchOptions['max_fps'],
                  })
                }
                className="w-full px-2.5 py-1.5 font-mono rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value={15}>15 FPS</option>
                <option value={30}>30 FPS (Stabil)</option>
                <option value={60}>60 FPS</option>
              </select>
            </div>
            <label className="inline-flex items-center gap-2 pt-4 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={scrcpyOpts.no_audio}
                onChange={(e) => setScrcpyOpts({ ...scrcpyOpts, no_audio: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-700"
              />
              <span>--no-audio</span>
            </label>
            <label className="inline-flex items-center gap-2 pt-4 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={scrcpyOpts.stay_awake}
                onChange={(e) => setScrcpyOpts({ ...scrcpyOpts, stay_awake: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-700"
              />
              <span>--stay-awake</span>
            </label>
            <label className="inline-flex items-center gap-2 pt-4 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={scrcpyOpts.always_on_top}
                onChange={(e) =>
                  setScrcpyOpts({ ...scrcpyOpts, always_on_top: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-700"
              />
              <span>--always-on-top</span>
            </label>
            <label className="inline-flex items-center gap-2 pt-4 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={scrcpyOpts.turn_screen_off}
                onChange={(e) =>
                  setScrcpyOpts({ ...scrcpyOpts, turn_screen_off: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-700"
              />
              <span>--turn-screen-off</span>
            </label>
          </div>
        </form>

        {/* Wireless ADB Connect (TCP/IP) */}
        <form
          onSubmit={handleWirelessSubmit}
          className="flex flex-wrap items-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs"
        >
          <div className="flex-1 min-w-[240px]">
            <label
              htmlFor="wireless-adb-ip"
              className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Koneksi ADB Nirkabel / Wi-Fi (Opsional, contoh: 192.168.1.24:5555)
            </label>
            <input
              id="wireless-adb-ip"
              type="text"
              value={wirelessHostPort}
              onChange={(e) => setWirelessHostPort(e.target.value)}
              placeholder="192.168.1.24:5555"
              className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <button
            type="submit"
            disabled={wirelessBusy || !wirelessHostPort.trim()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-45 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <Wifi className="h-3.5 w-3.5" />
            {wirelessBusy ? 'Menyambungkan...' : 'Sambungkan Wi-Fi ADB'}
          </button>
          {wirelessStatus && (
            <span
              className={`text-xs font-medium ${
                wirelessStatus.ok
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {wirelessStatus.text}
            </span>
          )}
        </form>

        {/* Active scrcpy & ADB Command Reference */}
        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
            <Terminal className="h-3.5 w-3.5 text-slate-500" />
            Perintah scrcpy &amp; ADB Aktif (Serial terpilih: {selectedDevice?.serial})
          </div>
          <pre className="text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto leading-relaxed">
            {`${scrcpyPreview}\n${adbCommands.join('\n')}`}
          </pre>
        </div>
      </section>

      {/* Safety & Fault Injection Simulator (PRD Section 8 & 13) */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] p-5 space-y-4">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Simulasi Uji Keamanan Vision & Error Handling
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Uji kepatuhan agent terhadap layar tak dikenal, dialog OTP/CAPTCHA, confidence OCR rendah, dan submit tidak pasti tanpa memerlukan HP fisik.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Kondisi Layar Mock Android (Saat ini: <span className="font-mono">{screen}</span>)
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['POI_FORM_TOP', 'Normal: Formulir POI'],
                  ['SCREEN_UNKNOWN', 'Uji: SCREEN_UNKNOWN'],
                  ['SECURITY_DIALOG_CAPTCHA', 'Uji: Dialog CAPTCHA'],
                  ['SECURITY_DIALOG_OTP', 'Uji: Dialog OTP'],
                  ['PERMISSION_DIALOG', 'Uji: Dialog Izin'],
                ] as const
              ).map(([scr, label]) => (
                <button
                  key={scr}
                  type="button"
                  onClick={() => onInjectScreen(scr)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    screen === scr
                      ? 'border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Injeksi Fault pada Langkah Berikutnya (Aktif:{' '}
              <span className="font-mono">{injectedFault ?? 'Tidak ada'}</span>)
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  [null, 'Normal (Bebas Fault)'],
                  ['FIELD_NOT_FOUND', 'FIELD_NOT_FOUND'],
                  ['FIELD_MISMATCH', 'FIELD_MISMATCH'],
                  ['SUBMIT_UNCONFIRMED', 'SUBMIT_UNCONFIRMED'],
                ] as const
              ).map(([fault, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onSetInjectedFault(fault)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                    injectedFault === fault
                      ? 'border-amber-600 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-200'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={onToggleLowConfidence}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  lowConfidence
                    ? 'border-red-600 bg-red-50 text-red-900 dark:border-red-500 dark:bg-red-950/40 dark:text-red-200'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {lowConfidence ? 'Confidence Rendah: AKTIF' : 'Simulasikan OCR Rendah'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Profile Calibration Editor (PRD Section 8 & 10) */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] p-5">
        <form onSubmit={handleSaveCalibration} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Kalibrasi Profil Workflow (workflow_profile.json)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Konfigurasi resolusi, ambang batas confidence OCR, batas retry non-final, dan pola label field agar adaptif terhadap perubahan UI Grab.
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#008844] text-white hover:bg-[#007038] disabled:opacity-45 cursor-pointer"
            >
              {savedNotice ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {savedNotice ? 'Tersimpan' : saving ? 'Menyimpan...' : 'Simpan Kalibrasi'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label htmlFor="prof-res" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Resolusi Target
              </label>
              <input
                id="prof-res"
                type="text"
                value={draftProfile.target_resolution}
                onChange={(e) =>
                  setDraftProfile({ ...draftProfile, target_resolution: e.target.value })
                }
                className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="prof-ocr" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Ambang OCR ({Math.round(draftProfile.ocr_confidence_threshold * 100)}%)
              </label>
              <input
                id="prof-ocr"
                type="number"
                min={0.5}
                max={0.99}
                step={0.01}
                value={draftProfile.ocr_confidence_threshold}
                onChange={(e) =>
                  setDraftProfile({
                    ...draftProfile,
                    ocr_confidence_threshold: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 font-mono tabular-nums rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="prof-retry" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Maks Retry Non-Final
              </label>
              <input
                id="prof-retry"
                type="number"
                min={0}
                max={5}
                value={draftProfile.max_retries_non_final}
                onChange={(e) =>
                  setDraftProfile({
                    ...draftProfile,
                    max_retries_non_final: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 font-mono tabular-nums rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="prof-scroll" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Maks Scroll / State
              </label>
              <input
                id="prof-scroll"
                type="number"
                min={1}
                max={10}
                value={draftProfile.max_scrolls_per_state}
                onChange={(e) =>
                  setDraftProfile({
                    ...draftProfile,
                    max_scrolls_per_state: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 font-mono tabular-nums rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/70 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Field Key</th>
                  <th className="py-2.5 px-3 font-medium">Pola Label OCR (Dipisah Koma)</th>
                  <th className="py-2.5 px-3 font-medium">Anchor Relatif (%)</th>
                  <th className="py-2.5 px-3 font-medium">Butuh Scroll</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {draftProfile.fields.map((field, idx) => (
                  <tr key={field.key}>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                      {field.key}
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        aria-label={`Pola label OCR untuk ${field.key}`}
                        value={field.label_patterns.join(', ')}
                        onChange={(e) => {
                          const nextFields = [...draftProfile.fields];
                          nextFields[idx] = {
                            ...field,
                            label_patterns: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          };
                          setDraftProfile({ ...draftProfile, fields: nextFields });
                        }}
                        className="w-full px-2.5 py-1.5 rounded border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      X:{field.anchor_pct.x}% · Y:{field.anchor_pct.y}%
                    </td>
                    <td className="py-2.5 px-3">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.requires_scroll}
                          onChange={(e) => {
                            const nextFields = [...draftProfile.fields];
                            nextFields[idx] = {
                              ...field,
                              requires_scroll: e.target.checked,
                            };
                            setDraftProfile({ ...draftProfile, fields: nextFields });
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-700"
                        />
                        <span className="text-slate-600 dark:text-slate-400">
                          {field.requires_scroll ? 'Ya' : 'Tidak'}
                        </span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      </section>
    </div>
  );
}
