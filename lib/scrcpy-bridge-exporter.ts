import type { AppSettings } from './types';

export interface BridgeBundleFile {
  path: string;
  language: string;
  description: string;
  content: string;
}

/**
 * Generates a zero-dependency local Python 3 companion bridge for genymobile/scrcpy.
 * Runs strictly on 127.0.0.1:17890 with a per-session token and Private Network Access CORS,
 * allowing even a cloud-hosted web UI or localhost browser to talk directly to the user's
 * installed scrcpy & ADB on Windows/macOS/Linux without installing any pip packages.
 */
export function generateScrcpyBridgeBundle(settings?: AppSettings): BridgeBundleFile[] {
  const defaultScrcpyPath = settings?.scrcpy_executable_path || 'scrcpy';
  const defaultAdbPath = settings?.adb_executable_path || 'adb';

  const pythonBridge = `#!/usr/bin/env python3
"""
Grab Automation Agent — Local scrcpy & ADB Bridge (Zero Dependencies)
Menghubungkan browser (Cloud Preview maupun localhost) ke instalasi genymobile/scrcpy lokal Anda.
Hanya bind di 127.0.0.1:17890 dengan token sesi acak agar aman.
"""

import base64
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, List, Optional, Tuple

HOST = "127.0.0.1"
PORT = int(os.environ.get("SCRCPY_BRIDGE_PORT", "17890"))
BRIDGE_TOKEN = os.environ.get("SCRCPY_BRIDGE_TOKEN") or f"GRAB-{secrets.token_hex(4).upper()}"

DEFAULT_SCRCPY_PATH = ${JSON.stringify(defaultScrcpyPath)}
DEFAULT_ADB_PATH = ${JSON.stringify(defaultAdbPath)}

SERIAL_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{1,63}$")
IPV4_PORT_RE = re.compile(r"^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3}):(\\d{1,5})$")
ALLOWED_SCRCPY_NAMES = {"scrcpy", "scrcpy.exe"}
ALLOWED_ADB_NAMES = {"adb", "adb.exe"}

ACTIVE_SCRCPY: Dict[str, subprocess.Popen] = {}


def is_valid_serial(serial: str) -> bool:
    return bool(SERIAL_RE.match(serial.strip()))


def is_valid_host_port(hp: str) -> bool:
    m = IPV4_PORT_RE.match(hp.strip())
    if not m:
        return False
    octets = [int(m.group(i)) for i in range(1, 5)]
    port = int(m.group(5))
    return all(0 <= o <= 255 for o in octets) and 1 <= port <= 65535


def sanitize_bin_path(raw: Optional[str], kind: str) -> str:
    fallback = "scrcpy" if kind == "scrcpy" else "adb"
    allowed = ALLOWED_SCRCPY_NAMES if kind == "scrcpy" else ALLOWED_ADB_NAMES
    cand = (raw or "").strip().strip('"').strip("'")
    if not cand or any(ch in cand for ch in ";&|\`$<>\\r\\n"):
        return fallback
    base = Path(cand.replace("\\\\", "/")).name.lower()
    if base not in allowed:
        return fallback
    return cand


def collect_scrcpy_candidates(preferred: Optional[str] = None) -> List[str]:
    candidates: List[str] = []
    pref = sanitize_bin_path(preferred or DEFAULT_SCRCPY_PATH, "scrcpy")
    if pref not in ("scrcpy", "scrcpy.exe"):
        candidates.append(pref)

    in_path = shutil.which("scrcpy")
    if in_path:
        candidates.append(in_path)

    if os.name == "nt":
        home = Path.home()
        local_app = Path(os.environ.get("LOCALAPPDATA", str(home / "AppData" / "Local")))
        direct = [
            Path("C:/scrcpy/scrcpy.exe"),
            Path("C:/Program Files/scrcpy/scrcpy.exe"),
            Path("C:/ProgramData/chocolatey/bin/scrcpy.exe"),
            home / "scoop" / "shims" / "scrcpy.exe",
        ]
        for p in direct:
            if p.is_file():
                candidates.append(str(p))

        search_roots = [
            Path("C:/"),
            home / "Downloads",
            home / "Desktop",
            local_app / "Microsoft" / "WinGet" / "Packages",
        ]
        for root in search_roots:
            if not root.is_dir():
                continue
            try:
                for entry in root.iterdir():
                    if entry.is_dir() and "scrcpy" in entry.name.lower():
                        exe = entry / "scrcpy.exe"
                        if exe.is_file():
                            candidates.append(str(exe))
                        for sub in entry.iterdir():
                            if sub.is_dir():
                                nested = sub / "scrcpy.exe"
                                if nested.is_file():
                                    candidates.append(str(nested))
            except OSError:
                pass
    else:
        for p in ("/opt/homebrew/bin/scrcpy", "/usr/local/bin/scrcpy", "/usr/bin/scrcpy"):
            if Path(p).is_file():
                candidates.append(p)

    # Deduplicate preserving order
    seen = set()
    uniq = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            uniq.append(c)
    return uniq


def collect_adb_candidates(preferred: Optional[str] = None, resolved_scrcpy: Optional[str] = None) -> List[str]:
    candidates: List[str] = []
    pref = sanitize_bin_path(preferred or DEFAULT_ADB_PATH, "adb")
    if pref not in ("adb", "adb.exe"):
        candidates.append(pref)

    # Prefer the adb bundled inside the same directory as scrcpy (avoids ADB version mismatch!)
    if resolved_scrcpy:
        exe_name = "adb.exe" if os.name == "nt" else "adb"
        sibling = Path(resolved_scrcpy).parent / exe_name
        if sibling.is_file():
            candidates.append(str(sibling))

    in_path = shutil.which("adb")
    if in_path:
        candidates.append(in_path)

    if os.name == "nt":
        home = Path.home()
        local_app = Path(os.environ.get("LOCALAPPDATA", str(home / "AppData" / "Local")))
        for p in (
            Path("C:/platform-tools/adb.exe"),
            local_app / "Android" / "Sdk" / "platform-tools" / "adb.exe",
            home / "scoop" / "shims" / "adb.exe",
            Path("C:/ProgramData/chocolatey/bin/adb.exe"),
        ):
            if p.is_file():
                candidates.append(str(p))
    else:
        for p in ("/opt/homebrew/bin/adb", "/usr/local/bin/adb", "/usr/bin/adb"):
            if Path(p).is_file():
                candidates.append(p)

    seen = set()
    uniq = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            uniq.append(c)
    return uniq


def probe_binary(candidates: List[str], version_arg: str) -> Tuple[bool, str, Optional[str]]:
    for bin_path in candidates:
        try:
            proc = subprocess.run(
                [bin_path, version_arg],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            out = (proc.stdout or proc.stderr or "").strip()
            if proc.returncode == 0 and out:
                first_line = next((ln.strip() for ln in out.splitlines() if ln.strip()), out)
                return True, bin_path, first_line
        except OSError:
            continue
    return False, (candidates[0] if candidates else ""), None


def get_diagnostics(adb_pref: Optional[str] = None, scrcpy_pref: Optional[str] = None) -> Dict:
    scrcpy_ok, scrcpy_path, scrcpy_ver = probe_binary(collect_scrcpy_candidates(scrcpy_pref), "--version")
    adb_ok, adb_path, adb_ver = probe_binary(
        collect_adb_candidates(adb_pref, scrcpy_path if scrcpy_ok else None),
        "version",
    )

    devices: List[Dict] = []
    tips: List[str] = []

    if adb_ok:
        proc = subprocess.run([adb_path, "devices", "-l"], capture_output=True, text=True, timeout=6, check=False)
        for line in proc.stdout.splitlines()[1:]:
            parts = line.strip().split()
            if len(parts) < 2:
                continue
            serial, raw_state = parts[0], parts[1]
            if not is_valid_serial(serial):
                continue
            state = raw_state if raw_state in ("device", "unauthorized", "offline") else "disconnected"
            model_tok = next((p for p in parts if p.startswith("model:")), "")
            model = model_tok.replace("model:", "").replace("_", " ") if model_tok else "Android Device (USB ADB)"
            resolution = "1080x2400"
            android_ver = "Android"
            if state == "device":
                try:
                    sz = subprocess.run([adb_path, "-s", serial, "shell", "wm", "size"], capture_output=True, text=True, timeout=4)
                    m = re.search(r"(\\d+x\\d+)", sz.stdout)
                    if m:
                        resolution = m.group(1)
                except OSError:
                    pass
                try:
                    vr = subprocess.run([adb_path, "-s", serial, "shell", "getprop", "ro.build.version.release"], capture_output=True, text=True, timeout=4)
                    if vr.stdout.strip():
                        android_ver = f"Android {vr.stdout.strip()}"
                except OSError:
                    pass
            existing = ACTIVE_SCRCPY.get(serial)
            running = existing is not None and existing.poll() is None
            devices.append(
                {
                    "serial": serial,
                    "model": model,
                    "android_version": android_ver,
                    "resolution": resolution,
                    "adb_state": state,
                    "adb_path": adb_path,
                    "scrcpy_running": running,
                    "scrcpy_pid": existing.pid if running and existing else None,
                    "is_mock": False,
                }
            )
    else:
        tips.append("ADB belum ditemukan. Pastikan folder hasil ekstrak genymobile/scrcpy berisi adb.exe dan scrcpy.exe.")

    if not scrcpy_ok:
        tips.append("scrcpy tidak ditemukan otomatis. Masukkan path lengkap scrcpy.exe (misal C:\\\\scrcpy-win64-v3.1\\\\scrcpy.exe) lalu simpan.")
    if adb_ok and not devices:
        tips.append("Belum ada HP Android terdeteksi. Aktifkan USB Debugging, sambungkan kabel data USB, lalu ketuk Izinkan di layar HP.")
    if any(d["adb_state"] == "unauthorized" for d in devices):
        tips.append("Status unauthorized: ketuk 'Izinkan Debugging USB' pada layar HP Android Anda.")

    msg = (
        f"Bridge PC Lokal terhubung ({scrcpy_ver or 'scrcpy belum ditemukan'}): {len(devices)} perangkat terdeteksi."
        if adb_ok
        else "Bridge PC Lokal aktif, tetapi executable adb/scrcpy belum ditemukan pada PATH atau folder standar."
    )

    return {
        "adb_available": adb_ok,
        "adb_path": adb_path or "adb",
        "adb_version": adb_ver,
        "scrcpy_available": scrcpy_ok,
        "scrcpy_path": scrcpy_path or "scrcpy",
        "scrcpy_version": scrcpy_ver,
        "devices": devices,
        "message": msg,
        "troubleshooting_tips": tips,
        "source": "pc_bridge",
    }


def launch_scrcpy(serial: str, options: Dict, scrcpy_pref: Optional[str], adb_pref: Optional[str]) -> Dict:
    if not is_valid_serial(serial):
        return {"ok": False, "error": "Serial perangkat tidak valid."}
    existing = ACTIVE_SCRCPY.get(serial)
    if existing and existing.poll() is None:
        return {"ok": True, "pid": existing.pid}

    scrcpy_ok, scrcpy_path, _ = probe_binary(collect_scrcpy_candidates(scrcpy_pref), "--version")
    if not scrcpy_ok:
        return {"ok": False, "error": "SCRCPY_FAILED: scrcpy tidak ditemukan di PC lokal."}

    adb_ok, adb_path, _ = probe_binary(collect_adb_candidates(adb_pref, scrcpy_path), "version")

    args = [scrcpy_path, "-s", serial]
    max_size = options.get("max_size", 1280)
    if max_size in (720, 1024, 1280, 1600, 1920):
        args.extend(["--max-size", str(max_size)])
    max_fps = options.get("max_fps", 30)
    if max_fps in (15, 30, 60):
        args.extend(["--max-fps", str(max_fps)])
    if options.get("no_audio", True):
        args.append("--no-audio")
    if options.get("stay_awake", True):
        args.append("--stay-awake")
    if options.get("always_on_top", False):
        args.append("--always-on-top")
    if options.get("turn_screen_off", False):
        args.append("--turn-screen-off")
    args.extend(["--window-title", f"Grab Agent Mirror ({serial})"])

    env = os.environ.copy()
    if adb_ok:
        env["ADB"] = adb_path

    proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    time.sleep(0.45)
    if proc.poll() is not None:
        err = (proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else "").strip()
        return {"ok": False, "error": f"SCRCPY_FAILED: {err or f'exit code {proc.returncode}'}"}

    ACTIVE_SCRCPY[serial] = proc
    return {"ok": True, "pid": proc.pid, "command": " ".join(args)}


def close_scrcpy(serial: str) -> Dict:
    proc = ACTIVE_SCRCPY.pop(serial, None)
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=4)
        except subprocess.TimeoutExpired:
            proc.kill()
    return {"ok": True}


class BridgeHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self) -> None:
        origin = self.headers.get("Origin") or "*"
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Bridge-Token")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _send_json(self, status: int, payload: Dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _check_token(self) -> bool:
        token = (self.headers.get("X-Bridge-Token") or "").strip()
        if token != BRIDGE_TOKEN:
            self._send_json(401, {"error": "Token bridge tidak cocok. Salin token dari jendela terminal scrcpy_bridge."})
            return False
        return True

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if not self._check_token():
            return
        if self.path.startswith("/health") or self.path.startswith("/devices"):
            self._send_json(200, get_diagnostics())
            return
        self._send_json(404, {"error": "Endpoint tidak ditemukan."})

    def do_POST(self) -> None:  # noqa: N802
        if not self._check_token():
            return
        length = int(self.headers.get("Content-Length") or "0")
        raw = self.rfile.read(min(length, 65536)).decode("utf-8", errors="replace")
        try:
            body = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Payload JSON tidak valid."})
            return

        action = body.get("action")
        if self.path == "/scan" or action == "scan":
            self._send_json(200, get_diagnostics(body.get("adbPath"), body.get("scrcpyPath")))
            return

        if self.path == "/scrcpy/launch" or action == "launch_scrcpy":
            res = launch_scrcpy(
                str(body.get("serial") or ""),
                body.get("scrcpyOptions") or {},
                body.get("scrcpyPath"),
                body.get("adbPath"),
            )
            self._send_json(200 if res.get("ok") else 400, res)
            return

        if self.path == "/scrcpy/close" or action == "close_scrcpy":
            res = close_scrcpy(str(body.get("serial") or ""))
            self._send_json(200, res)
            return

        if self.path == "/adb/connect" or action == "connect_wireless":
            hp = str(body.get("hostPort") or "")
            if not is_valid_host_port(hp):
                self._send_json(400, {"ok": False, "error": "Format IP:Port tidak valid (contoh: 192.168.1.24:5555)."})
                return
            diag = get_diagnostics(body.get("adbPath"), body.get("scrcpyPath"))
            if not diag["adb_available"]:
                self._send_json(400, {"ok": False, "error": "ADB tidak ditemukan di PC lokal."})
                return
            proc = subprocess.run([diag["adb_path"], "connect", hp], capture_output=True, text=True, timeout=7, check=False)
            out = (proc.stdout or proc.stderr or "").strip()
            ok = "connected" in out.lower()
            self._send_json(200 if ok else 400, {"ok": ok, "output": out, "error": None if ok else out})
            return

        if self.path == "/adb/screenshot" or action == "capture_screenshot":
            serial = str(body.get("serial") or "")
            if not is_valid_serial(serial):
                self._send_json(400, {"ok": False, "error": "Serial perangkat tidak valid."})
                return
            diag = get_diagnostics(body.get("adbPath"), body.get("scrcpyPath"))
            if not diag["adb_available"]:
                self._send_json(400, {"ok": False, "error": "ADB tidak ditemukan di PC lokal."})
                return
            proc = subprocess.run([diag["adb_path"], "-s", serial, "exec-out", "screencap", "-p"], capture_output=True, timeout=8, check=False)
            if proc.returncode == 0 and proc.stdout[:2] == b"\\x89P":
                b64 = base64.b64encode(proc.stdout).decode("ascii")
                self._send_json(200, {"ok": True, "dataUrl": f"data:image/png;base64,{b64}"})
            else:
                self._send_json(400, {"ok": False, "error": "Gagal mengambil screenshot dari HP Android."})
            return

        self._send_json(400, {"error": "Aksi tidak dikenali."})

    def log_message(self, fmt: str, *args) -> None:
        print(f"[scrcpy-bridge] {fmt % args}")


def main() -> None:
    diag = get_diagnostics()
    print("=" * 64)
    print("  Grab Automation Agent — Local scrcpy & ADB Bridge")
    print("=" * 64)
    print(f"  URL Bridge   : http://{HOST}:{PORT}")
    print(f"  Token Sesi   : {BRIDGE_TOKEN}")
    print(f"  scrcpy       : {diag['scrcpy_version'] or 'TIDAK DITEMUKAN'} ({diag['scrcpy_path']})")
    print(f"  ADB          : {diag['adb_version'] or 'TIDAK DITEMUKAN'} ({diag['adb_path']})")
    print(f"  Perangkat    : {len(diag['devices'])} terdeteksi")
    print("=" * 64)
    print("  Salin Token Sesi di atas lalu tempel di tab 'Perangkat & Vision' -> Bridge PC Lokal.")
    print("  Tekan Ctrl+C untuk menutup bridge.")
    server = ThreadingHTTPServer((HOST, PORT), BridgeHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\\nMenutup semua proses scrcpy dan bridge...")
        for ser in list(ACTIVE_SCRCPY.keys()):
            close_scrcpy(ser)
        server.server_close()


if __name__ == "__main__":
    main()
`;

  const startBat = `@echo off
setlocal
cd /d "%~dp0"
echo Memulai Local scrcpy & ADB Bridge pada http://127.0.0.1:17890 ...
where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python 3 tidak ditemukan di PATH. Install Python 3 dari python.org dan centang "Add Python to PATH".
    pause
    exit /b 1
)
python scrcpy_bridge.py
pause
`;

  const readme = `# Local scrcpy & ADB Bridge (Zero-Dependency)

Bridge ringan ini menghubungkan browser Anda (baik dari URL cloud preview maupun localhost)
langsung ke instalasi **genymobile/scrcpy** dan **ADB** di PC Windows/macOS/Linux Anda.

## Cara Pakai (30 Detik, Tanpa pip install!)
1. Pastikan HP Android terhubung via kabel USB (dengan **USB Debugging** aktif) dan \`scrcpy\` sudah terpasang.
2. Klik dua kali **\`start_scrcpy_bridge.bat\`** (atau jalankan \`python3 scrcpy_bridge.py\` di macOS/Linux).
3. Salin **Token Sesi** (contoh: \`GRAB-A1B2C3D4\`) yang muncul di jendela terminal.
4. Di aplikasi web **Grab Desktop Automation Agent** -> tab **Perangkat & Vision**:
   - Pilih mode **Bridge PC Lokal (127.0.0.1:17890)**
   - Tempel **Token Sesi**, lalu klik **Pindai ADB & scrcpy**
5. Perangkat Android nyata akan langsung muncul dan tombol **Launch scrcpy** akan membuka jendela \`scrcpy\` lokal Anda!
`;

  return [
    {
      path: 'grab-scrcpy-bridge/scrcpy_bridge.py',
      language: 'python',
      description: 'Server jembatan lokal 127.0.0.1:17890 (Python stdlib, tanpa pip install) dengan auto-detect scrcpy & ADB.',
      content: pythonBridge,
    },
    {
      path: 'grab-scrcpy-bridge/start_scrcpy_bridge.bat',
      language: 'batch',
      description: 'Klik 2x di Windows untuk menyalakan bridge lokal dan menampilkan Token Sesi.',
      content: startBat,
    },
    {
      path: 'grab-scrcpy-bridge/README_BRIDGE.txt',
      language: 'text',
      description: 'Panduan singkat 5 langkah menghubungkan genymobile/scrcpy ke tools.',
      content: readme,
    },
  ];
}
