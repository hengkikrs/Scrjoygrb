import { NextRequest, NextResponse } from 'next/server';
import {
  purgeSensitiveEvidence,
  readWorkspaceState,
  resetToSeedWorkspace,
} from '@/lib/persistence';

export async function GET() {
  try {
    const state = await readWorkspaceState();
    return NextResponse.json(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal membaca state workspace.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    if (body.action === 'reset_seed') {
      const state = await resetToSeedWorkspace();
      return NextResponse.json(state);
    }
    return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memproses aksi workspace.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const mode =
      req.nextUrl.searchParams.get('mode') === 'all_logs' ? 'all_logs' : 'screenshots_only';
    const state = await purgeSensitiveEvidence(mode);
    return NextResponse.json(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus bukti sensitif.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
