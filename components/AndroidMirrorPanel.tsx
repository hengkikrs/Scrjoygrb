'use client';

import {
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Hand,
  Monitor,
  MonitorOff,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import type {
  DeviceInfo,
  MockFormValues,
  ScreenType,
  WorkflowState,
} from '@/lib/types';
import { buildOcrDetections, getScreenMeta } from '@/lib/mock-device';

interface AndroidMirrorPanelProps {
  device: DeviceInfo;
  screen: ScreenType;
  formValues: MockFormValues;
  workflowState: WorkflowState;
  showOcrOverlay: boolean;
  onToggleOcrOverlay: () => void;
  lowConfidence: boolean;
  ocrThreshold: number;
  manualTakeoverActive: boolean;
  onManualFormChange: (field: keyof MockFormValues, value: string) => void;
  onManualScreenChange: (screen: ScreenType) => void;
  onTakeScreenshot: () => void;
  onToggleScrcpy: () => void;
  onCompleteManualTakeover: () => void;
}

export default function AndroidMirrorPanel({
  device,
  screen,
  formValues,
  workflowState,
  showOcrOverlay,
  onToggleOcrOverlay,
  lowConfidence,
  ocrThreshold,
  manualTakeoverActive,
  onManualFormChange,
  onManualScreenChange,
  onTakeScreenshot,
  onToggleScrcpy,
  onCompleteManualTakeover,
}: AndroidMirrorPanelProps) {
  const screenMeta = getScreenMeta(screen);
  const ocrBoxes = buildOcrDetections(screen, formValues, lowConfidence);
  const activeFieldKey =
    workflowState === 'FILL_POI_NAME' || workflowState === 'VERIFY_POI_NAME'
      ? 'poi_name'
      : workflowState === 'FILL_PHONE' || workflowState === 'VERIFY_PHONE'
        ? 'phone_number'
        : workflowState === 'FILL_WEBSITE' || workflowState === 'VERIFY_WEBSITE'
          ? 'website'
          : workflowState === 'FILL_OPENING_HOURS' || workflowState === 'VERIFY_OPENING_HOURS'
            ? 'opening_hours'
            : null;

  const avgConfidence =
    ocrBoxes.length > 0
      ? Math.round(
          (ocrBoxes.reduce((sum, box) => sum + box.confidence, 0) / ocrBoxes.length) * 100
        )
      : Math.round(screenMeta.baseConfidence * 100);

  return (
    <section
      aria-label="Tampilan Layar Android scrcpy"
      className="flex flex-col border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] rounded-xl overflow-hidden"
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            Live Mirror (scrcpy) & Vision OCR
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
            {device.serial} · {device.resolution} · OCR {avgConfidence}%
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleOcrOverlay}
            aria-label={showOcrOverlay ? 'Sembunyikan overlay OCR' : 'Tampilkan overlay OCR'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showOcrOverlay
                ? 'border-emerald-600/40 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {showOcrOverlay ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            OCR
          </button>
          <button
            type="button"
            onClick={onTakeScreenshot}
            disabled={device.adb_state !== 'device'}
            aria-label="Ambil screenshot perangkat"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Camera className="h-3.5 w-3.5" />
            Capture
          </button>
          <button
            type="button"
            onClick={onToggleScrcpy}
            disabled={device.adb_state !== 'device'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {device.scrcpy_running ? (
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
        </div>
      </div>

      {/* Manual Takeover Banner */}
      {manualTakeoverActive && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/70">
          <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
            <Hand className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>Manual Takeover aktif:</strong> Kendalikan layar secara langsung lalu klik selesai.
            </span>
          </div>
          <button
            type="button"
            onClick={onCompleteManualTakeover}
            className="px-3 py-1 text-xs font-medium rounded-md bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Validasi Layar & Lanjutkan
          </button>
        </div>
      )}

      {/* Phone Viewport */}
      <div className="p-4 flex flex-col items-center bg-slate-50 dark:bg-[#0D1420] flex-1">
        {device.adb_state !== 'device' ? (
          <div className="w-full max-w-[310px] min-h-[430px] rounded-[24px] border border-slate-300 dark:border-slate-700 bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-6 text-center gap-3">
            <Smartphone className="h-9 w-9 text-slate-400" aria-hidden="true" />
            <p className="text-sm font-semibold">
              {device.adb_state === 'unauthorized'
                ? 'Menunggu Otorisasi USB Debugging'
                : 'Perangkat Android Tidak Terhubung'}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              {device.adb_state === 'unauthorized'
                ? 'Buka layar HP Android dan tekan "Allow USB debugging" untuk serial yang dipilih.'
                : 'Periksa kabel USB dan status ADB melalui panel Device Connection.'}
            </p>
          </div>
        ) : (
          <div
            data-testid="android-mirror-frame"
            className="relative w-full max-w-[320px] min-h-[440px] rounded-[24px] border-2 border-slate-800 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-sm overflow-hidden flex flex-col"
          >
            {/* Android Status Bar */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900 text-slate-200 text-[11px] font-mono tabular-nums">
              <span>{device.scrcpy_running ? `scrcpy PID ${device.scrcpy_pid}` : 'ADB Screencap'}</span>
              <span>{device.resolution}</span>
            </div>

            {/* Grab Header */}
            <div className="px-4 py-2.5 bg-[#008844] text-white flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">Grab Merchant / POI Form</p>
                <p className="text-[11px] text-emerald-100 truncate">{screenMeta.title}</p>
              </div>
              {manualTakeoverActive && (
                <span className="text-[11px] font-mono text-amber-200 whitespace-nowrap">MANUAL</span>
              )}
            </div>

            {/* Screen Body */}
            <div className="relative flex-1 p-3.5 space-y-3 text-left">
              {screen === 'GRAB_HOME' && (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Kontribusi Peta & Lokasi POI
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[220px]">
                    Halaman awal Grab siap. Agent akan memverifikasi layar lalu membuka formulir POI.
                  </p>
                  <button
                    type="button"
                    onClick={() => onManualScreenChange('POI_FORM_TOP')}
                    className="px-4 py-2 text-xs font-medium rounded-lg bg-[#008844] text-white hover:bg-[#007038] transition-colors cursor-pointer"
                  >
                    Buka Formulir POI
                  </button>
                </div>
              )}

              {(screen === 'POI_FORM_TOP' || screen === 'POI_FORM_SCROLLED') && (
                <div className="space-y-3">
                  {screen === 'POI_FORM_TOP' && (
                    <>
                      <FieldMockInput
                        label="Nama Tempat *"
                        value={formValues.poi_name}
                        active={activeFieldKey === 'poi_name'}
                        editable={manualTakeoverActive}
                        placeholder="Masukkan nama POI..."
                        onChange={(v) => onManualFormChange('poi_name', v)}
                      />
                      <FieldMockInput
                        label="Nomor Telepon"
                        value={formValues.phone_number}
                        active={activeFieldKey === 'phone_number'}
                        editable={manualTakeoverActive}
                        placeholder="08xxxxxxxxxx"
                        mono
                        onChange={(v) => onManualFormChange('phone_number', v)}
                      />
                      <FieldMockInput
                        label="Website"
                        value={formValues.website}
                        active={activeFieldKey === 'website'}
                        editable={manualTakeoverActive}
                        placeholder="https://..."
                        onChange={(v) => onManualFormChange('website', v)}
                      />
                      <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Scroll ke bawah untuk Jam Operasional</span>
                        {manualTakeoverActive && (
                          <button
                            type="button"
                            onClick={() => onManualScreenChange('POI_FORM_SCROLLED')}
                            className="text-emerald-700 dark:text-emerald-400 underline cursor-pointer"
                          >
                            Scroll bawah
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {screen === 'POI_FORM_SCROLLED' && (
                    <>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Posisi layar: Setelah auto-scroll</span>
                        {manualTakeoverActive && (
                          <button
                            type="button"
                            onClick={() => onManualScreenChange('POI_FORM_TOP')}
                            className="text-emerald-700 dark:text-emerald-400 underline cursor-pointer"
                          >
                            Scroll atas
                          </button>
                        )}
                      </div>
                      <FieldMockInput
                        label="Website"
                        value={formValues.website}
                        active={activeFieldKey === 'website'}
                        editable={manualTakeoverActive}
                        placeholder="(opsional)"
                        onChange={(v) => onManualFormChange('website', v)}
                      />
                      <FieldMockInput
                        label="Jam Operasional"
                        value={formValues.opening_hours}
                        active={activeFieldKey === 'opening_hours'}
                        editable={manualTakeoverActive}
                        placeholder="Mon-Sun 08:00-22:00"
                        mono
                        onChange={(v) => onManualFormChange('opening_hours', v)}
                      />
                      <div className="pt-3">
                        <div className="w-full py-2.5 text-center text-xs font-semibold rounded-lg bg-[#008844] text-white opacity-90">
                          Kirim Data POI
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {screen === 'SUBMIT_CONFIRMATION' && (
                <div className="space-y-3 py-2">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Pratinjau Formulir Siap Kirim
                  </p>
                  <dl className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                    <div className="px-3 py-2 flex justify-between gap-2">
                      <dt className="text-slate-500">Nama</dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100 text-right truncate">
                        {formValues.poi_name || '—'}
                      </dd>
                    </div>
                    <div className="px-3 py-2 flex justify-between gap-2">
                      <dt className="text-slate-500">Telepon</dt>
                      <dd className="font-mono text-slate-900 dark:text-slate-100 text-right">
                        {formValues.phone_number || '—'}
                      </dd>
                    </div>
                    <div className="px-3 py-2 flex justify-between gap-2">
                      <dt className="text-slate-500">Website</dt>
                      <dd className="text-slate-900 dark:text-slate-100 text-right truncate max-w-[165px]">
                        {formValues.website || '(kosong)'}
                      </dd>
                    </div>
                    <div className="px-3 py-2 flex justify-between gap-2">
                      <dt className="text-slate-500">Jam</dt>
                      <dd className="font-mono text-slate-900 dark:text-slate-100 text-right">
                        {formValues.opening_hours || '—'}
                      </dd>
                    </div>
                  </dl>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    Menunggu konfirmasi operator sebelum menekan tombol Kirim.
                  </p>
                </div>
              )}

              {screen === 'SUBMIT_SUCCESS' && (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-2.5">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Data POI Terkirim
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[210px]">
                    Konfirmasi layar berhasil terverifikasi oleh OCR.
                  </p>
                </div>
              )}

              {screen === 'SUBMIT_UNCERTAIN' && (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-2.5">
                  <ShieldAlert className="h-10 w-10 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Respons Server Tidak Jelas
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[220px]">
                    Agent tidak akan menekan Submit ulang. Baris ditandai NEEDS_REVIEW untuk pemeriksaan manual.
                  </p>
                </div>
              )}

              {(screen === 'SECURITY_DIALOG_OTP' ||
                screen === 'SECURITY_DIALOG_CAPTCHA' ||
                screen === 'PERMISSION_DIALOG') && (
                <div className="my-4 p-4 rounded-xl border border-red-300 bg-red-50 dark:border-red-800/70 dark:bg-red-950/40 space-y-2.5 text-center">
                  <ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-400 mx-auto" />
                  <p className="text-xs font-semibold text-red-900 dark:text-red-200">
                    {screenMeta.title}
                  </p>
                  <p className="text-[11px] text-red-700 dark:text-red-300 leading-relaxed">
                    Agent berhenti otomatis sesuai aturan keamanan. Tangani dialog ini secara manual.
                  </p>
                  {manualTakeoverActive && (
                    <button
                      type="button"
                      onClick={() => onManualScreenChange('POI_FORM_TOP')}
                      className="w-full py-2 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                    >
                      Selesaikan Dialog Secara Manual
                    </button>
                  )}
                </div>
              )}

              {screen === 'SCREEN_UNKNOWN' && (
                <div className="my-6 p-4 rounded-xl border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900 space-y-2.5 text-center">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Layar Tidak Dikenali (SCREEN_UNKNOWN)
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Agent menolak menebak koordinat klik. Kembalikan ke halaman formulir POI via Manual Takeover.
                  </p>
                  {manualTakeoverActive && (
                    <button
                      type="button"
                      onClick={() => onManualScreenChange('POI_FORM_TOP')}
                      className="w-full py-2 text-xs font-medium rounded-lg bg-[#008844] text-white hover:bg-[#007038] cursor-pointer"
                    >
                      Kembali ke Formulir POI
                    </button>
                  )}
                </div>
              )}

              {/* OCR Bounding Box Overlay */}
              {showOcrOverlay && (
                <div
                  aria-label="Overlay kotak deteksi OCR"
                  className="pointer-events-none absolute inset-0"
                >
                  {ocrBoxes.map((box) => {
                    const pass = box.confidence >= ocrThreshold;
                    return (
                      <div
                        key={box.id}
                        style={{
                          left: `${box.bbox.x}%`,
                          top: `${box.bbox.y}%`,
                          width: `${box.bbox.w}%`,
                          height: `${box.bbox.h}%`,
                        }}
                        className={`absolute rounded border border-dashed ${
                          pass
                            ? 'border-emerald-500/80 bg-emerald-500/5'
                            : 'border-amber-500 bg-amber-500/10'
                        }`}
                      >
                        <span
                          className={`absolute -top-3.5 left-1 px-1 text-[9px] font-mono tabular-nums rounded ${
                            pass
                              ? 'bg-emerald-700 text-white'
                              : 'bg-amber-600 text-white'
                          }`}
                        >
                          OCR {Math.round(box.confidence * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Android Nav Bar */}
            <div className="px-6 py-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around text-[11px] font-mono text-slate-400">
              <span>◀ Back</span>
              <span>● Home</span>
              <span>■ Recents</span>
            </div>
          </div>
        )}

        {/* Mirror Footer Meta */}
        <div className="mt-3 w-full max-w-[320px] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Ambang OCR: {Math.round(ocrThreshold * 100)}%</span>
          <span className="font-mono tabular-nums">
            {device.scrcpy_running ? 'scrcpy aktif' : 'scrcpy standby'}
          </span>
        </div>
      </div>
    </section>
  );
}

function FieldMockInput({
  label,
  value,
  active,
  editable,
  placeholder,
  mono,
  onChange,
}: {
  label: string;
  value: string;
  active: boolean;
  editable: boolean;
  placeholder: string;
  mono?: boolean;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
        {label}
      </label>
      <input
        type="text"
        value={value}
        readOnly={!editable}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-2.5 py-2 text-xs rounded-lg border transition-colors ${
          mono ? 'font-mono tabular-nums' : ''
        } ${
          active
            ? 'border-[#008844] bg-emerald-50/70 text-slate-900 ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-slate-100'
            : editable
              ? 'border-amber-400 bg-white text-slate-900 dark:border-amber-500 dark:bg-slate-900 dark:text-slate-100'
              : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
        }`}
      />
    </div>
  );
}
