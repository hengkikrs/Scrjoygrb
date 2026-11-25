import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  AppSettings,
  AutomationLog,
  Job,
  PersistedWorkspaceState,
  PoiRecord,
  WorkflowProfile,
} from './types';
import { previewAndValidateCsv } from './csv-parser';
import { DEFAULT_APP_SETTINGS, DEFAULT_WORKFLOW_PROFILE } from './mock-device';
import { recoverInterruptedRecords } from './state-machine';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'jobs-store.json');

export const SAMPLE_SEED_CSV = `poi_name,phone_number,website,opening_hours,status,notes
Kopi Pagi Kemang,081234567890,https://kopipagi.example,Mon-Sun 08:00-22:00,,
Toko Sejahtera Mandiri,082112223333,https://tokosejahtera.example,Mon-Sat 09:00-17:00,,
Restoran Nusantara Asli,081298765432,,Mon-Sun 10:00-21:00,,
Apotek Sehat Sentosa,+6281399887766,https://apoteksehat.example,24/7,,
Warung Sate Pak Budi,085611223344,,Buka pagi sampai sore habis,,
,081122334455,https://tanpanama.example,Mon-Fri 08:00-16:00,,
Bakery Melati Sudirman,081777889900,https://bakerymelati.example,Mon-Sun 07:00-20:00,SUCCESS,Terverifikasi pada batch sebelumnya
Bengkel Motor Jaya,081900112233,not-a-valid-url,Mon-Sat 08:30-18:00,,`;

function buildSeedState(): PersistedWorkspaceState {
  const now = new Date().toISOString();
  const jobId = 'job_poi_jakarta_batch_01';
  const preview = previewAndValidateCsv(SAMPLE_SEED_CSV, ',');

  const job: Job = {
    job_id: jobId,
    source_filename: 'poi_jakarta_batch.csv',
    delimiter: preview.delimiter,
    created_at: now,
    updated_at: now,
    total_rows: preview.rows.length,
    job_status: 'IDLE',
  };

  const records: PoiRecord[] = preview.rows.map((row) => ({
    ...row,
    job_id: jobId,
    updated_at: now,
  }));

  const logs: AutomationLog[] = [
    {
      log_id: 'log_seed_01',
      job_id: jobId,
      record_id: null,
      timestamp: now,
      level: 'INFO',
      state: 'IDLE',
      message: 'Aplikasi dimulai. Database checkpoint lokal (SQLite-compatible store) siap.',
    },
    {
      log_id: 'log_seed_02',
      job_id: jobId,
      record_id: null,
      timestamp: now,
      level: 'INFO',
      state: 'IDLE',
      message: `CSV dimuat: ${job.source_filename} (${preview.summary.total} baris — ${preview.summary.ready} siap diproses, ${preview.summary.already_success} sudah SUCCESS, ${preview.summary.skipped} dilewati, ${preview.summary.needs_review} perlu tinjauan).`,
    },
  ];

  return {
    jobs: [job],
    active_job_id: jobId,
    records,
    logs,
    workflow_profile: DEFAULT_WORKFLOW_PROFILE,
    app_settings: DEFAULT_APP_SETTINGS,
  };
}

let storeMutex: Promise<void> = Promise.resolve();

async function withStoreLock<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = storeMutex;
  storeMutex = previous.then(() => next);
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function writeWorkspaceStateUnlocked(state: PersistedWorkspaceState): Promise<void> {
  await ensureDataDir();
  const payload = JSON.stringify(
    {
      ...state,
      logs: (state.logs ?? []).slice(0, 500),
    },
    null,
    2
  );
  // Unique temp path per write prevents ENOENT collisions under rapid concurrent requests
  const tmpPath = `${STORE_PATH}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(tmpPath, payload, 'utf-8');
  await fs.rename(tmpPath, STORE_PATH);
}

async function readWorkspaceStateUnlocked(
  recoverInterrupted: boolean
): Promise<PersistedWorkspaceState> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as PersistedWorkspaceState;

    if (recoverInterrupted) {
      // Enforce PRD Section 12 crash recovery rule on app boot / reload
      const { records, recoveredIds } = recoverInterruptedRecords(parsed.records ?? []);
      if (recoveredIds.length > 0) {
        const now = new Date().toISOString();
        const recoveryLog: AutomationLog = {
          log_id: `log_recover_${Date.now()}`,
          job_id: parsed.active_job_id ?? 'unknown',
          record_id: recoveredIds[0] ?? null,
          timestamp: now,
          level: 'WARN',
          state: 'IDLE',
          error_code: 'SUBMIT_UNCONFIRMED',
          message: `Pemulihan checkpoint: ${recoveredIds.length} baris berstatus IN_PROGRESS diubah ke NEEDS_REVIEW agar tidak terjadi submit ganda.`,
        };
        const updatedState: PersistedWorkspaceState = {
          ...parsed,
          records,
          logs: [recoveryLog, ...(parsed.logs ?? [])].slice(0, 500),
          recovered_interrupted_count: recoveredIds.length,
        };
        await writeWorkspaceStateUnlocked(updatedState);
        return updatedState;
      }
    }

    return {
      ...parsed,
      workflow_profile: parsed.workflow_profile ?? DEFAULT_WORKFLOW_PROFILE,
      app_settings: parsed.app_settings ?? DEFAULT_APP_SETTINGS,
      recovered_interrupted_count: 0,
    };
  } catch {
    const seed = buildSeedState();
    await writeWorkspaceStateUnlocked(seed);
    return seed;
  }
}

export async function readWorkspaceState(): Promise<PersistedWorkspaceState> {
  return withStoreLock(() => readWorkspaceStateUnlocked(true));
}

export async function writeWorkspaceState(state: PersistedWorkspaceState): Promise<void> {
  return withStoreLock(() => writeWorkspaceStateUnlocked(state));
}

export async function createJobFromCsv(
  filename: string,
  csvContent: string,
  forcedDelimiter?: ',' | ';'
): Promise<{ ok: boolean; error?: string; state?: PersistedWorkspaceState; job?: Job }> {
  const preview = previewAndValidateCsv(csvContent, forcedDelimiter);
  if (!preview.valid) {
    return {
      ok: false,
      error: preview.errors.join(' '),
    };
  }

  return withStoreLock(async () => {
    const current = await readWorkspaceStateUnlocked(false);
    const now = new Date().toISOString();
    const jobId = `job_${Date.now()}`;

    const job: Job = {
      job_id: jobId,
      source_filename: filename || 'imported_poi.csv',
      delimiter: preview.delimiter,
      created_at: now,
      updated_at: now,
      total_rows: preview.rows.length,
      job_status: 'IDLE',
    };

    const newRecords: PoiRecord[] = preview.rows.map((row) => ({
      ...row,
      job_id: jobId,
      updated_at: now,
    }));

    const importLog: AutomationLog = {
      log_id: `log_imp_${Date.now()}`,
      job_id: jobId,
      record_id: null,
      timestamp: now,
      level: 'INFO',
      state: 'IDLE',
      message: `CSV diimpor: ${job.source_filename} (${preview.summary.total} baris, delimiter "${preview.delimiter}"). Validasi selesai: ${preview.summary.ready} siap, ${preview.summary.already_success} SUCCESS, ${preview.summary.skipped} dilewati, ${preview.summary.needs_review} perlu tinjauan.`,
    };

    const nextState: PersistedWorkspaceState = {
      ...current,
      jobs: [job, ...current.jobs.slice(0, 9)],
      active_job_id: jobId,
      records: [...newRecords, ...current.records.filter((r) => r.job_id !== jobId)],
      logs: [importLog, ...current.logs].slice(0, 500),
    };

    await writeWorkspaceStateUnlocked(nextState);
    return { ok: true, state: nextState, job };
  });
}

export async function saveCheckpointUpdate(params: {
  jobId: string;
  jobStatus?: Job['job_status'];
  recordUpdates?: Array<Partial<PoiRecord> & { record_id: string }>;
  newLogs?: AutomationLog[];
}): Promise<PersistedWorkspaceState> {
  return withStoreLock(async () => {
    const current = await readWorkspaceStateUnlocked(false);
    const now = new Date().toISOString();

    const updateMap = new Map(
      (params.recordUpdates ?? []).map((u) => [u.record_id, u])
    );

    const records = current.records.map((rec) => {
      const patch = updateMap.get(rec.record_id);
      if (!patch) return rec;
      return {
        ...rec,
        ...patch,
        updated_at: now,
      };
    });

    const jobs = current.jobs.map((job) => {
      if (job.job_id !== params.jobId) return job;
      return {
        ...job,
        job_status: params.jobStatus ?? job.job_status,
        updated_at: now,
      };
    });

    const logs = [...(params.newLogs ?? []), ...current.logs].slice(0, 500);

    const nextState: PersistedWorkspaceState = {
      ...current,
      jobs,
      records,
      logs,
    };

    await writeWorkspaceStateUnlocked(nextState);
    return nextState;
  });
}

export async function updateSettingsAndProfile(params: {
  workflow_profile?: WorkflowProfile;
  app_settings?: AppSettings;
}): Promise<PersistedWorkspaceState> {
  return withStoreLock(async () => {
    const current = await readWorkspaceStateUnlocked(false);
    const nextState: PersistedWorkspaceState = {
      ...current,
      workflow_profile: params.workflow_profile ?? current.workflow_profile,
      app_settings: params.app_settings ?? current.app_settings,
    };
    await writeWorkspaceStateUnlocked(nextState);
    return nextState;
  });
}

export async function purgeSensitiveEvidence(
  mode: 'screenshots_only' | 'all_logs'
): Promise<PersistedWorkspaceState> {
  return withStoreLock(async () => {
    const current = await readWorkspaceStateUnlocked(false);
    const now = new Date().toISOString();
    const purgedLog: AutomationLog = {
      log_id: `log_purge_${Date.now()}`,
      job_id: current.active_job_id ?? 'system',
      record_id: null,
      timestamp: now,
      level: 'INFO',
      state: 'IDLE',
      message:
        mode === 'all_logs'
          ? 'Seluruh riwayat log & bukti screenshot telah dihapus oleh operator demi privasi.'
          : 'Seluruh lampiran bukti screenshot pada log telah dihapus demi privasi.',
    };

    const nextLogs =
      mode === 'all_logs'
        ? [purgedLog]
        : [
            purgedLog,
            ...current.logs.map((l) => ({
              ...l,
              screenshot_snapshot: null,
            })),
          ];

    const nextState: PersistedWorkspaceState = {
      ...current,
      logs: nextLogs,
    };
    await writeWorkspaceStateUnlocked(nextState);
    return nextState;
  });
}

export async function resetToSeedWorkspace(): Promise<PersistedWorkspaceState> {
  return withStoreLock(async () => {
    const seed = buildSeedState();
    await writeWorkspaceStateUnlocked(seed);
    return seed;
  });
}
