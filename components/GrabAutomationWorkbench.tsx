'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  FileSpreadsheet,
  FolderCode,
  GitBranch,
  LayoutDashboard,
  Menu,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import type {
  AdbConnectionState,
  AppSettings,
  AutomationLog,
  AutomationMode,
  DeviceInfo,
  ErrorCode,
  FieldVerificationResult,
  LocalScrcpyDiagnostics,
  MockFormValues,
  PersistedWorkspaceState,
  PoiRecord,
  ScreenType,
  WorkflowProfile,
  WorkflowState,
} from '@/lib/types';
import {
  createScreenshotEvidence,
  EMPTY_FORM_VALUES,
  getScreenMeta,
  INITIAL_MOCK_DEVICES,
} from '@/lib/mock-device';
import { isAllowedLocalBridgeUrlClient } from '@/lib/scrcpy-client';
import { stepWorkflowMachine } from '@/lib/state-machine';
import DashboardView from './DashboardView';
import CsvDataView from './CsvDataView';
import DeviceVisionView, { type LocalBridgeTransport } from './DeviceVisionView';
import WorkflowLogsView from './WorkflowLogsView';
import DesktopAgentView from './DesktopAgentView';
import AiAssistModal from './AiAssistModal';

type NavTab = 'dashboard' | 'csv' | 'device' | 'workflow' | 'desktop';

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'csv', label: 'Data CSV', icon: FileSpreadsheet },
  { id: 'device', label: 'Perangkat & Vision', icon: Smartphone },
  { id: 'workflow', label: 'Workflow & Log', icon: GitBranch },
  { id: 'desktop', label: 'Desktop Agent', icon: FolderCode },
];

export default function GrabAutomationWorkbench({
  initialState,
}: {
  initialState: PersistedWorkspaceState;
}) {
  const [workspace, setWorkspace] = useState<PersistedWorkspaceState>(initialState);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Device & Vision runtime state
  const [devices, setDevices] = useState<DeviceInfo[]>(INITIAL_MOCK_DEVICES);
  const [selectedSerial, setSelectedSerial] = useState<string>(INITIAL_MOCK_DEVICES[0].serial);
  const [screen, setScreen] = useState<ScreenType>('GRAB_HOME');
  const [formValues, setFormValues] = useState<MockFormValues>(EMPTY_FORM_VALUES);
  const [showOcrOverlay, setShowOcrOverlay] = useState(true);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [injectedFault, setInjectedFault] = useState<ErrorCode | null>(null);
  const [isScanningLocalAdb, setIsScanningLocalAdb] = useState(false);
  const [localDiagnostics, setLocalDiagnostics] = useState<LocalScrcpyDiagnostics | null>(null);
  const [bridgeTransport, setBridgeTransport] = useState<LocalBridgeTransport>('server_local');
  const [bridgeUrl, setBridgeUrl] = useState('http://127.0.0.1:17890');
  const [bridgeToken, setBridgeToken] = useState('');
  const [liveScreenshotUrl, setLiveScreenshotUrl] = useState<string | null>(null);

  // State machine runtime state
  const [workflowState, setWorkflowState] = useState<WorkflowState>('IDLE');
  const [isRunning, setIsRunning] = useState(false);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [queueRecordIds, setQueueRecordIds] = useState<string[]>([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [verifications, setVerifications] = useState<FieldVerificationResult[]>([]);
  const [scrollCount, setScrollCount] = useState(0);
  const [fieldRetryCount, setFieldRetryCount] = useState(0);
  const [manualTakeoverActive, setManualTakeoverActive] = useState(false);
  const [preTakeoverState, setPreTakeoverState] = useState<WorkflowState>('SCREEN_CHECK');
  const [operatorApprovedSubmit, setOperatorApprovedSubmit] = useState(false);
  const [recoveredCount, setRecoveredCount] = useState(
    initialState.recovered_interrupted_count ?? 0
  );

  // Modals
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [autoSubmitModalOpen, setAutoSubmitModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiScheduleTargetRecord, setAiScheduleTargetRecord] = useState<PoiRecord | null>(null);

  // Sync theme with <html> class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const activeJob = useMemo(
    () =>
      workspace.jobs.find((j) => j.job_id === workspace.active_job_id) ??
      workspace.jobs[0] ??
      null,
    [workspace.jobs, workspace.active_job_id]
  );

  const activeJobRecords = useMemo(
    () =>
      activeJob
        ? workspace.records.filter((r) => r.job_id === activeJob.job_id)
        : [],
    [workspace.records, activeJob]
  );

  const activeRecord = useMemo(
    () => activeJobRecords.find((r) => r.record_id === activeRecordId) ?? null,
    [activeJobRecords, activeRecordId]
  );

  const selectedDevice = useMemo(
    () => devices.find((d) => d.serial === selectedSerial) ?? devices[0],
    [devices, selectedSerial]
  );

  // Keep latest state in a ref for clean timer-driven ticks without dependency thrashing
  const runtimeRef = useRef({
    workspace,
    activeJob,
    activeJobRecords,
    selectedDevice,
    screen,
    formValues,
    workflowState,
    activeRecordId,
    queueRecordIds,
    verifications,
    scrollCount,
    fieldRetryCount,
    operatorApprovedSubmit,
    injectedFault,
    lowConfidence,
  });

  useEffect(() => {
    runtimeRef.current = {
      workspace,
      activeJob,
      activeJobRecords,
      selectedDevice,
      screen,
      formValues,
      workflowState,
      activeRecordId,
      queueRecordIds,
      verifications,
      scrollCount,
      fieldRetryCount,
      operatorApprovedSubmit,
      injectedFault,
      lowConfidence,
    };
  });

  const persistCheckpoint = useCallback(
    async (params: {
      jobStatus?: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED';
      recordUpdates?: Array<Partial<PoiRecord> & { record_id: string }>;
      newLogs?: AutomationLog[];
    }) => {
      const jobId = runtimeRef.current.activeJob?.job_id;
      if (!jobId) return;

      // Optimistic local state update for crisp <=100ms feedback
      setWorkspace((prev) => {
        const updateMap = new Map(
          (params.recordUpdates ?? []).map((u) => [u.record_id, u])
        );
        const now = new Date().toISOString();
        return {
          ...prev,
          jobs: prev.jobs.map((j) =>
            j.job_id === jobId
              ? { ...j, job_status: params.jobStatus ?? j.job_status, updated_at: now }
              : j
          ),
          records: prev.records.map((r) => {
            const patch = updateMap.get(r.record_id);
            return patch ? { ...r, ...patch, updated_at: now } : r;
          }),
          logs: [...(params.newLogs ?? []), ...prev.logs].slice(0, 500),
        };
      });

      try {
        await fetch(`/api/jobs/${encodeURIComponent(jobId)}/checkpoint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
      } catch {
        // Keep optimistic state; operator can retry persistence on next step
      }
    },
    []
  );

  const appendLog = useCallback(
    (
      level: AutomationLog['level'],
      message: string,
      opts?: {
        state?: WorkflowState;
        recordId?: string | null;
        errorCode?: ErrorCode | null;
        captureEvidence?: boolean;
      }
    ) => {
      const cur = runtimeRef.current;
      const logEntry: AutomationLog = {
        log_id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        job_id: cur.activeJob?.job_id ?? 'system',
        record_id: opts?.recordId ?? cur.activeRecordId,
        timestamp: new Date().toISOString(),
        level,
        state: opts?.state ?? cur.workflowState,
        error_code: opts?.errorCode ?? null,
        message,
        screenshot_snapshot: opts?.captureEvidence
          ? createScreenshotEvidence(
              cur.selectedDevice,
              cur.screen,
              cur.formValues,
              message,
              cur.lowConfidence
            )
          : null,
      };
      void persistCheckpoint({ newLogs: [logEntry] });
    },
    [persistCheckpoint]
  );

  // Worker tick effect: executes one deterministic state machine transition per step delay
  useEffect(() => {
    if (!isRunning) return;

    const delay = Math.max(220, runtimeRef.current.workspace.app_settings.step_delay_ms || 480);
    const timer = setTimeout(() => {
      const cur = runtimeRef.current;
      const out = stepWorkflowMachine(
        {
          state: cur.workflowState,
          activeRecordId: cur.activeRecordId,
          queueRecordIds: cur.queueRecordIds,
          device: cur.selectedDevice,
          screen: cur.screen,
          formValues: cur.formValues,
          scrollCount: cur.scrollCount,
          fieldRetryCount: cur.fieldRetryCount,
          verifications: cur.verifications,
          automationMode: cur.workspace.app_settings.automation_mode,
          autoSubmitPolicyAcknowledged:
            cur.workspace.app_settings.auto_submit_policy_acknowledged,
          skipExistingSuccess: cur.workspace.app_settings.skip_existing_success,
          operatorApprovedSubmit: cur.operatorApprovedSubmit,
          injectedFault: cur.injectedFault,
          lowOcrConfidence: cur.lowConfidence,
        },
        cur.activeJobRecords,
        cur.workspace.workflow_profile
      );

      setWorkflowState(out.nextState);
      setScreen(out.updatedScreen);
      setFormValues(out.updatedFormValues);
      setActiveRecordId(out.activeRecordId);
      setScrollCount(out.scrollCount);
      setFieldRetryCount(out.fieldRetryCount);

      if (out.nextState === 'READ_NEXT_CSV_ROW' || out.nextState === 'OPEN_POI_FORM') {
        setVerifications([]);
        setOperatorApprovedSubmit(false);
      }

      if (out.verificationAdded) {
        setVerifications((prev) => [
          ...prev.filter((v) => v.field !== out.verificationAdded!.field),
          out.verificationAdded!,
        ]);
      }

      if (out.consumeInjectedFault) {
        setInjectedFault(null);
      }

      if (out.shouldPause) {
        setIsRunning(false);
      }

      const logEntry: AutomationLog = {
        log_id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        job_id: cur.activeJob?.job_id ?? 'system',
        record_id: out.recordUpdate?.record_id ?? out.activeRecordId,
        timestamp: new Date().toISOString(),
        level: out.log.level,
        state: out.nextState,
        error_code: out.log.error_code ?? null,
        message: out.log.message,
        screenshot_snapshot: out.log.capture_evidence
          ? createScreenshotEvidence(
              cur.selectedDevice,
              out.updatedScreen,
              out.updatedFormValues,
              out.log.message,
              cur.lowConfidence
            )
          : null,
      };

      const recordUpdates = out.recordUpdate
        ? [
            {
              record_id: out.recordUpdate.record_id,
              status: out.recordUpdate.status,
              ...(out.recordUpdate.notes !== undefined
                ? { notes: out.recordUpdate.notes }
                : {}),
              ...(out.recordUpdate.last_error !== undefined
                ? { last_error: out.recordUpdate.last_error }
                : {}),
              ...(out.recordUpdate.increment_attempt
                ? {
                    attempt_count:
                      (cur.activeJobRecords.find(
                        (r) => r.record_id === out.recordUpdate!.record_id
                      )?.attempt_count ?? 0) + 1,
                  }
                : {}),
            },
          ]
        : undefined;

      void persistCheckpoint({
        jobStatus: out.completedBatch
          ? 'COMPLETED'
          : out.shouldPause
            ? 'PAUSED'
            : 'RUNNING',
        recordUpdates,
        newLogs: [logEntry],
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [isRunning, workflowState, scrollCount, fieldRetryCount, operatorApprovedSubmit, persistCheckpoint]);

  // --- Automation Control Handlers ---
  function handleStart(customQueueIds?: string[]) {
    setManualTakeoverActive(false);
    setOperatorApprovedSubmit(false);
    setVerifications([]);
    setQueueRecordIds(customQueueIds ?? []);
    setWorkflowState('DEVICE_CHECK');
    setIsRunning(true);
    appendLog(
      'INFO',
      customQueueIds && customQueueIds.length > 0
        ? `Memulai otomasi untuk ${customQueueIds.length} baris terpilih (Mode: ${workspace.app_settings.automation_mode}).`
        : `Memulai otomasi batch (Mode: ${workspace.app_settings.automation_mode}).`,
      { state: 'DEVICE_CHECK' }
    );
  }

  function handlePause() {
    setIsRunning(false);
    setWorkflowState('PAUSED');
    void persistCheckpoint({
      jobStatus: 'PAUSED',
      newLogs: [
        {
          log_id: `log_pause_${Date.now()}`,
          job_id: activeJob?.job_id ?? 'system',
          record_id: activeRecordId,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          state: 'PAUSED',
          message: 'Otomasi dijeda pada titik aman. Checkpoint tersimpan dan scrcpy tetap terbuka.',
        },
      ],
    });
  }

  function handleResume() {
    if (selectedDevice.adb_state !== 'device') {
      appendLog(
        'ERROR',
        `Tidak dapat Resume: perangkat ${selectedDevice.serial} berstatus ${selectedDevice.adb_state}.`,
        {
          errorCode:
            selectedDevice.adb_state === 'unauthorized'
              ? 'DEVICE_UNAUTHORIZED'
              : 'DEVICE_OFFLINE',
        }
      );
      return;
    }
    setManualTakeoverActive(false);
    const resumeState: WorkflowState =
      activeRecordId && screen === 'POI_FORM_TOP'
        ? 'FILL_POI_NAME'
        : activeRecordId && screen === 'POI_FORM_SCROLLED'
          ? 'FILL_OPENING_HOURS'
          : 'DEVICE_CHECK';
    setWorkflowState(resumeState);
    setIsRunning(true);
    appendLog('INFO', 'Otomasi dilanjutkan (Resume) setelah pemeriksaan perangkat & layar.', {
      state: resumeState,
    });
  }

  function handleStop() {
    setIsRunning(false);
    setManualTakeoverActive(false);
    setOperatorApprovedSubmit(false);

    // PRD Section 14: Never mark uncertain active row as SUCCESS on Stop
    const updates: Array<Partial<PoiRecord> & { record_id: string }> = [];
    if (activeRecord && activeRecord.status === 'IN_PROGRESS') {
      updates.push({
        record_id: activeRecord.record_id,
        status: 'NEEDS_REVIEW',
        notes: 'Dihentikan oleh operator sebelum verifikasi selesai (Stop)',
      });
    }

    setWorkflowState('STOPPED');
    setActiveRecordId(null);
    void persistCheckpoint({
      jobStatus: 'STOPPED',
      recordUpdates: updates,
      newLogs: [
        {
          log_id: `log_stop_${Date.now()}`,
          job_id: activeJob?.job_id ?? 'system',
          record_id: activeRecord?.record_id ?? null,
          timestamp: new Date().toISOString(),
          level: 'WARN',
          state: 'STOPPED',
          message:
            'Otomasi dihentikan secara terkontrol oleh operator. Status & log tersimpan aman.',
        },
      ],
    });
  }

  function handleManualTakeover() {
    setIsRunning(false);
    setPreTakeoverState(workflowState);
    setManualTakeoverActive(true);
    setWorkflowState('MANUAL_TAKEOVER');
    appendLog(
      'WARN',
      'Manual Takeover diaktifkan. Operator mengendalikan HP via scrcpy secara langsung.',
      { state: 'MANUAL_TAKEOVER' }
    );
  }

  function handleCompleteManualTakeover() {
    const meta = getScreenMeta(screen);
    if (!meta.recognized || meta.isSecurityChallenge) {
      appendLog(
        'WARN',
        `Validasi layar pasca Manual Takeover belum siap (${meta.title}). Selesaikan dialog atau kembali ke formulir POI terlebih dahulu.`,
        { state: 'MANUAL_TAKEOVER', captureEvidence: true }
      );
      return;
    }

    setManualTakeoverActive(false);
    const nextState: WorkflowState =
      preTakeoverState === 'WAIT_FOR_OPERATOR_CONFIRMATION'
        ? 'WAIT_FOR_OPERATOR_CONFIRMATION'
        : activeRecordId
          ? 'VERIFY_POI_NAME'
          : 'SCREEN_CHECK';
    setWorkflowState(nextState);
    if (nextState !== 'WAIT_FOR_OPERATOR_CONFIRMATION') {
      setIsRunning(true);
    }
    appendLog(
      'SUCCESS',
      `Manual Takeover selesai. Screenshot baru diambil & layar tervalidasi (${meta.title}).`,
      { state: nextState, captureEvidence: true }
    );
  }

  function handleConfirmSubmit() {
    setOperatorApprovedSubmit(true);
    setIsRunning(true);
  }

  function handleMarkActiveNeedsReview() {
    if (!activeRecord) return;
    setIsRunning(false);
    setOperatorApprovedSubmit(false);
    setWorkflowState('SAVE_CHECKPOINT');
    void persistCheckpoint({
      jobStatus: 'PAUSED',
      recordUpdates: [
        {
          record_id: activeRecord.record_id,
          status: 'NEEDS_REVIEW',
          notes: 'Ditandai NEEDS_REVIEW oleh operator pada tahap konfirmasi',
        },
      ],
      newLogs: [
        {
          log_id: `log_rev_${Date.now()}`,
          job_id: activeJob?.job_id ?? 'system',
          record_id: activeRecord.record_id,
          timestamp: new Date().toISOString(),
          level: 'WARN',
          state: 'MARK_NEEDS_REVIEW',
          message: `Baris #${activeRecord.source_row_number} (${activeRecord.poi_name}) ditandai NEEDS_REVIEW oleh operator.`,
        },
      ],
    });
    setActiveRecordId(null);
    setScreen('POI_FORM_TOP');
    setFormValues(EMPTY_FORM_VALUES);
  }

  async function handleRetryFailed() {
    const targets = activeJobRecords.filter(
      (r) => r.status === 'FAILED' || r.status === 'NEEDS_REVIEW'
    );
    if (targets.length === 0) return;

    await persistCheckpoint({
      recordUpdates: targets.map((r) => ({
        record_id: r.record_id,
        status: 'PENDING',
        last_error: null,
        notes: 'Dijadwalkan ulang oleh operator (Retry Failed / Review)',
      })),
      newLogs: [
        {
          log_id: `log_retry_${Date.now()}`,
          job_id: activeJob?.job_id ?? 'system',
          record_id: null,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          state: 'IDLE',
          message: `${targets.length} baris FAILED/NEEDS_REVIEW dikembalikan ke PENDING atas permintaan operator.`,
        },
      ],
    });
    handleStart(targets.map((t) => t.record_id));
  }

  async function handleProcessSelectedRows(ids: string[], allowReprocessSuccess: boolean) {
    if (ids.length === 0) return;
    const updates = ids
      .map((id) => activeJobRecords.find((r) => r.record_id === id))
      .filter((r): r is PoiRecord => Boolean(r))
      .filter((r) => allowReprocessSuccess || r.status !== 'SUCCESS')
      .map((r) => ({
        record_id: r.record_id,
        status: 'PENDING' as const,
        notes:
          r.status === 'SUCCESS'
            ? 'Diproses ulang atas konfirmasi eksplisit operator'
            : r.notes,
      }));

    if (updates.length === 0) {
      appendLog(
        'WARN',
        'Tidak ada baris yang memenuhi syarat (baris SUCCESS dilewati secara default).'
      );
      return;
    }

    await persistCheckpoint({
      recordUpdates: updates,
      newLogs: [
        {
          log_id: `log_sel_${Date.now()}`,
          job_id: activeJob?.job_id ?? 'system',
          record_id: null,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          state: 'IDLE',
          message: `Menjalankan ${updates.length} baris terpilih atas permintaan operator.`,
        },
      ],
    });
    setActiveTab('dashboard');
    handleStart(updates.map((u) => u.record_id));
  }

  // --- Device & genymobile/scrcpy Handlers ---
  async function callScrcpyTransport(
    endpoint: 'scan' | 'launch_scrcpy' | 'close_scrcpy' | 'connect_wireless' | 'capture_screenshot',
    payload: Record<string, unknown> = {}
  ): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
    if (bridgeTransport === 'pc_bridge') {
      const normalized = bridgeUrl.trim().replace(/\/+$/, '');
      if (!isAllowedLocalBridgeUrlClient(normalized)) {
        return {
          ok: false,
          status: 400,
          data: {
            error: 'URL Bridge tidak valid. Hanya http://127.0.0.1:<port> atau http://localhost:<port> yang diizinkan.',
          },
        };
      }
      if (!bridgeToken.trim()) {
        return {
          ok: false,
          status: 401,
          data: {
            error: 'Masukkan Token Sesi Bridge terlebih dahulu (salin dari terminal start_scrcpy_bridge.bat).',
          },
        };
      }
      const routeMap = {
        scan: '/scan',
        launch_scrcpy: '/scrcpy/launch',
        close_scrcpy: '/scrcpy/close',
        connect_wireless: '/adb/connect',
        capture_screenshot: '/adb/screenshot',
      };
      const res = await fetch(`${normalized}${routeMap[endpoint]}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bridge-Token': bridgeToken.trim(),
        },
        body: JSON.stringify({
          action: endpoint,
          adbPath: workspace.app_settings.adb_executable_path,
          scrcpyPath: workspace.app_settings.scrcpy_executable_path,
          scrcpyOptions: workspace.app_settings.scrcpy_options,
          ...payload,
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      return { ok: res.ok, status: res.status, data };
    }

    if (endpoint === 'scan') {
      const res = await fetch('/api/local-adb');
      const data = (await res.json()) as Record<string, unknown>;
      return { ok: res.ok, status: res.status, data };
    }

    const res = await fetch('/api/local-adb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: endpoint,
        scrcpyOptions: workspace.app_settings.scrcpy_options,
        ...payload,
      }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  }

  async function handleScanLocalAdb() {
    setIsScanningLocalAdb(true);
    try {
      const res = await callScrcpyTransport('scan');
      if (!res.ok) {
        const errMsg = String(res.data.error || 'Gagal menghubungi bridge lokal.');
        setLocalDiagnostics({
          adb_available: false,
          adb_path: workspace.app_settings.adb_executable_path,
          adb_version: null,
          scrcpy_available: false,
          scrcpy_path: workspace.app_settings.scrcpy_executable_path,
          scrcpy_version: null,
          devices: [],
          message: errMsg,
          troubleshooting_tips: [
            'Pastikan jendela terminal start_scrcpy_bridge.bat masih terbuka dan Token Sesi sesuai.',
          ],
          source: bridgeTransport,
        });
        appendLog('WARN', `Pindai ADB & scrcpy: ${errMsg}`);
        return;
      }

      const data = res.data as unknown as LocalScrcpyDiagnostics;
      setLocalDiagnostics(data);

      if (data.adb_available && Array.isArray(data.devices) && data.devices.length > 0) {
        setDevices((prev) => {
          const mockOnly = prev.filter((d) => d.is_mock);
          return [...data.devices, ...mockOnly];
        });
        const firstReady =
          data.devices.find((d) => d.adb_state === 'device') ?? data.devices[0];
        if (firstReady) {
          setSelectedSerial(firstReady.serial);
        }
        appendLog('SUCCESS', `Pindai ADB & scrcpy: ${data.message}`);
      } else {
        appendLog(
          data.adb_available ? 'INFO' : 'WARN',
          `Pindai ADB & scrcpy: ${data.message}`
        );
      }
    } catch {
      const fallbackMsg =
        bridgeTransport === 'pc_bridge'
          ? 'Tidak dapat terhubung ke Bridge PC Lokal di 127.0.0.1:17890. Pastikan start_scrcpy_bridge.bat sedang berjalan di PC Anda.'
          : 'Gagal menghubungi jembatan ADB lokal. Gunakan Bridge PC Lokal (127.0.0.1:17890) atau Mock ADB Mode.';
      setLocalDiagnostics({
        adb_available: false,
        adb_path: workspace.app_settings.adb_executable_path,
        adb_version: null,
        scrcpy_available: false,
        scrcpy_path: workspace.app_settings.scrcpy_executable_path,
        scrcpy_version: null,
        devices: [],
        message: fallbackMsg,
        troubleshooting_tips: [
          'Klik "Unduh Bridge scrcpy (.zip)", ekstrak, klik 2x start_scrcpy_bridge.bat, lalu salin Token Sesi.',
        ],
        source: bridgeTransport,
      });
      appendLog('WARN', fallbackMsg);
    } finally {
      setIsScanningLocalAdb(false);
    }
  }

  async function handleConnectWirelessAdb(hostPort: string): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await callScrcpyTransport('connect_wireless', { hostPort });
      if (!res.ok) {
        const msg = String(res.data.error || 'Gagal menyambungkan Wi-Fi ADB.');
        appendLog('WARN', `Wi-Fi ADB (${hostPort}): ${msg}`);
        return { ok: false, message: msg };
      }
      const msg = String(res.data.output || `Terhubung ke ${hostPort}`);
      appendLog('SUCCESS', `Wi-Fi ADB: ${msg}`);
      await handleScanLocalAdb();
      return { ok: true, message: msg };
    } catch {
      return {
        ok: false,
        message: 'Tidak dapat menghubungi jembatan ADB. Pastikan Bridge PC Lokal atau localhost aktif.',
      };
    }
  }

  function handleRefreshDevices() {
    appendLog(
      'INFO',
      `adb devices dijalankan: ${devices.length} perangkat terdeteksi (${selectedDevice.serial}: ${selectedDevice.adb_state}).`
    );
  }

  function handleConnectDevice() {
    setDevices((prev) =>
      prev.map((d) =>
        d.serial === selectedSerial ? { ...d, adb_state: 'device' } : d
      )
    );
    appendLog(
      'SUCCESS',
      `Device connected: ${selectedDevice.model} (${selectedDevice.serial}, ${selectedDevice.resolution})`
    );
  }

  function handleSetDeviceAdbState(serial: string, adbState: AdbConnectionState) {
    setDevices((prev) =>
      prev.map((d) =>
        d.serial === serial
          ? {
              ...d,
              adb_state: adbState,
              scrcpy_running: adbState === 'device' ? d.scrcpy_running : false,
              scrcpy_pid: adbState === 'device' ? d.scrcpy_pid : null,
            }
          : d
      )
    );
    appendLog(
      adbState === 'device' ? 'SUCCESS' : 'WARN',
      `Status ADB perangkat ${serial} berubah menjadi "${adbState}".`,
      {
        errorCode:
          adbState === 'unauthorized'
            ? 'DEVICE_UNAUTHORIZED'
            : adbState === 'offline'
              ? 'DEVICE_OFFLINE'
              : null,
      }
    );
  }

  async function handleToggleScrcpy() {
    if (selectedDevice.adb_state !== 'device') {
      appendLog(
        'ERROR',
        'SCRCPY_FAILED: Tidak dapat menjalankan scrcpy sebelum status ADB perangkat adalah "device".',
        { errorCode: 'SCRCPY_FAILED' }
      );
      return;
    }

    const willRun = !selectedDevice.scrcpy_running;

    // If running against a real local USB/Wi-Fi device, launch/close real genymobile/scrcpy
    if (!selectedDevice.is_mock) {
      try {
        const res = await callScrcpyTransport(
          willRun ? 'launch_scrcpy' : 'close_scrcpy',
          { serial: selectedDevice.serial }
        );
        if (!res.ok || res.data.error) {
          appendLog(
            'ERROR',
            String(res.data.error ?? 'SCRCPY_FAILED: Gagal menjalankan scrcpy lokal.'),
            { errorCode: 'SCRCPY_FAILED' }
          );
          return;
        }
        const realPid = willRun && typeof res.data.pid === 'number' ? res.data.pid : null;
        setDevices((prev) =>
          prev.map((d) =>
            d.serial === selectedDevice.serial
              ? { ...d, scrcpy_running: willRun, scrcpy_pid: realPid }
              : d
          )
        );
        appendLog(
          'SUCCESS',
          willRun
            ? `scrcpy lokal berjalan untuk ${selectedDevice.serial} (PID ${realPid}).`
            : `Proses scrcpy lokal untuk ${selectedDevice.serial} ditutup.`
        );
      } catch {
        appendLog('ERROR', 'SCRCPY_FAILED: Tidak dapat menghubungi endpoint scrcpy lokal.', {
          errorCode: 'SCRCPY_FAILED',
        });
      }
      return;
    }

    const pid = willRun ? Math.floor(14000 + Math.random() * 4000) : null;
    setDevices((prev) =>
      prev.map((d) =>
        d.serial === selectedSerial
          ? { ...d, scrcpy_running: willRun, scrcpy_pid: pid }
          : d
      )
    );
    appendLog(
      'INFO',
      willRun
        ? `scrcpy dijalankan untuk serial ${selectedDevice.serial} (PID ${pid}). Status ADB terverifikasi device.`
        : `Proses scrcpy (PID ${selectedDevice.scrcpy_pid}) ditutup secara aman.`
    );
  }

  async function handleTakeScreenshot() {
    if (selectedDevice.adb_state !== 'device') return;
    if (!selectedDevice.is_mock) {
      try {
        const res = await callScrcpyTransport('capture_screenshot', {
          serial: selectedDevice.serial,
        });
        if (res.ok && typeof res.data.dataUrl === 'string') {
          setLiveScreenshotUrl(res.data.dataUrl);
          appendLog(
            'SUCCESS',
            `Screenshot PNG langsung diambil dari perangkat ${selectedDevice.serial}.`
          );
          return;
        }
        appendLog(
          'WARN',
          `Gagal ambil screenshot nyata: ${String(res.data.error || 'ADB error')}`
        );
        return;
      } catch {
        appendLog('WARN', 'Gagal menghubungi bridge untuk mengambil screenshot nyata.');
        return;
      }
    }
    appendLog(
      'INFO',
      `Screenshot diambil via adb screencap (${selectedDevice.serial} · ${getScreenMeta(screen).title}).`,
      { captureEvidence: true }
    );
  }

  // --- Settings, CSV & Persistence Handlers ---
  async function saveSettings(nextSettings: AppSettings) {
    setWorkspace((prev) => ({ ...prev, app_settings: nextSettings }));
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_settings: nextSettings }),
    });
  }

  async function saveProfile(nextProfile: WorkflowProfile) {
    setWorkspace((prev) => ({ ...prev, workflow_profile: nextProfile }));
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_profile: nextProfile }),
    });
    appendLog('INFO', `Kalibrasi workflow_profile.json disimpan (ambang OCR ${Math.round(nextProfile.ocr_confidence_threshold * 100)}%).`);
  }

  function handleModeChange(mode: AutomationMode) {
    if (mode === 'AUTO_SUBMIT' && !workspace.app_settings.auto_submit_policy_acknowledged) {
      setAutoSubmitModalOpen(true);
      return;
    }
    void saveSettings({ ...workspace.app_settings, automation_mode: mode });
    appendLog('INFO', `Mode otomasi diubah ke ${mode === 'ASSISTED' ? 'Assisted Mode (default aman)' : 'Auto-submit'}.`);
  }

  async function handleImportCsv(
    name: string,
    content: string,
    delimiter?: ',' | ';'
  ) {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: name, csvContent: content, delimiter }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'CSV_INVALID');
    }
    setIsRunning(false);
    setWorkflowState('IDLE');
    setActiveRecordId(null);
    setSelectedRecordIds([]);
    setWorkspace(data as PersistedWorkspaceState);
  }

  async function handleUpdateRecordFields(
    recordId: string,
    patch: Partial<Pick<PoiRecord, 'poi_name' | 'phone_number' | 'website' | 'opening_hours' | 'status' | 'notes'>>
  ) {
    await persistCheckpoint({
      recordUpdates: [{ record_id: recordId, ...patch }],
      newLogs: [
        {
          log_id: `log_edit_${Date.now()}`,
          job_id: activeJob?.job_id ?? 'system',
          record_id: recordId,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          state: workflowState,
          message: `Baris ${recordId} diperbarui secara manual oleh operator.`,
        },
      ],
    });
  }

  async function handlePurgeEvidence(mode: 'screenshots_only' | 'all_logs') {
    const res = await fetch(`/api/state?mode=${mode}`, { method: 'DELETE' });
    if (res.ok) {
      const next = (await res.json()) as PersistedWorkspaceState;
      setWorkspace(next);
    }
  }

  async function handleSimulateCrashRecovery() {
    const candidate = activeJobRecords.find((r) => r.status === 'PENDING') ?? activeJobRecords[0];
    if (!candidate) return;
    setIsRunning(false);
    await persistCheckpoint({
      jobStatus: 'RUNNING',
      recordUpdates: [{ record_id: candidate.record_id, status: 'IN_PROGRESS' }],
    });
    // Reload fresh from server API so crash recovery rule triggers deterministically
    const res = await fetch('/api/state');
    if (res.ok) {
      const recoveredState = (await res.json()) as PersistedWorkspaceState;
      setWorkspace(recoveredState);
      setRecoveredCount(recoveredState.recovered_interrupted_count ?? 1);
      setActiveTab('dashboard');
    }
  }

  async function handleResetSeedWorkspace() {
    setIsRunning(false);
    setWorkflowState('IDLE');
    setActiveRecordId(null);
    setSelectedRecordIds([]);
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_seed' }),
    });
    if (res.ok) {
      const seed = (await res.json()) as PersistedWorkspaceState;
      setWorkspace(seed);
      setRecoveredCount(0);
    }
  }

  const activeNavLabel =
    NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? 'Dashboard';

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-900 dark:bg-[#0B111A] dark:text-slate-100">
      {/* Desktop Sidebar (248px) */}
      <aside className="hidden lg:flex lg:w-[248px] lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0F1724]">
        <div className="h-16 px-5 flex items-center border-b border-slate-200 dark:border-slate-800">
          <span className="font-display text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            Grab Automation Agent
          </span>
        </div>

        <nav aria-label="Navigasi utama" className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-emerald-50 text-[#007038] dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>
              {workspace.app_settings.automation_mode === 'ASSISTED'
                ? 'Assisted Mode Aktif'
                : 'Auto-submit Aktif'}
            </span>
          </div>
          <p className="leading-relaxed">
            Database lokal aktif. Progres disimpan per baris dengan pemulihan crash otomatis.
          </p>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[80vw] bg-white dark:bg-[#0F1724] border-r border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <span className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Grab Automation Agent
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Tutup menu navigasi"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav aria-label="Navigasi seluler" className="p-3 space-y-1 flex-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      active
                        ? 'bg-emerald-50 text-[#007038] dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col lg:pl-[248px] min-w-0">
        {/* Top Bar Contract (Breadcrumb + Primary CTA + Theme Toggle) */}
        <header className="sticky top-0 z-30 h-16 px-4 sm:px-6 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-[#0F1724]/95 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400 dark:text-slate-500 whitespace-nowrap">
                Grab Desktop Automation Agent
              </span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700">/</span>
              <h1 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {activeNavLabel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('csv');
                setImportModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#008844] text-white hover:bg-[#007038] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </button>
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'light' ? 'Aktifkan tema gelap' : 'Aktifkan tema terang'}
              className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Active View Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1360px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'dashboard' && (
                <DashboardView
                  activeJob={activeJob}
                  records={activeJobRecords}
                  logs={workspace.logs}
                  device={selectedDevice}
                  screen={screen}
                  formValues={formValues}
                  workflowState={workflowState}
                  isRunning={isRunning}
                  activeRecord={activeRecord}
                  verifications={verifications}
                  profile={workspace.workflow_profile}
                  settings={workspace.app_settings}
                  showOcrOverlay={showOcrOverlay}
                  lowConfidence={lowConfidence}
                  manualTakeoverActive={manualTakeoverActive}
                  selectedRecordIds={selectedRecordIds}
                  recoveredCount={recoveredCount}
                  onStart={() => handleStart()}
                  onPause={handlePause}
                  onResume={handleResume}
                  onStop={handleStop}
                  onRetryFailed={handleRetryFailed}
                  onProcessSelected={() => handleProcessSelectedRows(selectedRecordIds, false)}
                  onManualTakeover={handleManualTakeover}
                  onCompleteManualTakeover={handleCompleteManualTakeover}
                  onConfirmSubmit={handleConfirmSubmit}
                  onMarkActiveNeedsReview={handleMarkActiveNeedsReview}
                  onModeChange={handleModeChange}
                  onRefreshDevice={handleRefreshDevices}
                  onConnectDevice={handleConnectDevice}
                  onToggleScrcpy={handleToggleScrcpy}
                  onTakeScreenshot={handleTakeScreenshot}
                  onToggleOcrOverlay={() => setShowOcrOverlay((v) => !v)}
                  onManualFormChange={(field, val) =>
                    setFormValues((prev) => ({ ...prev, [field]: val }))
                  }
                  onManualScreenChange={(scr) => setScreen(scr)}
                  onOpenImportCsv={() => {
                    setActiveTab('csv');
                    setImportModalOpen(true);
                  }}
                  onOpenAiAssist={() => {
                    setAiScheduleTargetRecord(null);
                    setAiModalOpen(true);
                  }}
                  onDismissRecoveryBanner={() => setRecoveredCount(0)}
                />
              )}

              {activeTab === 'csv' && (
                <CsvDataView
                  activeJob={activeJob}
                  records={activeJobRecords}
                  selectedRecordIds={selectedRecordIds}
                  onToggleSelectRecord={(id) =>
                    setSelectedRecordIds((prev) =>
                      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                    )
                  }
                  onSelectAllFiltered={(ids) => setSelectedRecordIds(ids)}
                  onClearSelection={() => setSelectedRecordIds([])}
                  onImportCsv={handleImportCsv}
                  onProcessSelectedRows={handleProcessSelectedRows}
                  onUpdateRecordFields={handleUpdateRecordFields}
                  onOpenAiForSchedule={(rec) => {
                    setAiScheduleTargetRecord(rec);
                    setAiModalOpen(true);
                  }}
                  importModalOpen={importModalOpen}
                  onSetImportModalOpen={setImportModalOpen}
                />
              )}

              {activeTab === 'device' && (
                <DeviceVisionView
                  devices={devices}
                  selectedSerial={selectedSerial}
                  onSelectDevice={(serial) => {
                    setSelectedSerial(serial);
                    appendLog('INFO', `Perangkat target diubah ke serial ${serial}.`);
                  }}
                  onRefreshDevices={handleRefreshDevices}
                  onScanLocalAdb={handleScanLocalAdb}
                  isScanningLocalAdb={isScanningLocalAdb}
                  localDiagnostics={localDiagnostics}
                  bridgeTransport={bridgeTransport}
                  onChangeBridgeTransport={setBridgeTransport}
                  bridgeUrl={bridgeUrl}
                  onChangeBridgeUrl={setBridgeUrl}
                  bridgeToken={bridgeToken}
                  onChangeBridgeToken={setBridgeToken}
                  onConnectWirelessAdb={handleConnectWirelessAdb}
                  liveScreenshotUrl={liveScreenshotUrl}
                  onSetDeviceAdbState={handleSetDeviceAdbState}
                  onToggleScrcpy={() => void handleToggleScrcpy()}
                  onTakeScreenshot={() => void handleTakeScreenshot()}
                  screen={screen}
                  onInjectScreen={(scr) => {
                    setScreen(scr);
                    appendLog('WARN', `Layar mock diubah ke "${scr}" untuk pengujian keamanan Vision.`);
                  }}
                  injectedFault={injectedFault}
                  onSetInjectedFault={setInjectedFault}
                  lowConfidence={lowConfidence}
                  onToggleLowConfidence={() => setLowConfidence((v) => !v)}
                  profile={workspace.workflow_profile}
                  onSaveProfile={saveProfile}
                  settings={workspace.app_settings}
                  onSaveSettings={saveSettings}
                />
              )}

              {activeTab === 'workflow' && (
                <WorkflowLogsView
                  workflowState={workflowState}
                  logs={workspace.logs}
                  onPurgeEvidence={handlePurgeEvidence}
                  onSimulateCrashRecovery={handleSimulateCrashRecovery}
                  onResetSeedWorkspace={handleResetSeedWorkspace}
                />
              )}

              {activeTab === 'desktop' && (
                <DesktopAgentView
                  profile={workspace.workflow_profile}
                  settings={workspace.app_settings}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Explicit Auto-Submit Safety Confirmation Modal (PRD Section 10) */}
      {autoSubmitModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi Aktivasi Mode Auto-submit"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111926] p-5 space-y-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Aktifkan Auto-submit Secara Eksplisit?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Default aplikasi adalah <strong>Assisted Mode</strong>. Mode Auto-submit hanya
                  boleh diaktifkan jika penggunaan diizinkan pada akun/perangkat Anda dan seluruh
                  deteksi OCR serta validasi telah lolos. Agent tetap akan berhenti jika muncul
                  OTP, CAPTCHA, atau layar tidak dikenal.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAutoSubmitModalOpen(false)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Tetap di Assisted Mode
              </button>
              <button
                type="button"
                onClick={() => {
                  setAutoSubmitModalOpen(false);
                  void saveSettings({
                    ...workspace.app_settings,
                    automation_mode: 'AUTO_SUBMIT',
                    auto_submit_policy_acknowledged: true,
                  });
                  appendLog(
                    'WARN',
                    'Auto-submit diaktifkan secara eksplisit oleh operator (perlindungan OTP/CAPTCHA/unknown screen tetap aktif).'
                  );
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
              >
                Saya Mengerti, Aktifkan Auto-submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Optional Gemini AI Assistant Modal (Phase 6) */}
      <AiAssistModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        settings={workspace.app_settings}
        onUpdateConsent={(enabled, consent) => {
          void saveSettings({
            ...workspace.app_settings,
            ai_assistance_enabled: enabled,
            ai_consent_granted: consent,
          });
        }}
        initialScheduleText={aiScheduleTargetRecord?.opening_hours}
        initialErrorCode={workspace.logs.find((l) => l.error_code)?.error_code ?? null}
        initialErrorMessage={workspace.logs.find((l) => l.error_code)?.message}
        currentScreenTitle={getScreenMeta(screen).title}
        onApplyNormalizedSchedule={
          aiScheduleTargetRecord
            ? async (normalized) => {
                await handleUpdateRecordFields(aiScheduleTargetRecord.record_id, {
                  opening_hours: normalized,
                  status: 'PENDING',
                  notes: 'Jam operasional dinormalisasi & lolos validasi lokal',
                });
              }
            : undefined
        }
      />
    </div>
  );
}
