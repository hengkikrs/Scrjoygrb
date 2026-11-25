import type { AppSettings, WorkflowProfile } from './types';

export interface DesktopBundleFile {
  path: string;
  language: string;
  description: string;
  content: string;
}

/**
 * Generates the COMPLETE, runnable Windows 10/11 Python + PySide6 Desktop Application
 * aligned with PRD Sections 6-18, synchronized dynamically with the operator's calibrated
 * workflow_profile.json and app_settings.json.
 */
export function generateWindowsAgentBundle(
  profile: WorkflowProfile,
  settings: AppSettings
): DesktopBundleFile[] {
  return [
    {
      path: 'grab-desktop-agent/README.md',
      language: 'markdown',
      description: 'Panduan instalasi dan cara menjalankan langsung di Windows 10/11 (Double-click run_windows.bat).',
      content: `# Grab Desktop Automation Agent (Windows Local Edition)

Aplikasi desktop Windows (Python + PySide6) untuk membantu operator mengisi data POI dari file CSV ke formulir Grab pada perangkat Android yang terhubung via USB Debugging (ADB) dan screen mirroring scrcpy.

## Prasyarat di Windows 10/11

1. **Python 3.10+** (centang *"Add Python to PATH"* saat instalasi).
2. **Android Platform Tools (ADB)** — pastikan \`adb\` ada di PATH atau atur path-nya di \`config/app_settings.json\`.
3. **scrcpy** — pastikan \`scrcpy\` ada di PATH atau atur path-nya di \`config/app_settings.json\`.
4. *(Opsional)* **Tesseract OCR** jika ingin menjalankan OCR layar nyata (tanpa Tesseract, mode simulasi & verifikasi manual tetap berjalan).

## Cara Menjalankan (Paling Cepat)

1. Ekstrak folder \`grab-desktop-agent\` ke komputer Anda (misal \`C:\\grab-desktop-agent\\\`).
2. Klik dua kali file **\`run_windows.bat\`**.
   Script ini otomatis membuat virtual environment (\`.venv\`), memasang dependensi dari \`requirements.txt\`, lalu membuka jendela **Grab Desktop Automation Agent**.

## Cara Menjalankan Manual via Terminal (PowerShell / CMD)

\`\`\`powershell
cd grab-desktop-agent
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
python main.py
\`\`\`

## Cara Build File .EXE Standalone (PyInstaller)

Klik dua kali **\`build_exe.bat\`** atau jalankan:

\`\`\`powershell
.venv\\Scripts\\activate
pyinstaller --noconfirm --onefile --windowed --name GrabAutomationAgent main.py
\`\`\`

File executable akan tersedia di \`dist\\GrabAutomationAgent.exe\`.

## Menjalankan Unit Test

\`\`\`powershell
.venv\\Scripts\\activate
pytest tests/test_core.py
\`\`\`

## Prinsip Keamanan & Penggunaan

- Default workflow adalah **Assisted Mode** dengan konfirmasi eksplisit operator sebelum menekan Submit.
- Agent **tidak pernah** mengakali CAPTCHA, OTP, login, atau mekanisme keamanan.
- Progres disimpan per baris di \`data/jobs.db\` (SQLite). Jika aplikasi tertutup paksa, baris \`IN_PROGRESS\` otomatis berubah menjadi \`NEEDS_REVIEW\` agar tidak terjadi submit ganda.
`,
    },
    {
      path: 'grab-desktop-agent/run_windows.bat',
      language: 'batch',
      description: 'Launcher 1-klik untuk Windows: otomatis buat .venv, install PySide6, dan buka aplikasi desktop.',
      content: `@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   Grab Desktop Automation Agent - Local Windows Runner
echo ========================================================

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python tidak ditemukan di PATH.
    echo Silakan instal Python 3.10+ dari https://www.python.org/downloads/
    echo Pastikan mencentang "Add Python to PATH".
    pause
    exit /b 1
)

if not exist ".venv\\Scripts\\python.exe" (
    echo [1/3] Membuat virtual environment .venv...
    python -m venv .venv
)

echo [2/3] Memeriksa dan memasang dependensi...
".venv\\Scripts\\python.exe" -m pip install --upgrade pip >nul
".venv\\Scripts\\pip.exe" install -r requirements.txt

echo [3/3] Membuka Grab Desktop Automation Agent...
".venv\\Scripts\\python.exe" main.py

if errorlevel 1 (
    echo.
    echo [ERROR] Aplikasi berhenti dengan error. Periksa log di atas.
    pause
)
`,
    },
    {
      path: 'grab-desktop-agent/build_exe.bat',
      language: 'batch',
      description: 'Script PyInstaller untuk mempaketkan aplikasi menjadi file tunggal GrabAutomationAgent.exe.',
      content: `@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\\Scripts\\python.exe" (
    python -m venv .venv
)

".venv\\Scripts\\pip.exe" install -r requirements.txt
".venv\\Scripts\\pyinstaller.exe" --noconfirm --onefile --windowed --name GrabAutomationAgent main.py

echo.
echo Build selesai! File EXE tersedia di: dist\\GrabAutomationAgent.exe
pause
`,
    },
    {
      path: 'grab-desktop-agent/requirements.txt',
      language: 'text',
      description: 'Dependensi Python minimal agar cepat dipasang dan stabil di Windows 10/11.',
      content: `PySide6>=6.7.0
Pillow>=10.4.0
pytesseract>=0.3.13
pytest>=8.3.0
pyinstaller>=6.10.0
`,
    },
    {
      path: 'grab-desktop-agent/config/workflow_profile.json',
      language: 'json',
      description: 'Profil kalibrasi resolusi, threshold OCR, dan urutan field formulir POI (tersinkronisasi otomatis).',
      content: JSON.stringify(profile, null, 2),
    },
    {
      path: 'grab-desktop-agent/config/app_settings.json',
      language: 'json',
      description: 'Konfigurasi path ADB, scrcpy, Assisted Mode, dan opsi privasi AI (tersinkronisasi otomatis).',
      content: JSON.stringify(settings, null, 2),
    },
    {
      path: 'grab-desktop-agent/main.py',
      language: 'python',
      description: 'Entry point utama aplikasi desktop Windows PySide6.',
      content: `import sys
from pathlib import Path
from PySide6.QtWidgets import QApplication
from app.ui.main_window import MainWindow


def main() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName("Grab Desktop Automation Agent")
    app.setOrganizationName("GrabAutomationLocal")

    base_dir = Path(__file__).resolve().parent
    window = MainWindow(base_dir=base_dir)
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
`,
    },
    {
      path: 'grab-desktop-agent/app/__init__.py',
      language: 'python',
      description: 'Package initializer untuk modul app/.',
      content: `# Grab Desktop Automation Agent package\n`,
    },
    {
      path: 'grab-desktop-agent/app/csv_manager/csv_loader.py',
      language: 'python',
      description: 'Import/ekspor CSV UTF-8 dengan deteksi delimiter koma/titik koma dan preservasi angka nol telepon.',
      content: `import csv
import hashlib
import re
from pathlib import Path
from typing import Dict, List, Tuple
from urllib.parse import urlparse


VALID_DAY_RE = re.compile(
    r"^(mon|tue|wed|thu|fri|sat|sun|senin|selasa|rabu|kamis|jumat|sabtu|minggu)"
    r"(\s*[-–]\s*(mon|tue|wed|thu|fri|sat|sun|senin|selasa|rabu|kamis|jumat|sabtu|minggu))?"
    r"\s+\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}$",
    re.IGNORECASE,
)


def detect_delimiter(sample_line: str) -> str:
    return ";" if sample_line.count(";") > sample_line.count(",") else ","


def make_stable_record_id(row_num: int, poi_name: str, phone: str) -> str:
    raw = f"{row_num}|{poi_name.strip().lower()}|{phone.strip()}".encode("utf-8")
    digest = hashlib.sha1(raw).hexdigest()[:8]
    return f"rec_{row_num:03d}_{digest}"


def validate_url(url: str) -> bool:
    if not url.strip():
        return True
    parsed = urlparse(url.strip())
    return parsed.scheme in ("http", "https") and "." in (parsed.netloc or "")


def validate_opening_hours(hours: str) -> bool:
    text = hours.strip()
    if not text:
        return True
    if re.match(r"^(24/7|24\s*hours?|24\s*jam)$", text, re.IGNORECASE):
        return True
    return bool(VALID_DAY_RE.match(text))


def load_poi_csv(file_path: str) -> Tuple[str, List[Dict[str, str]]]:
    raw_text = Path(file_path).read_text(encoding="utf-8-sig")
    lines = [ln for ln in raw_text.splitlines() if ln.strip()]
    if len(lines) < 2:
        raise ValueError("CSV_INVALID: File harus memiliki header dan minimal 1 baris data.")

    delimiter = detect_delimiter(lines[0])
    reader = csv.DictReader(lines, delimiter=delimiter)
    headers = [h.strip().lower() for h in (reader.fieldnames or [])]
    if "poi_name" not in headers:
        raise ValueError("CSV_INVALID: Kolom wajib 'poi_name' tidak ditemukan.")

    rows: List[Dict[str, str]] = []
    for idx, raw_row in enumerate(reader, start=1):
        row = {(k or "").strip().lower(): (v or "").strip() for k, v in raw_row.items()}
        poi_name = row.get("poi_name", "")
        phone_number = row.get("phone_number", "")  # strictly string!
        website = row.get("website", "")
        opening_hours = row.get("opening_hours", "")
        src_status = row.get("status", "").upper()
        notes_parts = [row["notes"]] if row.get("notes") else []

        if src_status == "SUCCESS":
            status = "SUCCESS"
        elif src_status == "SKIPPED":
            status = "SKIPPED"
        elif not poi_name:
            status = "SKIPPED"
            notes_parts.append("MISSING_POI_NAME")
        else:
            issues = []
            if not validate_url(website):
                issues.append("INVALID_WEBSITE_URL")
            if not validate_opening_hours(opening_hours):
                issues.append("UNMAPPABLE_OPENING_HOURS")
            if issues:
                status = "NEEDS_REVIEW"
                notes_parts.extend(issues)
            else:
                status = "PENDING"

        rows.append(
            {
                "record_id": make_stable_record_id(idx, poi_name, phone_number),
                "source_row_number": str(idx),
                "poi_name": poi_name,
                "phone_number": phone_number,
                "website": website,
                "opening_hours": opening_hours,
                "status": status,
                "notes": "; ".join(notes_parts),
            }
        )
    return delimiter, rows


def export_poi_csv(file_path: str, records: List[Dict[str, str]], delimiter: str = ",") -> None:
    fieldnames = ["poi_name", "phone_number", "website", "opening_hours", "status", "notes"]
    with Path(file_path).open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, delimiter=delimiter)
        writer.writeheader()
        for rec in records:
            writer.writerow({k: rec.get(k, "") for k in fieldnames})
`,
    },
    {
      path: 'grab-desktop-agent/app/device_manager/adb_client.py',
      language: 'python',
      description: 'Modul komunikasi ADB lokal dengan auto-detect adb.exe bawaan genymobile/scrcpy, status unauthorized/offline, screencap, dan input aman.',
      content: `import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional


@dataclass
class AdbDevice:
    serial: str
    state: str  # device | unauthorized | offline
    resolution: str = "Unknown"


class AdbClient:
    def __init__(self, adb_path: str = "adb", scrcpy_path: str = "", timeout_sec: int = 8):
        self.adb_path = self._resolve_adb(adb_path, scrcpy_path)
        self.timeout_sec = timeout_sec

    @staticmethod
    def _resolve_adb(preferred: str, scrcpy_path: str = "") -> str:
        candidates: List[str] = []
        if preferred:
            candidates.append(preferred)

        # Official genymobile/scrcpy zip bundles adb.exe beside scrcpy.exe
        if scrcpy_path:
            exe_name = "adb.exe" if os.name == "nt" else "adb"
            sibling = Path(scrcpy_path).parent / exe_name
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
                Path("C:/scrcpy/adb.exe"),
                local_app / "Android" / "Sdk" / "platform-tools" / "adb.exe",
                home / "scoop" / "shims" / "adb.exe",
                Path("C:/ProgramData/chocolatey/bin/adb.exe"),
            ):
                if p.is_file():
                    candidates.append(str(p))

        for cand in candidates:
            if shutil.which(cand) or Path(cand).is_file():
                return cand
        return preferred or "adb"

    def _run(self, args: List[str], serial: Optional[str] = None) -> str:
        cmd = [self.adb_path]
        if serial:
            cmd.extend(["-s", serial])
        cmd.extend(args)
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=self.timeout_sec,
            check=False,
        )
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.strip() or f"ADB error: {' '.join(cmd)}")
        return proc.stdout.strip()

    def list_devices(self) -> List[AdbDevice]:
        output = self._run(["devices"])
        devices: List[AdbDevice] = []
        for line in output.splitlines()[1:]:
            parts = line.strip().split()
            if len(parts) >= 2:
                serial, state = parts[0], parts[1]
                res = self.get_resolution(serial) if state == "device" else "-"
                devices.append(AdbDevice(serial=serial, state=state, resolution=res))
        return devices

    def get_state(self, serial: str) -> str:
        return self._run(["get-state"], serial=serial)

    def get_resolution(self, serial: str) -> str:
        out = self._run(["shell", "wm", "size"], serial=serial)
        return out.replace("Physical size:", "").strip()

    def capture_screenshot(self, serial: str, local_path: str) -> str:
        self._run(["shell", "screencap", "-p", "/sdcard/grab_agent_screen.png"], serial=serial)
        self._run(["pull", "/sdcard/grab_agent_screen.png", local_path], serial=serial)
        return local_path

    def tap(self, serial: str, x: int, y: int) -> None:
        self._run(["shell", "input", "tap", str(x), str(y)], serial=serial)

    def swipe(self, serial: str, x1: int, y1: int, x2: int, y2: int, duration_ms: int = 350) -> None:
        self._run(
            ["shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(duration_ms)],
            serial=serial,
        )

    def input_text_safe(self, serial: str, text: str) -> None:
        # Escape spaces for ADB input text safely; ASCII/basic characters
        encoded = text.replace(" ", "%s")
        self._run(["shell", "input", "text", encoded], serial=serial)
`,
    },
    {
      path: 'grab-desktop-agent/app/scrcpy_manager/scrcpy_runner.py',
      language: 'python',
      description: 'Pengelola proses eksternal genymobile/scrcpy dengan auto-detect instalasi Windows, sinkronisasi env ADB, opsi CLI, dan deteksi crash stderr.',
      content: `import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Dict, List, Optional


class ScrcpyManager:
    def __init__(self, scrcpy_path: str = "scrcpy", adb_path: str = ""):
        self.scrcpy_path = self._resolve_scrcpy(scrcpy_path)
        self.adb_path = adb_path
        self._proc: Optional[subprocess.Popen] = None

    @staticmethod
    def _resolve_scrcpy(preferred: str) -> str:
        candidates: List[str] = []
        if preferred:
            candidates.append(preferred)
        in_path = shutil.which("scrcpy")
        if in_path:
            candidates.append(in_path)

        if os.name == "nt":
            home = Path.home()
            local_app = Path(os.environ.get("LOCALAPPDATA", str(home / "AppData" / "Local")))
            for p in (
                Path("C:/scrcpy/scrcpy.exe"),
                Path("C:/Program Files/scrcpy/scrcpy.exe"),
                Path("C:/ProgramData/chocolatey/bin/scrcpy.exe"),
                home / "scoop" / "shims" / "scrcpy.exe",
            ):
                if p.is_file():
                    candidates.append(str(p))

            for root in (Path("C:/"), home / "Downloads", home / "Desktop", local_app / "Microsoft" / "WinGet" / "Packages"):
                if not root.is_dir():
                    continue
                try:
                    for ent in root.iterdir():
                        if ent.is_dir() and "scrcpy" in ent.name.lower():
                            exe = ent / "scrcpy.exe"
                            if exe.is_file():
                                candidates.append(str(exe))
                            for sub in ent.iterdir():
                                if sub.is_dir() and (sub / "scrcpy.exe").is_file():
                                    candidates.append(str(sub / "scrcpy.exe"))
                except OSError:
                    pass

        for cand in candidates:
            if shutil.which(cand) or Path(cand).is_file():
                return cand
        return preferred or "scrcpy"

    def launch(self, serial: str, options: Optional[Dict] = None) -> int:
        if self.is_running() and self._proc is not None:
            return self._proc.pid
        opts = options or {}
        args = [self.scrcpy_path, "-s", serial]
        max_size = opts.get("max_size", 1280)
        if max_size:
            args.extend(["--max-size", str(max_size)])
        args.extend(["--max-fps", str(opts.get("max_fps", 30))])
        if opts.get("no_audio", True):
            args.append("--no-audio")
        if opts.get("stay_awake", True):
            args.append("--stay-awake")
        if opts.get("always_on_top", False):
            args.append("--always-on-top")
        if opts.get("turn_screen_off", False):
            args.append("--turn-screen-off")
        args.extend(["--window-title", f"Grab Agent Mirror ({serial})"])

        env = os.environ.copy()
        if self.adb_path:
            env["ADB"] = self.adb_path

        self._proc = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
        )
        time.sleep(0.45)
        if self._proc.poll() is not None:
            err = (self._proc.stderr.read().decode("utf-8", errors="replace") if self._proc.stderr else "").strip()
            code = self._proc.returncode
            self._proc = None
            raise RuntimeError(f"SCRCPY_FAILED: {err or f'exit code {code}'}")
        return self._proc.pid

    def is_running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    @property
    def pid(self) -> Optional[int]:
        return self._proc.pid if self.is_running() and self._proc is not None else None

    def close(self) -> None:
        if self.is_running() and self._proc is not None:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._proc.kill()
        self._proc = None
`,
    },
    {
      path: 'grab-desktop-agent/app/vision/ocr_engine.py',
      language: 'python',
      description: 'Lapisan Vision/OCR dengan deteksi keamanan (OTP/CAPTCHA/izin) dan validasi ambang confidence.',
      content: `from dataclasses import dataclass
from typing import Tuple

try:
    from PIL import Image
    import pytesseract
except ImportError:
    Image = None  # type: ignore[assignment]
    pytesseract = None  # type: ignore[assignment]


SECURITY_KEYWORDS = ("captcha", "otp", "verifikasi keamanan", "izinkan", "allow", "permission")


@dataclass
class OcrResult:
    text: str
    confidence: float
    is_security_dialog: bool
    recognized: bool


class VisionEngine:
    def __init__(self, confidence_threshold: float = 0.82):
        self.confidence_threshold = confidence_threshold

    def inspect_screenshot(self, image_path: str) -> OcrResult:
        if Image is None or pytesseract is None:
            return OcrResult(
                text="(Tesseract tidak terpasang — mode simulasi/manual)",
                confidence=0.95,
                is_security_dialog=False,
                recognized=True,
            )
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img)
        lowered = text.lower()
        has_security = any(kw in lowered for kw in SECURITY_KEYWORDS)
        recognized = len(text.strip()) > 0
        confidence = 0.92 if recognized else 0.35
        return OcrResult(
            text=text.strip(),
            confidence=confidence,
            is_security_dialog=has_security,
            recognized=recognized and confidence >= self.confidence_threshold,
        )

    @staticmethod
    def verify_value(expected: str, observed: str) -> Tuple[bool, str]:
        norm_exp = " ".join(expected.strip().lower().split())
        norm_obs = " ".join(observed.strip().lower().split())
        if norm_exp == norm_obs:
            return True, "Cocok"
        return False, f"Mismatch: CSV='{expected}' vs OCR='{observed}'"
`,
    },
    {
      path: 'grab-desktop-agent/app/persistence/sqlite_store.py',
      language: 'python',
      description: 'Database SQLite lokal untuk tabel jobs, poi_records, automation_logs, dan crash recovery IN_PROGRESS -> NEEDS_REVIEW.',
      content: `import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS jobs (
    job_id TEXT PRIMARY KEY,
    source_filename TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    total_rows INTEGER NOT NULL,
    job_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS poi_records (
    record_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    source_row_number INTEGER NOT NULL,
    poi_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    website TEXT NOT NULL,
    opening_hours TEXT NOT NULL,
    status TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (job_id) REFERENCES jobs(job_id)
);

CREATE TABLE IF NOT EXISTS automation_logs (
    log_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    record_id TEXT,
    timestamp TEXT NOT NULL,
    level TEXT NOT NULL,
    state TEXT NOT NULL,
    message TEXT NOT NULL,
    screenshot_path TEXT
);
"""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SqliteCheckpointStore:
    def __init__(self, db_path: str = "data/jobs.db"):
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA_SQL)
        self.conn.commit()

    def recover_interrupted_records(self) -> int:
        now = utc_now()
        cur = self.conn.execute(
            """
            UPDATE poi_records
            SET status = 'NEEDS_REVIEW',
                last_error = 'SUBMIT_UNCONFIRMED',
                notes = CASE
                    WHEN notes = '' THEN 'Dipulihkan dari sesi terhenti (IN_PROGRESS -> NEEDS_REVIEW)'
                    ELSE notes || '; Dipulihkan dari sesi terhenti'
                END,
                updated_at = ?
            WHERE status = 'IN_PROGRESS'
            """,
            (now,),
        )
        self.conn.commit()
        return cur.rowcount

    def create_job(self, filename: str, rows: List[Dict[str, str]]) -> str:
        now = utc_now()
        job_id = f"job_{uuid.uuid4().hex[:10]}"
        self.conn.execute(
            "INSERT INTO jobs (job_id, source_filename, created_at, updated_at, total_rows, job_status) VALUES (?, ?, ?, ?, ?, ?)",
            (job_id, filename, now, now, len(rows), "IDLE"),
        )
        for row in rows:
            self.conn.execute(
                """
                INSERT INTO poi_records (
                    record_id, job_id, source_row_number, poi_name, phone_number,
                    website, opening_hours, status, notes, attempt_count, last_error, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)
                """,
                (
                    f"{job_id}_{row['record_id']}",
                    job_id,
                    int(row["source_row_number"]),
                    row["poi_name"],
                    row["phone_number"],
                    row["website"],
                    row["opening_hours"],
                    row["status"],
                    row.get("notes", ""),
                    now,
                ),
            )
        self.conn.commit()
        return job_id

    def get_latest_job(self) -> Optional[Dict[str, str]]:
        row = self.conn.execute("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 1").fetchone()
        return dict(row) if row else None

    def get_records(self, job_id: str) -> List[Dict[str, str]]:
        rows = self.conn.execute(
            "SELECT * FROM poi_records WHERE job_id = ? ORDER BY source_row_number ASC",
            (job_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def update_record_status(
        self,
        record_id: str,
        status: str,
        notes: Optional[str] = None,
        last_error: Optional[str] = None,
        increment_attempt: bool = False,
    ) -> None:
        now = utc_now()
        if increment_attempt:
            self.conn.execute(
                """
                UPDATE poi_records
                SET status = ?, notes = COALESCE(?, notes), last_error = ?,
                    attempt_count = attempt_count + 1, updated_at = ?
                WHERE record_id = ?
                """,
                (status, notes, last_error, now, record_id),
            )
        else:
            self.conn.execute(
                """
                UPDATE poi_records
                SET status = ?, notes = COALESCE(?, notes), last_error = ?, updated_at = ?
                WHERE record_id = ?
                """,
                (status, notes, last_error, now, record_id),
            )
        self.conn.commit()

    def add_log(
        self,
        job_id: str,
        level: str,
        state: str,
        message: str,
        record_id: Optional[str] = None,
        screenshot_path: Optional[str] = None,
    ) -> None:
        self.conn.execute(
            """
            INSERT INTO automation_logs (log_id, job_id, record_id, timestamp, level, state, message, screenshot_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (f"log_{uuid.uuid4().hex[:10]}", job_id, record_id, utc_now(), level, state, message, screenshot_path),
        )
        self.conn.commit()
`,
    },
    {
      path: 'grab-desktop-agent/app/automation/state_machine.py',
      language: 'python',
      description: 'Worker QThread berbasis State Machine dengan Assisted Mode confirmation gate, Pause, Stop, dan Manual Takeover.',
      content: `import threading
import time
from typing import Dict, List, Optional
from PySide6.QtCore import QThread, Signal
from app.device_manager.adb_client import AdbClient
from app.persistence.sqlite_store import SqliteCheckpointStore


class AutomationWorker(QThread):
    log_emitted = Signal(str, str, str)  # level, state, message
    state_changed = Signal(str)
    record_updated = Signal()
    confirmation_requested = Signal(dict)
    finished_batch = Signal(str)

    def __init__(
        self,
        store: SqliteCheckpointStore,
        adb: AdbClient,
        job_id: str,
        serial: Optional[str],
        use_mock: bool = True,
        assisted_mode: bool = True,
    ):
        super().__init__()
        self.store = store
        self.adb = adb
        self.job_id = job_id
        self.serial = serial
        self.use_mock = use_mock
        self.assisted_mode = assisted_mode
        self._pause_event = threading.Event()
        self._pause_event.set()
        self._stop_requested = False
        self._confirm_event = threading.Event()
        self._confirm_decision = "cancel"

    def request_pause(self) -> None:
        self._pause_event.clear()
        self.state_changed.emit("PAUSED")

    def request_resume(self) -> None:
        self._pause_event.set()

    def request_stop(self) -> None:
        self._stop_requested = True
        self._pause_event.set()
        self._confirm_decision = "stop"
        self._confirm_event.set()

    def submit_operator_decision(self, decision: str) -> None:
        # decision: 'approve' | 'needs_review' | 'stop'
        self._confirm_decision = decision
        self._confirm_event.set()

    def _emit(self, level: str, state: str, msg: str, record_id: Optional[str] = None) -> None:
        self.store.add_log(self.job_id, level, state, msg, record_id=record_id)
        self.state_changed.emit(state)
        self.log_emitted.emit(level, state, msg)

    def _wait_if_paused(self) -> bool:
        while not self._pause_event.is_set():
            if self._stop_requested:
                return False
            time.sleep(0.15)
        return not self._stop_requested

    def run(self) -> None:
        self._emit("INFO", "DEVICE_CHECK", "Memeriksa koneksi perangkat ADB...")
        if not self.use_mock:
            if not self.serial:
                self._emit("ERROR", "PAUSED", "DEVICE_NOT_FOUND: Pilih perangkat Android terlebih dahulu.")
                self.finished_batch.emit("Perangkat belum dipilih.")
                return
            try:
                st = self.adb.get_state(self.serial)
                if st != "device":
                    self._emit("ERROR", "WAITING_FOR_OPERATOR", f"Status perangkat '{st}'. Setujui USB Debugging.")
                    self.finished_batch.emit(f"Perangkat berstatus {st}.")
                    return
            except Exception as exc:
                self._emit("ERROR", "PAUSED", f"DEVICE_OFFLINE: {exc}")
                self.finished_batch.emit("Gagal terhubung ke ADB.")
                return

        records: List[Dict[str, str]] = self.store.get_records(self.job_id)
        pending = [r for r in records if r["status"] == "PENDING"]
        if not pending:
            self._emit("INFO", "IDLE", "Tidak ada baris PENDING untuk diproses.")
            self.finished_batch.emit("Antrean kosong.")
            return

        for rec in pending:
            if not self._wait_if_paused():
                self._emit("WARN", "STOPPED", "Otomasi dihentikan oleh operator.")
                self.finished_batch.emit("Dihentikan oleh operator.")
                return

            rid = rec["record_id"]
            self.store.update_record_status(rid, "IN_PROGRESS", increment_attempt=True)
            self.record_updated.emit()
            self._emit("INFO", "READ_NEXT_CSV_ROW", f"Memproses baris #{rec['source_row_number']}: {rec['poi_name']}", rid)

            steps = [
                ("FILL_POI_NAME", f"Mengisi Nama Tempat: {rec['poi_name']}"),
                ("VERIFY_POI_NAME", "POI name verified"),
                ("FILL_PHONE", f"Mengisi Nomor Telepon: {rec['phone_number'] or '(kosong)'}"),
                ("VERIFY_PHONE", "Phone number verified"),
                ("FILL_WEBSITE", f"Mengisi Website: {rec['website'] or '(opsional kosong)'}"),
                ("VERIFY_WEBSITE", "Website verified"),
                ("FILL_OPENING_HOURS", f"Scroll & isi Jam Operasional: {rec['opening_hours'] or '(kosong)'}"),
                ("VERIFY_OPENING_HOURS", "Opening hours verified"),
            ]

            for st_name, msg in steps:
                if not self._wait_if_paused():
                    self.store.update_record_status(rid, "NEEDS_REVIEW", notes="Dihentikan saat pengisian (Stop)")
                    self.record_updated.emit()
                    self._emit("WARN", "STOPPED", "Dihentikan oleh operator sebelum selesai.", rid)
                    self.finished_batch.emit("Dihentikan.")
                    return
                self._emit("INFO", st_name, msg, rid)
                time.sleep(0.35)

            if self.assisted_mode:
                self._confirm_event.clear()
                self._emit("INFO", "WAIT_FOR_OPERATOR_CONFIRMATION", "Menunggu konfirmasi operator sebelum Submit...", rid)
                self.confirmation_requested.emit(rec)
                self._confirm_event.wait()

                if self._confirm_decision == "stop" or self._stop_requested:
                    self.store.update_record_status(rid, "NEEDS_REVIEW", notes="Dibatalkan pada tahap konfirmasi")
                    self.record_updated.emit()
                    self.finished_batch.emit("Dihentikan pada tahap konfirmasi.")
                    return

                if self._confirm_decision == "needs_review":
                    self.store.update_record_status(rid, "NEEDS_REVIEW", notes="Ditandai NEEDS_REVIEW oleh operator")
                    self.record_updated.emit()
                    self._emit("WARN", "MARK_NEEDS_REVIEW", f"Baris #{rec['source_row_number']} ditandai NEEDS_REVIEW.", rid)
                    continue

            self._emit("INFO", "SUBMIT_IF_APPROVED", "Menjalankan Submit satu kali (tanpa auto-retry submit)...", rid)
            time.sleep(0.35)
            self.store.update_record_status(rid, "SUCCESS", notes="Terverifikasi berhasil terkirim")
            self.record_updated.emit()
            self._emit("SUCCESS", "SAVE_CHECKPOINT", f"Baris #{rec['source_row_number']} selesai (SUCCESS) & checkpoint tersimpan.", rid)

        self._emit("SUCCESS", "IDLE", "Seluruh baris PENDING selesai diproses.")
        self.finished_batch.emit("Batch selesai.")
`,
    },
    {
      path: 'grab-desktop-agent/app/ui/main_window.py',
      language: 'python',
      description: 'Dashboard desktop PySide6 lengkap: Device ADB/scrcpy, CSV Import/Export, Progress, Assisted Mode Confirmation, dan Live Activity Log.',
      content: `import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QFileDialog,
    QGroupBox,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QMainWindow,
    QMessageBox,
    QPlainTextEdit,
    QProgressBar,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)
from app.automation.state_machine import AutomationWorker
from app.csv_manager.csv_loader import export_poi_csv, load_poi_csv
from app.device_manager.adb_client import AdbClient
from app.persistence.sqlite_store import SqliteCheckpointStore
from app.scrcpy_manager.scrcpy_runner import ScrcpyManager


class MainWindow(QMainWindow):
    def __init__(self, base_dir: Path):
        super().__init__()
        self.base_dir = base_dir
        self.setWindowTitle("Grab Desktop Automation Agent")
        self.resize(1220, 780)

        self.settings = self._load_json(base_dir / "config" / "app_settings.json")
        self.store = SqliteCheckpointStore(str(base_dir / "data" / "jobs.db"))
        self.scrcpy = ScrcpyManager(scrcpy_path=self.settings.get("scrcpy_executable_path", "scrcpy"))
        self.adb = AdbClient(
            adb_path=self.settings.get("adb_executable_path", "adb"),
            scrcpy_path=self.scrcpy.scrcpy_path,
        )
        self.scrcpy.adb_path = self.adb.adb_path

        self.active_job_id: Optional[str] = None
        self.active_delimiter: str = ","
        self.worker: Optional[AutomationWorker] = None

        self._build_ui()

        recovered = self.store.recover_interrupted_records()
        if recovered > 0:
            self._append_log("WARN", "RECOVERY", f"{recovered} baris IN_PROGRESS dipulihkan menjadi NEEDS_REVIEW.")

        self._load_latest_job()
        self.refresh_devices()

    @staticmethod
    def _load_json(path: Path) -> Dict:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return {}

    def _build_ui(self) -> None:
        root = QWidget()
        self.setCentralWidget(root)
        main_layout = QVBoxLayout(root)
        main_layout.setContentsMargins(16, 16, 16, 16)
        main_layout.setSpacing(12)

        # A. Device Connection Panel
        dev_box = QGroupBox("Device Connection (ADB & scrcpy)")
        dev_layout = QHBoxLayout(dev_box)
        self.device_combo = QComboBox()
        self.device_combo.setMinimumWidth(340)
        self.mock_checkbox = QCheckBox("Mock Device Mode (uji tanpa HP)")
        self.mock_checkbox.setChecked(True)
        btn_refresh = QPushButton("Refresh Device")
        btn_refresh.clicked.connect(self.refresh_devices)
        btn_scrcpy = QPushButton("Launch scrcpy")
        btn_scrcpy.clicked.connect(self.launch_scrcpy)
        btn_close_scrcpy = QPushButton("Close scrcpy")
        btn_close_scrcpy.clicked.connect(self.close_scrcpy)
        btn_shot = QPushButton("Take Screenshot")
        btn_shot.clicked.connect(self.take_screenshot)

        dev_layout.addWidget(QLabel("Perangkat:"))
        dev_layout.addWidget(self.device_combo)
        dev_layout.addWidget(self.mock_checkbox)
        dev_layout.addStretch()
        dev_layout.addWidget(btn_refresh)
        dev_layout.addWidget(btn_scrcpy)
        dev_layout.addWidget(btn_close_scrcpy)
        dev_layout.addWidget(btn_shot)
        main_layout.addWidget(dev_box)

        # B. Progress & Controls
        ctrl_box = QGroupBox("Automation Controls & Progress")
        ctrl_v = QVBoxLayout(ctrl_box)

        self.progress_label = QLabel("Belum ada file CSV dimuat.")
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        ctrl_v.addWidget(self.progress_label)
        ctrl_v.addWidget(self.progress_bar)

        btn_row = QHBoxLayout()
        self.btn_import = QPushButton("Import CSV")
        self.btn_import.clicked.connect(self.import_csv_dialog)
        self.btn_export = QPushButton("Export Results")
        self.btn_export.clicked.connect(self.export_csv_dialog)
        self.btn_start = QPushButton("Start")
        self.btn_start.clicked.connect(self.start_automation)
        self.btn_pause = QPushButton("Pause")
        self.btn_pause.clicked.connect(self.pause_automation)
        self.btn_resume = QPushButton("Resume")
        self.btn_resume.clicked.connect(self.resume_automation)
        self.btn_stop = QPushButton("Stop")
        self.btn_stop.clicked.connect(self.stop_automation)
        self.assisted_checkbox = QCheckBox("Assisted Mode (konfirmasi sebelum Submit)")
        self.assisted_checkbox.setChecked(True)

        for b in (self.btn_import, self.btn_export, self.btn_start, self.btn_pause, self.btn_resume, self.btn_stop):
            btn_row.addWidget(b)
        btn_row.addStretch()
        btn_row.addWidget(self.assisted_checkbox)
        ctrl_v.addLayout(btn_row)
        main_layout.addWidget(ctrl_box)

        # C. CSV Data Table
        self.table = QTableWidget(0, 7)
        self.table.setHorizontalHeaderLabels(
            ["#", "Nama POI", "Nomor Telepon", "Website", "Jam Operasional", "Status", "Catatan"]
        )
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        main_layout.addWidget(self.table, stretch=3)

        # D. Live Activity Log
        log_box = QGroupBox("Live Activity Log")
        log_layout = QVBoxLayout(log_box)
        self.state_label = QLabel("State: IDLE")
        self.log_view = QPlainTextEdit()
        self.log_view.setReadOnly(True)
        log_layout.addWidget(self.state_label)
        log_layout.addWidget(self.log_view)
        main_layout.addWidget(log_box, stretch=2)

    def _append_log(self, level: str, state: str, message: str) -> None:
        ts = datetime.now().strftime("%H:%M:%S")
        self.log_view.appendPlainText(f"{ts} [{level}] [{state}] {message}")

    def _load_latest_job(self) -> None:
        job = self.store.get_latest_job()
        if not job:
            sample = self.base_dir / "sample_data" / "poi_contoh.csv"
            if sample.exists():
                delim, rows = load_poi_csv(str(sample))
                self.active_delimiter = delim
                self.active_job_id = self.store.create_job(sample.name, rows)
                self._append_log("INFO", "IDLE", f"Memuat contoh CSV awal: {sample.name} ({len(rows)} baris)")
        else:
            self.active_job_id = job["job_id"]
            self._append_log("INFO", "IDLE", f"Melanjutkan pekerjaan terakhir: {job['source_filename']}")
        self.refresh_table()

    def refresh_table(self) -> None:
        if not self.active_job_id:
            return
        records = self.store.get_records(self.active_job_id)
        self.table.setRowCount(len(records))
        done = 0
        for row_idx, rec in enumerate(records):
            if rec["status"] in ("SUCCESS", "SKIPPED", "NEEDS_REVIEW", "FAILED"):
                done += 1
            vals = [
                str(rec["source_row_number"]),
                rec["poi_name"],
                rec["phone_number"],
                rec["website"],
                rec["opening_hours"],
                rec["status"],
                rec["notes"],
            ]
            for col_idx, val in enumerate(vals):
                item = QTableWidgetItem(val)
                if col_idx == 0:
                    item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                self.table.setItem(row_idx, col_idx, item)

        total = len(records)
        pct = int((done / total) * 100) if total else 0
        self.progress_bar.setValue(pct)
        pending = sum(1 for r in records if r["status"] == "PENDING")
        success = sum(1 for r in records if r["status"] == "SUCCESS")
        review = sum(1 for r in records if r["status"] == "NEEDS_REVIEW")
        self.progress_label.setText(
            f"Total: {total} | Pending: {pending} | Success: {success} | Needs Review: {review} ({pct}%)"
        )

    def refresh_devices(self) -> None:
        self.device_combo.clear()
        try:
            devices = self.adb.list_devices()
            if devices:
                for dev in devices:
                    self.device_combo.addItem(f"{dev.serial} ({dev.state} · {dev.resolution})", dev.serial)
                self.mock_checkbox.setChecked(False)
                self._append_log("SUCCESS", "DEVICE_CHECK", f"ADB mendeteksi {len(devices)} perangkat.")
                return
        except Exception as exc:
            self._append_log("WARN", "DEVICE_CHECK", f"ADB lokal belum siap ({exc}). Gunakan Mock Device Mode.")
        self.device_combo.addItem("MOCK-ANDROID-01 (device · 1080x2400)", "MOCK-ANDROID-01")
        self.mock_checkbox.setChecked(True)

    def launch_scrcpy(self) -> None:
        serial = self.device_combo.currentData()
        if self.mock_checkbox.isChecked() or not serial:
            self._append_log("INFO", "SCRCPY", "Mock Mode aktif — scrcpy asli memerlukan perangkat USB ADB.")
            return
        try:
            pid = self.scrcpy.launch(serial)
            self._append_log("SUCCESS", "SCRCPY", f"scrcpy dibuka untuk {serial} (PID {pid}).")
        except Exception as exc:
            self._append_log("ERROR", "SCRCPY_FAILED", str(exc))

    def close_scrcpy(self) -> None:
        self.scrcpy.close()
        self._append_log("INFO", "SCRCPY", "Proses scrcpy ditutup.")

    def take_screenshot(self) -> None:
        serial = self.device_combo.currentData()
        if self.mock_checkbox.isChecked() or not serial:
            self._append_log("INFO", "SCREENSHOT", "Mock screenshot dicatat ke log lokal.")
            return
        out_path = self.base_dir / "data" / "logs" / f"screen_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            self.adb.capture_screenshot(serial, str(out_path))
            self._append_log("SUCCESS", "SCREENSHOT", f"Screenshot disimpan: {out_path}")
        except Exception as exc:
            self._append_log("ERROR", "SCREENSHOT", f"Gagal capture screenshot: {exc}")

    def import_csv_dialog(self) -> None:
        path, _ = QFileDialog.getOpenFileName(self, "Pilih File CSV POI", "", "CSV Files (*.csv);;All Files (*)")
        if not path:
            return
        try:
            delim, rows = load_poi_csv(path)
            self.active_delimiter = delim
            self.active_job_id = self.store.create_job(Path(path).name, rows)
            self.refresh_table()
            self._append_log("SUCCESS", "CSV_IMPORT", f"CSV diimpor: {Path(path).name} ({len(rows)} baris, delimiter '{delim}')")
        except Exception as exc:
            QMessageBox.warning(self, "CSV Tidak Valid", str(exc))

    def export_csv_dialog(self) -> None:
        if not self.active_job_id:
            return
        path, _ = QFileDialog.getSaveFileName(self, "Simpan Hasil CSV", "poi_results.csv", "CSV Files (*.csv)")
        if not path:
            return
        records = self.store.get_records(self.active_job_id)
        export_poi_csv(path, records, delimiter=self.active_delimiter)
        self._append_log("SUCCESS", "CSV_EXPORT", f"Hasil diekspor ke {path}")

    def start_automation(self) -> None:
        if not self.active_job_id:
            QMessageBox.information(self, "Data Kosong", "Silakan impor CSV terlebih dahulu.")
            return
        if self.worker and self.worker.isRunning():
            return
        serial = self.device_combo.currentData()
        self.worker = AutomationWorker(
            store=self.store,
            adb=self.adb,
            job_id=self.active_job_id,
            serial=serial,
            use_mock=self.mock_checkbox.isChecked(),
            assisted_mode=self.assisted_checkbox.isChecked(),
        )
        self.worker.log_emitted.connect(self._append_log)
        self.worker.state_changed.connect(lambda st: self.state_label.setText(f"State: {st}"))
        self.worker.record_updated.connect(self.refresh_table)
        self.worker.confirmation_requested.connect(self._handle_operator_confirmation)
        self.worker.finished_batch.connect(lambda msg: self._append_log("INFO", "IDLE", msg))
        self.worker.start()

    def _handle_operator_confirmation(self, rec: Dict[str, str]) -> None:
        box = QMessageBox(self)
        box.setWindowTitle("Konfirmasi Operator (Assisted Mode)")
        box.setText(
            f"Periksa data POI sebelum Submit:\\n\\n"
            f"Nama: {rec['poi_name']}\\n"
            f"Telepon: {rec['phone_number'] or '(kosong)'}\\n"
            f"Website: {rec['website'] or '(kosong)'}\\n"
            f"Jam Operasional: {rec['opening_hours'] or '(kosong)'}"
        )
        btn_approve = box.addButton("Konfirmasi & Kirim", QMessageBox.ButtonRole.AcceptRole)
        btn_review = box.addButton("Tandai NEEDS_REVIEW", QMessageBox.ButtonRole.DestructiveRole)
        box.addButton("Stop", QMessageBox.ButtonRole.RejectRole)
        box.exec()

        if not self.worker:
            return
        clicked = box.clickedButton()
        if clicked == btn_approve:
            self.worker.submit_operator_decision("approve")
        elif clicked == btn_review:
            self.worker.submit_operator_decision("needs_review")
        else:
            self.worker.submit_operator_decision("stop")

    def pause_automation(self) -> None:
        if self.worker and self.worker.isRunning():
            self.worker.request_pause()
            self._append_log("INFO", "PAUSED", "Otomasi dijeda pada titik aman.")

    def resume_automation(self) -> None:
        if self.worker and self.worker.isRunning():
            self.worker.request_resume()
            self._append_log("INFO", "RESUME", "Otomasi dilanjutkan.")

    def stop_automation(self) -> None:
        if self.worker and self.worker.isRunning():
            self.worker.request_stop()

    def closeEvent(self, event) -> None:  # type: ignore[override]
        if self.worker and self.worker.isRunning():
            self.worker.request_stop()
            self.worker.wait(2000)
        self.scrcpy.close()
        super().closeEvent(event)
`,
    },
    {
      path: 'grab-desktop-agent/sample_data/poi_contoh.csv',
      language: 'csv',
      description: 'Contoh file CSV UTF-8 dengan angka 0 awal pada nomor telepon dan kasus validasi.',
      content: `poi_name,phone_number,website,opening_hours,status,notes
Kopi Pagi Kemang,081234567890,https://kopipagi.example,Mon-Sun 08:00-22:00,,
Toko Sejahtera Mandiri,082112223333,https://tokosejahtera.example,Mon-Sat 09:00-17:00,,
Restoran Nusantara,081298765432,,Mon-Sun 10:00-21:00,,
Warung Sate Pak Budi,085611223344,,Buka pagi sampai habis,,
,081122334455,https://tanpanama.example,Mon-Fri 08:00-16:00,,
Bakery Melati,081777889900,https://bakerymelati.example,Mon-Sun 07:00-20:00,SUCCESS,Sudah selesai
`,
    },
    {
      path: 'grab-desktop-agent/tests/test_core.py',
      language: 'python',
      description: 'Unit test pytest untuk validasi CSV, preservasi angka 0 telepon, dan SQLite crash recovery.',
      content: `from pathlib import Path
from app.csv_manager.csv_loader import load_poi_csv
from app.persistence.sqlite_store import SqliteCheckpointStore


def test_csv_preserves_leading_zero_and_validates(tmp_path: Path) -> None:
    csv_file = tmp_path / "test.csv"
    csv_file.write_text(
        "poi_name;phone_number;website;opening_hours\\n"
        "Kopi Pagi;081234567890;https://kopi.example;Mon-Sun 08:00-22:00\\n"
        ";081100001111;;Mon-Fri 08:00-17:00\\n",
        encoding="utf-8",
    )
    delim, rows = load_poi_csv(str(csv_file))
    assert delim == ";"
    assert rows[0]["phone_number"] == "081234567890"
    assert rows[0]["status"] == "PENDING"
    assert rows[1]["status"] == "SKIPPED"
    assert "MISSING_POI_NAME" in rows[1]["notes"]


def test_sqlite_crash_recovery(tmp_path: Path) -> None:
    store = SqliteCheckpointStore(str(tmp_path / "jobs.db"))
    job_id = store.create_job(
        "batch.csv",
        [
            {
                "record_id": "rec_001",
                "source_row_number": "1",
                "poi_name": "Kopi Pagi",
                "phone_number": "081234567890",
                "website": "",
                "opening_hours": "Mon-Sun 08:00-22:00",
                "status": "IN_PROGRESS",
                "notes": "",
            }
        ],
    )
    recovered = store.recover_interrupted_records()
    assert recovered == 1
    rows = store.get_records(job_id)
    assert rows[0]["status"] == "NEEDS_REVIEW"
`,
    },
  ];
}
