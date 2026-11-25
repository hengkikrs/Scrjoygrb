'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import type { Job, PoiRecord, RecordStatus } from '@/lib/types';
import { exportRecordsToCsv, previewAndValidateCsv } from '@/lib/csv-parser';
import { RecordStatusText } from './StatusIndicator';

interface CsvDataViewProps {
  activeJob: Job | null;
  records: PoiRecord[];
  selectedRecordIds: string[];
  onToggleSelectRecord: (recordId: string) => void;
  onSelectAllFiltered: (ids: string[]) => void;
  onClearSelection: () => void;
  onImportCsv: (filename: string, content: string, delimiter?: ',' | ';') => Promise<void>;
  onProcessSelectedRows: (ids: string[], allowReprocessSuccess: boolean) => void;
  onUpdateRecordFields: (
    recordId: string,
    patch: Partial<Pick<PoiRecord, 'poi_name' | 'phone_number' | 'website' | 'opening_hours' | 'status' | 'notes'>>
  ) => Promise<void>;
  onOpenAiForSchedule: (record: PoiRecord) => void;
  importModalOpen: boolean;
  onSetImportModalOpen: (open: boolean) => void;
}

const SAMPLE_SEMICOLON_CSV = `poi_name;phone_number;website;opening_hours
Kedai Kopi Senja;081244556677;https://kopisenja.example;Mon-Sun 08:00-22:00
Apotek Harapan Baru;+6281199008877;;Mon-Sat 07:00-21:00
;081300001111;https://kosong.example;Mon-Fri 09:00-17:00
Studio Foto Cahaya;085712345678;https://studiocahaya.example;Buka setiap pagi sampai malam`;

const STATUS_FILTERS: Array<{ value: 'ALL' | RecordStatus; label: string }> = [
  { value: 'ALL', label: 'Semua' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'SKIPPED', label: 'Skipped' },
  { value: 'NEEDS_REVIEW', label: 'Needs Review' },
  { value: 'FAILED', label: 'Failed' },
];

export default function CsvDataView({
  activeJob,
  records,
  selectedRecordIds,
  onToggleSelectRecord,
  onSelectAllFiltered,
  onClearSelection,
  onImportCsv,
  onProcessSelectedRows,
  onUpdateRecordFields,
  onOpenAiForSchedule,
  importModalOpen,
  onSetImportModalOpen,
}: CsvDataViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | RecordStatus>('ALL');
  const [editingRecord, setEditingRecord] = useState<PoiRecord | null>(null);
  const [reprocessConfirmOpen, setReprocessConfirmOpen] = useState(false);

  // Import modal states
  const [csvText, setCsvText] = useState(SAMPLE_SEMICOLON_CSV);
  const [filename, setFilename] = useState('poi_batch_baru.csv');
  const [delimiterMode, setDelimiterMode] = useState<'auto' | ',' | ';'>('auto');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const preview = useMemo(
    () =>
      previewAndValidateCsv(
        csvText,
        delimiterMode === 'auto' ? undefined : delimiterMode
      ),
    [csvText, delimiterMode]
  );

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((rec) => {
      if (statusFilter !== 'ALL' && rec.status !== statusFilter) return false;
      if (!q) return true;
      return (
        rec.poi_name.toLowerCase().includes(q) ||
        rec.phone_number.toLowerCase().includes(q) ||
        rec.website.toLowerCase().includes(q) ||
        rec.opening_hours.toLowerCase().includes(q) ||
        rec.notes.toLowerCase().includes(q)
      );
    });
  }, [records, searchQuery, statusFilter]);

  const selectedRecords = records.filter((r) => selectedRecordIds.includes(r.record_id));
  const selectedContainsSuccess = selectedRecords.some((r) => r.status === 'SUCCESS');

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result);
        setImportError(null);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  async function handleConfirmImport() {
    if (!preview.valid) {
      setImportError(preview.errors.join(' '));
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      await onImportCsv(
        filename,
        csvText,
        delimiterMode === 'auto' ? undefined : delimiterMode
      );
      onSetImportModalOpen(false);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Gagal mengimpor CSV.');
    } finally {
      setImporting(false);
    }
  }

  function handleExportCsv() {
    const csvContent = exportRecordsToCsv(records, activeJob?.delimiter ?? ',');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const baseName = (activeJob?.source_filename ?? 'poi_results.csv').replace(/\.csv$/i, '');
    link.download = `${baseName}_results.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleRunSelectedClick() {
    if (selectedRecordIds.length === 0) return;
    if (selectedContainsSuccess) {
      setReprocessConfirmOpen(true);
    } else {
      onProcessSelectedRows(selectedRecordIds, false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Manajemen Data CSV POI
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              File aktif: <span className="font-mono text-slate-700 dark:text-slate-300">{activeJob?.source_filename ?? '—'}</span> · UTF-8 · Nomor telepon disimpan sebagai teks agar angka 0 awal tidak hilang.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSetImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#008844] text-white hover:bg-[#007038] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={records.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Export Results
            </button>
          </div>
        </div>

        {/* Search & Segmented Status Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 max-w-md">
            <Search
              className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama POI, nomor telepon, website, catatan..."
              aria-label="Cari baris CSV"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
            {STATUS_FILTERS.map((f) => {
              const count =
                f.value === 'ALL'
                  ? records.length
                  : records.filter((r) => r.status === f.value).length;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === f.value
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {f.label} <span className="font-mono tabular-nums opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selection Action Bar */}
        {selectedRecordIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/70">
            <span className="text-xs text-emerald-950 dark:text-emerald-200">
              <strong className="font-mono tabular-nums">{selectedRecordIds.length}</strong> baris dipilih
              {selectedContainsSuccess && ' (termasuk baris berstatus SUCCESS)'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunSelectedClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#008844] text-white hover:bg-[#007038] whitespace-nowrap cursor-pointer"
              >
                <Play className="h-3 w-3" />
                Process Selected Rows
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 cursor-pointer"
              >
                Batal Pilih
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Main Data Table */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-2.5 w-9">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua baris yang tampil"
                    checked={
                      filteredRecords.length > 0 &&
                      filteredRecords.every((r) => selectedRecordIds.includes(r.record_id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        onSelectAllFiltered(filteredRecords.map((r) => r.record_id));
                      } else {
                        onClearSelection();
                      }
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-700"
                  />
                </th>
                <th className="py-2.5 px-2 font-medium w-10">#</th>
                <th className="py-2.5 px-2.5 font-medium">Nama POI</th>
                <th className="py-2.5 px-2.5 font-medium">Telepon</th>
                <th className="py-2.5 px-2.5 font-medium">Website</th>
                <th className="py-2.5 px-2.5 font-medium">Jam Operasional</th>
                <th className="py-2.5 px-2.5 font-medium">Status</th>
                <th className="py-2.5 px-2.5 font-medium">Catatan</th>
                <th className="py-2.5 px-2.5 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Tidak ada baris yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr
                    key={rec.record_id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors"
                  >
                    <td className="py-2.5 px-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Pilih baris ${rec.source_row_number} ${rec.poi_name || 'tanpa nama'}`}
                        checked={selectedRecordIds.includes(rec.record_id)}
                        onChange={() => onToggleSelectRecord(rec.record_id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-700"
                      />
                    </td>
                    <td className="py-2.5 px-2 font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {rec.source_row_number}
                    </td>
                    <td
                      title={rec.poi_name || '(kosong)'}
                      className="py-2.5 px-2.5 font-medium text-slate-900 dark:text-slate-100 max-w-[155px] truncate"
                    >
                      {rec.poi_name || <span className="text-slate-400 italic">(kosong)</span>}
                    </td>
                    <td className="py-2.5 px-2.5 font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {rec.phone_number || <span className="text-slate-400">—</span>}
                    </td>
                    <td
                      title={rec.website || '—'}
                      className="py-2.5 px-2.5 text-slate-600 dark:text-slate-300 max-w-[130px] truncate"
                    >
                      {rec.website || <span className="text-slate-400">—</span>}
                    </td>
                    <td
                      title={rec.opening_hours || '—'}
                      className="py-2.5 px-2.5 font-mono text-slate-700 dark:text-slate-300 max-w-[155px] truncate"
                    >
                      {rec.opening_hours || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2.5 px-2.5">
                      <RecordStatusText status={rec.status} />
                    </td>
                    <td
                      title={rec.notes || '—'}
                      className="py-2.5 px-2.5 text-slate-600 dark:text-slate-400 max-w-[140px] truncate"
                    >
                      {rec.notes || '—'}
                    </td>
                    <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingRecord(rec)}
                          aria-label={`Edit baris ${rec.source_row_number}`}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        {rec.status === 'NEEDS_REVIEW' && (
                          <button
                            type="button"
                            onClick={() => onOpenAiForSchedule(rec)}
                            aria-label={`Bantu tafsirkan jam baris ${rec.source_row_number} dengan AI`}
                            className="p-1.5 rounded-md text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 cursor-pointer"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Import CSV Modal with Live Preview */}
      {importModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Import dan Pratinjau File CSV"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Import CSV & Pratinjau Validasi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onSetImportModalOpen(false)}
                aria-label="Tutup modal Import CSV"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="csv-file-upload"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Pilih File CSV (UTF-8) atau tempel teks di bawah
                  </label>
                  <input
                    id="csv-file-upload"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-100 dark:file:border-slate-700 dark:file:bg-slate-800 dark:file:text-slate-200"
                  />
                </div>
                <div>
                  <label
                    htmlFor="csv-delimiter-select"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Delimiter (Terdeteksi: {preview.delimiter === ';' ? 'Titik koma (;)' : 'Koma (,)'})
                  </label>
                  <select
                    id="csv-delimiter-select"
                    value={delimiterMode}
                    onChange={(e) => setDelimiterMode(e.target.value as 'auto' | ',' | ';')}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="auto">Auto-deteksi (, atau ;)</option>
                    <option value=",">Koma (,)</option>
                    <option value=";">Titik koma (;)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="csv-raw-textarea"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Konten CSV ({filename})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setFilename('contoh_semicolon_poi.csv');
                      setCsvText(SAMPLE_SEMICOLON_CSV);
                      setDelimiterMode('auto');
                    }}
                    className="text-xs text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
                  >
                    Muat Contoh Titik Koma (;)
                  </button>
                </div>
                <textarea
                  id="csv-raw-textarea"
                  rows={5}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full p-3 font-mono text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Validation Summary */}
              {preview.valid ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-4 text-xs p-3 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Header Valid
                    </span>
                    <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      Total: {preview.summary.total}
                    </span>
                    <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      Siap: {preview.summary.ready}
                    </span>
                    <span className="font-mono tabular-nums text-slate-500">
                      Dilewati: {preview.summary.skipped}
                    </span>
                    <span className="font-mono tabular-nums text-amber-700 dark:text-amber-400">
                      Perlu Tinjauan: {preview.summary.needs_review}
                    </span>
                    {preview.added_columns.length > 0 && (
                      <span className="text-slate-500">
                        Kolom otomatis ditambahkan: {preview.added_columns.join(', ')}
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-48">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2 px-2.5">#</th>
                          <th className="py-2 px-2.5">poi_name</th>
                          <th className="py-2 px-2.5">phone_number</th>
                          <th className="py-2 px-2.5">opening_hours</th>
                          <th className="py-2 px-2.5">Status Awal</th>
                          <th className="py-2 px-2.5">Catatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {preview.rows.slice(0, 10).map((row) => (
                          <tr key={row.record_id}>
                            <td className="py-1.5 px-2.5 font-mono text-slate-400">
                              {row.source_row_number}
                            </td>
                            <td className="py-1.5 px-2.5 font-medium text-slate-900 dark:text-slate-100">
                              {row.poi_name || '(kosong)'}
                            </td>
                            <td className="py-1.5 px-2.5 font-mono text-slate-800 dark:text-slate-200">
                              {row.phone_number || '—'}
                            </td>
                            <td className="py-1.5 px-2.5 font-mono text-slate-700 dark:text-slate-300">
                              {row.opening_hours || '—'}
                            </td>
                            <td className="py-1.5 px-2.5">
                              <RecordStatusText status={row.status} />
                            </td>
                            <td className="py-1.5 px-2.5 text-slate-500">{row.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{preview.errors.join(' ')}</span>
                </div>
              )}

              {importError && (
                <p className="text-xs text-red-600 dark:text-red-400">{importError}</p>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onSetImportModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!preview.valid || importing}
                onClick={handleConfirmImport}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#008844] text-white hover:bg-[#007038] disabled:opacity-45 transition-colors cursor-pointer"
              >
                {importing ? 'Menyimpan...' : `Impor ${preview.summary.total} Baris ke Database`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reprocess SUCCESS Confirmation Modal (PRD Rule 8) */}
      {reprocessConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi Proses Ulang Baris SUCCESS"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] p-5 space-y-4">
            <div className="flex items-start gap-2.5">
              <RotateCcw className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Konfirmasi Proses Ulang Baris SUCCESS
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Pilihan Anda mencakup baris yang sudah berstatus <code className="font-mono">SUCCESS</code>.
                  Secara default baris tersebut dilewati agar tidak terjadi entri duplikat di Grab. Lanjutkan proses ulang?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReprocessConfirmOpen(false)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setReprocessConfirmOpen(false);
                  onProcessSelectedRows(selectedRecordIds, true);
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
              >
                Ya, Proses Ulang Baris Terpilih
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Record Edit Modal */}
      {editingRecord && (
        <EditRecordModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSave={async (patch) => {
            await onUpdateRecordFields(editingRecord.record_id, patch);
            setEditingRecord(null);
          }}
        />
      )}
    </div>
  );
}

function EditRecordModal({
  record,
  onClose,
  onSave,
}: {
  record: PoiRecord;
  onClose: () => void;
  onSave: (
    patch: Partial<Pick<PoiRecord, 'poi_name' | 'phone_number' | 'website' | 'opening_hours' | 'status' | 'notes'>>
  ) => Promise<void>;
}) {
  const [poiName, setPoiName] = useState(record.poi_name);
  const [phone, setPhone] = useState(record.phone_number);
  const [website, setWebsite] = useState(record.website);
  const [hours, setHours] = useState(record.opening_hours);
  const [status, setStatus] = useState<RecordStatus>(record.status);
  const [notes, setNotes] = useState(record.notes);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Edit baris ${record.source_row_number}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Perbaiki Baris #{record.source_row_number} ({record.record_id})
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal edit baris"
            className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave({
              poi_name: poiName.trim(),
              phone_number: phone.trim(),
              website: website.trim(),
              opening_hours: hours.trim(),
              status,
              notes: notes.trim(),
            });
          }}
          className="p-5 space-y-3 text-xs"
        >
          <div>
            <label htmlFor="edit-poi-name" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nama Tempat (poi_name)
            </label>
            <input
              id="edit-poi-name"
              type="text"
              value={poiName}
              onChange={(e) => setPoiName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-phone" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nomor Telepon (Teks Utuh)
              </label>
              <input
                id="edit-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="edit-hours" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Jam Operasional
              </label>
              <input
                id="edit-hours"
                type="text"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="Mon-Sun 08:00-22:00"
                className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
          <div>
            <label htmlFor="edit-website" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Website (Opsional)
            </label>
            <input
              id="edit-website"
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-status" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Status Baris
              </label>
              <select
                id="edit-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as RecordStatus)}
                className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="PENDING">PENDING</option>
                <option value="SKIPPED">SKIPPED</option>
                <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                <option value="FAILED">FAILED</option>
                <option value="SUCCESS">SUCCESS</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-notes" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Catatan
              </label>
              <input
                id="edit-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-semibold rounded-lg bg-[#008844] text-white hover:bg-[#007038] cursor-pointer"
            >
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
