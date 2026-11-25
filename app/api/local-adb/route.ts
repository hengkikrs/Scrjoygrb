import { NextRequest, NextResponse } from 'next/server';
import {
  captureLocalScreenshotBase64,
  closeLocalScrcpy,
  connectWirelessAdb,
  detectLocalAdbDevices,
  launchLocalScrcpy,
} from '@/lib/local-adb';
import { readWorkspaceState } from '@/lib/persistence';
import type { ScrcpyLaunchOptions } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ws = await readWorkspaceState();
    const result = await detectLocalAdbDevices(
      ws.app_settings.adb_executable_path,
      ws.app_settings.scrcpy_executable_path
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memindai ADB & scrcpy lokal.';
    return NextResponse.json(
      {
        adb_available: false,
        adb_path: 'adb',
        adb_version: null,
        scrcpy_available: false,
        scrcpy_path: 'scrcpy',
        scrcpy_version: null,
        devices: [],
        message,
        troubleshooting_tips: [],
        source: 'server_local',
      },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: 'launch_scrcpy' | 'close_scrcpy' | 'connect_wireless' | 'capture_screenshot';
      serial?: string;
      hostPort?: string;
      scrcpyOptions?: Partial<ScrcpyLaunchOptions>;
    };

    const ws = await readWorkspaceState();

    if (body.action === 'connect_wireless') {
      if (!body.hostPort) {
        return NextResponse.json({ error: 'IP:Port perangkat wajib diisi.' }, { status: 400 });
      }
      const res = await connectWirelessAdb(
        body.hostPort,
        ws.app_settings.adb_executable_path,
        ws.app_settings.scrcpy_executable_path
      );
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json(res);
    }

    if (!body.serial) {
      return NextResponse.json({ error: 'Serial perangkat wajib diisi.' }, { status: 400 });
    }

    if (body.action === 'launch_scrcpy') {
      const res = await launchLocalScrcpy(
        body.serial,
        ws.app_settings.scrcpy_executable_path,
        ws.app_settings.adb_executable_path,
        body.scrcpyOptions ?? ws.app_settings.scrcpy_options
      );
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json(res);
    }

    if (body.action === 'close_scrcpy') {
      const res = closeLocalScrcpy(body.serial);
      return NextResponse.json(res);
    }

    if (body.action === 'capture_screenshot') {
      const res = await captureLocalScreenshotBase64(
        body.serial,
        ws.app_settings.adb_executable_path,
        ws.app_settings.scrcpy_executable_path
      );
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menjalankan aksi scrcpy lokal.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
