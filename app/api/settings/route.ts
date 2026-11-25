import { NextRequest, NextResponse } from 'next/server';
import { updateSettingsAndProfile } from '@/lib/persistence';
import type { AppSettings, WorkflowProfile } from '@/lib/types';

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      workflow_profile?: WorkflowProfile;
      app_settings?: AppSettings;
    };

    const updated = await updateSettingsAndProfile({
      workflow_profile: body.workflow_profile,
      app_settings: body.app_settings,
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
