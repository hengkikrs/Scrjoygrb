import { NextResponse } from 'next/server';
import { readWorkspaceState } from '@/lib/persistence';
import { generateScrcpyBridgeBundle } from '@/lib/scrcpy-bridge-exporter';
import { buildZipArchive } from '@/lib/zip-builder';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ws = await readWorkspaceState();
    const files = generateScrcpyBridgeBundle(ws.app_settings);
    const zipBytes = buildZipArchive(
      files.map((f) => ({ path: f.path, content: f.content }))
    );

    return new NextResponse(Buffer.from(zipBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="grab-scrcpy-bridge-windows.zip"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal membuat paket Bridge scrcpy.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
