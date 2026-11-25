import { execFile, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  AdbConnectionState,
  DeviceInfo,
  LocalScrcpyDiagnostics,
  ScrcpyLaunchOptions,
} from './types';

const execFileAsync = promisify(execFile);

const SERIAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,63}$/;
const ALLOWED_ADB_NAMES = /^(adb|adb\.exe)$/i;
const ALLOWED_SCRCPY_NAMES = /^(scrcpy|scrcpy\.exe)$/i;
const IPV4_HOST_PORT_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(\d{1,5})$/;

const activeScrcpyProcesses = new Map<string, ChildProcess>();

export const DEFAULT_SCRCPY_OPTIONS: ScrcpyLaunchOptions = {
  max_size: 1280,
  max_fps: 30,
  no_audio: true,
  stay_awake: true,
  always_on_top: false,
  turn_screen_off: false,
};

export function isValidAdbSerial(serial: string): boolean {
  return SERIAL_PATTERN.test(serial.trim());
}

export function isValidWirelessHostPort(hostPort: string): boolean {
  const match = IPV4_HOST_PORT_PATTERN.exec(hostPort.trim());
  if (!match) return false;
  const octets = [match[1], match[2], match[3], match[4]].map(Number);
  const port = Number(match[5]);
  return octets.every((n) => n >= 0 && n <= 255) && port >= 1 && port <= 65535;
}

export function isAllowedLocalBridgeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'http:') return false;
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

/**
 * Validates executable paths strictly to prevent arbitrary binary execution.
 * Only allows basenames matching `adb`/`adb.exe` or `scrcpy`/`scrcpy.exe`.
 */
export function sanitizeExecutablePath(
  rawPath: string | undefined,
  fallback: 'adb' | 'scrcpy'
): string {
  const candidate = (rawPath ?? '').trim().replace(/^["']|["']$/g, '');
  if (!candidate) return fallback;
  if (/[;&|`$<>!?\r\n]/.test(candidate)) {
    return fallback;
  }

  // Extract basename supporting both Windows (\) and POSIX (/) separators
  const segments = candidate.split(/[\\/]/).filter(Boolean);
  const baseName = segments[segments.length - 1] ?? '';
  const pattern = fallback === 'adb' ? ALLOWED_ADB_NAMES : ALLOWED_SCRCPY_NAMES;
  if (!pattern.test(baseName)) {
    return fallback;
  }
  return candidate;
}

export function normalizeScrcpyOptions(
  input?: Partial<ScrcpyLaunchOptions>
): ScrcpyLaunchOptions {
  const allowedSizes: ScrcpyLaunchOptions['max_size'][] = [0, 720, 1024, 1280, 1600, 1920];
  const allowedFps: ScrcpyLaunchOptions['max_fps'][] = [15, 30, 60];
  const max_size = allowedSizes.includes(input?.max_size as ScrcpyLaunchOptions['max_size'])
    ? (input!.max_size as ScrcpyLaunchOptions['max_size'])
    : DEFAULT_SCRCPY_OPTIONS.max_size;
  const max_fps = allowedFps.includes(input?.max_fps as ScrcpyLaunchOptions['max_fps'])
    ? (input!.max_fps as ScrcpyLaunchOptions['max_fps'])
    : DEFAULT_SCRCPY_OPTIONS.max_fps;

  return {
    max_size,
    max_fps,
    no_audio: input?.no_audio ?? DEFAULT_SCRCPY_OPTIONS.no_audio,
    stay_awake: input?.stay_awake ?? DEFAULT_SCRCPY_OPTIONS.stay_awake,
    always_on_top: input?.always_on_top ?? DEFAULT_SCRCPY_OPTIONS.always_on_top,
    turn_screen_off: input?.turn_screen_off ?? DEFAULT_SCRCPY_OPTIONS.turn_screen_off,
  };
}

export function buildScrcpyArgs(
  serial: string,
  options?: Partial<ScrcpyLaunchOptions>
): string[] {
  const opts = normalizeScrcpyOptions(options);
  const args: string[] = ['-s', serial];
  if (opts.max_size > 0) {
    args.push('--max-size', String(opts.max_size));
  }
  args.push('--max-fps', String(opts.max_fps));
  if (opts.no_audio) {
    args.push('--no-audio');
  }
  if (opts.stay_awake) {
    args.push('--stay-awake');
  }
  if (opts.always_on_top) {
    args.push('--always-on-top');
  }
  if (opts.turn_screen_off) {
    args.push('--turn-screen-off');
  }
  args.push('--window-title', `Grab Agent Mirror (${serial})`);
  return args;
}

export function parseAdbDevicesOutput(stdout: string): Array<{
  serial: string;
  adb_state: AdbConnectionState;
  model: string;
}> {
  const results: Array<{
    serial: string;
    adb_state: AdbConnectionState;
    model: string;
  }> = [];

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('List of devices') || trimmed.startsWith('*')) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;
    const serial = parts[0];
    if (!isValidAdbSerial(serial)) continue;

    const rawState = parts[1];
    const adb_state: AdbConnectionState =
      rawState === 'device'
        ? 'device'
        : rawState === 'unauthorized'
          ? 'unauthorized'
          : rawState === 'offline'
            ? 'offline'
            : 'disconnected';

    const modelToken = parts.find((p) => p.startsWith('model:'));
    const model = modelToken
      ? modelToken.replace('model:', '').replace(/_/g, ' ')
      : 'Android Device (USB ADB)';

    results.push({ serial, adb_state, model });
  }

  return results;
}

function collectScrcpyCandidates(preferredPath?: string): string[] {
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'scrcpy.exe' : 'scrcpy';
  const set = new Set<string>();

  const sanitized = sanitizeExecutablePath(preferredPath, 'scrcpy');
  if (sanitized && sanitized !== 'scrcpy') {
    set.add(sanitized);
  }
  set.add(binName);
  set.add('scrcpy');

  if (isWin) {
    const home = os.homedir();
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const directPaths = [
      'C:\\scrcpy\\scrcpy.exe',
      'C:\\Program Files\\scrcpy\\scrcpy.exe',
      'C:\\ProgramData\\chocolatey\\bin\\scrcpy.exe',
      path.join(home, 'scoop', 'shims', 'scrcpy.exe'),
    ];
    for (const p of directPaths) {
      if (fs.existsSync(p)) set.add(p);
    }

    // Scan common extract parents for scrcpy-win64-v* folders (official GitHub release layout)
    const searchRoots = [
      'C:\\',
      path.join(home, 'Downloads'),
      path.join(home, 'Desktop'),
      path.join(localAppData, 'Microsoft', 'WinGet', 'Packages'),
    ];
    for (const root of searchRoots) {
      try {
        if (!fs.existsSync(root)) continue;
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const ent of entries) {
          if (!ent.isDirectory()) continue;
          if (!ent.name.toLowerCase().includes('scrcpy')) continue;
          const direct = path.join(root, ent.name, 'scrcpy.exe');
          if (fs.existsSync(direct)) set.add(direct);
          // WinGet nests one folder deeper (Genymobile.scrcpy.../scrcpy-win64-vX.Y/scrcpy.exe)
          try {
            const sub = fs.readdirSync(path.join(root, ent.name), { withFileTypes: true });
            for (const s of sub) {
              if (!s.isDirectory()) continue;
              const nested = path.join(root, ent.name, s.name, 'scrcpy.exe');
              if (fs.existsSync(nested)) set.add(nested);
            }
          } catch {
            // Ignore unreadable subfolder
          }
        }
      } catch {
        // Ignore unreadable search root
      }
    }
  } else {
    for (const p of ['/opt/homebrew/bin/scrcpy', '/usr/local/bin/scrcpy', '/usr/bin/scrcpy']) {
      if (fs.existsSync(p)) set.add(p);
    }
  }

  return Array.from(set);
}

function collectAdbCandidates(preferredAdbPath?: string, resolvedScrcpyPath?: string): string[] {
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'adb.exe' : 'adb';
  const set = new Set<string>();

  const sanitized = sanitizeExecutablePath(preferredAdbPath, 'adb');
  if (sanitized && sanitized !== 'adb') {
    set.add(sanitized);
  }

  // Official genymobile/scrcpy zip bundles adb.exe in the exact same directory!
  // Using the bundled adb prevents "adb server version doesn't match" crashes.
  if (resolvedScrcpyPath && (resolvedScrcpyPath.includes('\\') || resolvedScrcpyPath.includes('/'))) {
    const siblingAdb = path.join(path.dirname(resolvedScrcpyPath), binName);
    if (fs.existsSync(siblingAdb)) {
      set.add(siblingAdb);
    }
  }

  set.add(binName);
  set.add('adb');

  if (isWin) {
    const home = os.homedir();
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const commonAdb = [
      'C:\\platform-tools\\adb.exe',
      path.join(localAppData, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
      path.join(home, 'scoop', 'shims', 'adb.exe'),
      'C:\\ProgramData\\chocolatey\\bin\\adb.exe',
    ];
    for (const p of commonAdb) {
      if (fs.existsSync(p)) set.add(p);
    }
  } else {
    for (const p of ['/opt/homebrew/bin/adb', '/usr/local/bin/adb', '/usr/bin/adb']) {
      if (fs.existsSync(p)) set.add(p);
    }
  }

  return Array.from(set);
}

async function resolveScrcpyBinary(preferredPath?: string): Promise<{
  available: boolean;
  path: string;
  version: string | null;
}> {
  const candidates = collectScrcpyCandidates(preferredPath);
  for (const bin of candidates) {
    try {
      const res = await execFileAsync(bin, ['--version'], {
        timeout: 4500,
        windowsHide: true,
      });
      const firstLine = (res.stdout || res.stderr || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.toLowerCase().startsWith('scrcpy'));
      return {
        available: true,
        path: bin,
        version: firstLine || 'scrcpy terdeteksi',
      };
    } catch {
      // Try next candidate
    }
  }
  return {
    available: false,
    path: sanitizeExecutablePath(preferredPath, 'scrcpy'),
    version: null,
  };
}

async function resolveAdbBinary(
  preferredAdbPath?: string,
  resolvedScrcpyPath?: string
): Promise<{
  available: boolean;
  path: string;
  version: string | null;
}> {
  const candidates = collectAdbCandidates(preferredAdbPath, resolvedScrcpyPath);
  for (const bin of candidates) {
    try {
      const res = await execFileAsync(bin, ['version'], {
        timeout: 4500,
        windowsHide: true,
      });
      const firstLine = (res.stdout || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find(Boolean);
      return {
        available: true,
        path: bin,
        version: firstLine || 'ADB terdeteksi',
      };
    } catch {
      // Try next candidate
    }
  }
  return {
    available: false,
    path: sanitizeExecutablePath(preferredAdbPath, 'adb'),
    version: null,
  };
}

export async function detectLocalAdbDevices(
  adbPathInput?: string,
  scrcpyPathInput?: string
): Promise<LocalScrcpyDiagnostics> {
  const scrcpyInfo = await resolveScrcpyBinary(scrcpyPathInput);
  const adbInfo = await resolveAdbBinary(
    adbPathInput,
    scrcpyInfo.available ? scrcpyInfo.path : undefined
  );

  if (!adbInfo.available) {
    const tips: string[] = [
      'Jika Anda membuka aplikasi ini lewat URL cloud preview, browser tidak dapat mengakses USB/scrcpy PC secara langsung — gunakan mode "Bridge PC Lokal (127.0.0.1:17890)" di bawah atau jalankan aplikasi di localhost.',
      'Jika sudah install genymobile/scrcpy di Windows, folder scrcpy sudah berisi adb.exe dan scrcpy.exe — arahkan Path scrcpy ke folder tersebut (misal C:\\scrcpy-win64-v3.1\\scrcpy.exe).',
    ];
    return {
      adb_available: false,
      adb_path: adbInfo.path,
      adb_version: null,
      scrcpy_available: scrcpyInfo.available,
      scrcpy_path: scrcpyInfo.path,
      scrcpy_version: scrcpyInfo.version,
      devices: [],
      message:
        'ADB / scrcpy tidak ditemukan pada server tempat halaman web ini berjalan. Untuk menyambungkan scrcpy yang sudah terpasang di PC Anda, aktifkan Bridge PC Lokal (127.0.0.1:17890) atau jalankan aplikasi di localhost.',
      troubleshooting_tips: tips,
      source: 'server_local',
    };
  }

  let stdout = '';
  try {
    const res = await execFileAsync(adbInfo.path, ['devices', '-l'], {
      timeout: 6000,
      windowsHide: true,
    });
    stdout = res.stdout;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Gagal menjalankan adb devices';
    return {
      adb_available: true,
      adb_path: adbInfo.path,
      adb_version: adbInfo.version,
      scrcpy_available: scrcpyInfo.available,
      scrcpy_path: scrcpyInfo.path,
      scrcpy_version: scrcpyInfo.version,
      devices: [],
      message: `ADB ditemukan (${adbInfo.path}), tetapi gagal membaca perangkat: ${errMsg}`,
      troubleshooting_tips: [
        'Jalankan "adb kill-server && adb start-server" jika terjadi konflik versi ADB.',
      ],
      source: 'server_local',
    };
  }

  const parsed = parseAdbDevicesOutput(stdout);
  const devices: DeviceInfo[] = [];

  for (const item of parsed) {
    let resolution = '1080x2400';
    let androidVersion = 'Android';
    if (item.adb_state === 'device') {
      try {
        const sizeRes = await execFileAsync(
          adbInfo.path,
          ['-s', item.serial, 'shell', 'wm', 'size'],
          { timeout: 4000, windowsHide: true }
        );
        const match = sizeRes.stdout.match(/(\d+x\d+)/);
        if (match) resolution = match[1];
      } catch {
        // Keep fallback resolution
      }
      try {
        const verRes = await execFileAsync(
          adbInfo.path,
          ['-s', item.serial, 'shell', 'getprop', 'ro.build.version.release'],
          { timeout: 4000, windowsHide: true }
        );
        if (verRes.stdout.trim()) {
          androidVersion = `Android ${verRes.stdout.trim()}`;
        }
      } catch {
        // Keep fallback OS label
      }
    }

    const existingProc = activeScrcpyProcesses.get(item.serial);
    const scrcpyRunning = Boolean(existingProc && existingProc.exitCode === null);

    devices.push({
      serial: item.serial,
      model: item.model,
      android_version: androidVersion,
      resolution,
      adb_state: item.adb_state,
      adb_path: adbInfo.path,
      scrcpy_running: scrcpyRunning,
      scrcpy_pid: scrcpyRunning ? (existingProc?.pid ?? null) : null,
      is_mock: false,
    });
  }

  const tips: string[] = [];
  if (!scrcpyInfo.available) {
    tips.push(
      'scrcpy belum ditemukan di PATH. Isi "Path Executable scrcpy Lokal" dengan lokasi file scrcpy.exe hasil ekstrak dari github.com/genymobile/scrcpy.'
    );
  }
  if (devices.length === 0) {
    tips.push(
      'Aktifkan Opsi Pengembang → USB Debugging di HP Android, ganti mode USB ke Transfer File (MTP), lalu ketuk "Izinkan" saat popup RSA muncul.'
    );
  }
  if (devices.some((d) => d.adb_state === 'unauthorized')) {
    tips.push(
      'Perangkat berstatus unauthorized: buka layar HP Android dan centang "Selalu izinkan dari komputer ini" lalu ketuk Izinkan.'
    );
  }

  return {
    adb_available: true,
    adb_path: adbInfo.path,
    adb_version: adbInfo.version,
    scrcpy_available: scrcpyInfo.available,
    scrcpy_path: scrcpyInfo.path,
    scrcpy_version: scrcpyInfo.version,
    devices,
    message:
      devices.length > 0
        ? `ADB (${adbInfo.path}) & ${scrcpyInfo.available ? scrcpyInfo.version : 'scrcpy belum ditemukan'}: ${devices.length} perangkat terdeteksi.`
        : `ADB aktif (${adbInfo.path}), belum ada HP Android yang terdeteksi lewat USB/Wi-Fi.`,
    troubleshooting_tips: tips,
    source: 'server_local',
  };
}

export async function connectWirelessAdb(
  hostPort: string,
  adbPathInput?: string,
  scrcpyPathInput?: string
): Promise<{ ok: boolean; output?: string; error?: string }> {
  const trimmed = hostPort.trim();
  if (!isValidWirelessHostPort(trimmed)) {
    return {
      ok: false,
      error: 'Format IP:Port tidak valid. Gunakan format IPv4 seperti 192.168.1.24:5555.',
    };
  }

  const scrcpyInfo = await resolveScrcpyBinary(scrcpyPathInput);
  const adbInfo = await resolveAdbBinary(
    adbPathInput,
    scrcpyInfo.available ? scrcpyInfo.path : undefined
  );

  if (!adbInfo.available) {
    return {
      ok: false,
      error: 'ADB tidak ditemukan di server lokal ini. Gunakan Bridge PC Lokal untuk koneksi Wi-Fi ADB.',
    };
  }

  try {
    const res = await execFileAsync(adbInfo.path, ['connect', trimmed], {
      timeout: 7000,
      windowsHide: true,
    });
    const out = (res.stdout || res.stderr || '').trim();
    const ok = /connected to|already connected/i.test(out);
    return ok ? { ok: true, output: out } : { ok: false, error: out || 'Gagal menyambungkan ADB Wi-Fi.' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Gagal menjalankan adb connect.',
    };
  }
}

export async function captureLocalScreenshotBase64(
  serial: string,
  adbPathInput?: string,
  scrcpyPathInput?: string
): Promise<{ ok: boolean; dataUrl?: string; error?: string }> {
  if (!isValidAdbSerial(serial)) {
    return { ok: false, error: 'Serial perangkat tidak valid.' };
  }
  const scrcpyInfo = await resolveScrcpyBinary(scrcpyPathInput);
  const adbInfo = await resolveAdbBinary(
    adbPathInput,
    scrcpyInfo.available ? scrcpyInfo.path : undefined
  );
  if (!adbInfo.available) {
    return { ok: false, error: 'ADB tidak tersedia di server ini.' };
  }

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let errText = '';
    const proc = spawn(adbInfo.path, ['-s', serial, 'exec-out', 'screencap', '-p'], {
      shell: false,
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      proc.kill();
      resolve({ ok: false, error: 'Timeout mengambil screenshot dari ADB.' });
    }, 8000);

    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => {
      errText += chunk.toString('utf-8');
    });
    proc.once('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: err.message });
    });
    proc.once('close', (code) => {
      clearTimeout(timer);
      const buf = Buffer.concat(chunks);
      // Verify PNG signature (89 50 4E 47)
      if (code === 0 && buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) {
        resolve({
          ok: true,
          dataUrl: `data:image/png;base64,${buf.toString('base64')}`,
        });
      } else {
        resolve({
          ok: false,
          error: errText.trim() || 'Gagal membaca frame PNG dari perangkat Android.',
        });
      }
    });
  });
}

export async function launchLocalScrcpy(
  serial: string,
  scrcpyPathInput?: string,
  adbPathInput?: string,
  options?: Partial<ScrcpyLaunchOptions>
): Promise<{ ok: boolean; pid?: number; command?: string; error?: string }> {
  if (!isValidAdbSerial(serial)) {
    return { ok: false, error: 'Serial perangkat tidak valid.' };
  }

  const existing = activeScrcpyProcesses.get(serial);
  if (existing && existing.exitCode === null && existing.pid) {
    return { ok: true, pid: existing.pid };
  }

  const scrcpyInfo = await resolveScrcpyBinary(scrcpyPathInput);
  if (!scrcpyInfo.available) {
    return {
      ok: false,
      error: `SCRCPY_FAILED: Executable scrcpy tidak ditemukan (dicoba: ${scrcpyInfo.path} dan PATH). Pastikan genymobile/scrcpy sudah terpasang atau gunakan Bridge PC Lokal.`,
    };
  }

  const adbInfo = await resolveAdbBinary(adbPathInput, scrcpyInfo.path);
  const args = buildScrcpyArgs(serial, options);
  const env = { ...process.env };
  // Force scrcpy to use the exact same ADB binary so ADB server version never conflicts!
  if (adbInfo.available) {
    env.ADB = adbInfo.path;
  }

  return new Promise((resolve) => {
    try {
      const child = spawn(scrcpyInfo.path, args, {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: false,
        env,
      });

      let stderrBuf = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        if (stderrBuf.length < 1500) {
          stderrBuf += chunk.toString('utf-8');
        }
      });

      let settled = false;
      child.once('error', (err) => {
        if (!settled) {
          settled = true;
          resolve({
            ok: false,
            error: `SCRCPY_FAILED: ${err.message}. Pastikan scrcpy terpasang dengan benar.`,
          });
        }
      });

      child.once('exit', (code) => {
        activeScrcpyProcesses.delete(serial);
        if (!settled) {
          settled = true;
          const reason = stderrBuf.trim() || `scrcpy keluar lebih awal dengan kode ${code}`;
          resolve({
            ok: false,
            error: `SCRCPY_FAILED: ${reason}`,
          });
        }
      });

      child.once('spawn', () => {
        activeScrcpyProcesses.set(serial, child);
        // Wait briefly to catch immediate ADB/device/audio startup failures from scrcpy
        setTimeout(() => {
          if (!settled) {
            settled = true;
            if (child.exitCode !== null) {
              activeScrcpyProcesses.delete(serial);
              resolve({
                ok: false,
                error: `SCRCPY_FAILED: ${stderrBuf.trim() || `scrcpy berhenti (exit ${child.exitCode})`}`,
              });
            } else {
              resolve({
                ok: true,
                pid: child.pid,
                command: `${scrcpyInfo.path} ${args.join(' ')}`,
              });
            }
          }
        }, 400);
      });
    } catch (err) {
      resolve({
        ok: false,
        error: err instanceof Error ? err.message : 'SCRCPY_FAILED',
      });
    }
  });
}

export function closeLocalScrcpy(serial: string): { ok: boolean } {
  const proc = activeScrcpyProcesses.get(serial);
  if (proc && proc.exitCode === null) {
    proc.kill();
    activeScrcpyProcesses.delete(serial);
  }
  return { ok: true };
}
