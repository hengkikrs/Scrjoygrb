import { NextRequest, NextResponse } from 'next/server';
import { saveCheckpointUpdate } from '@/lib/persistence';
import type { AutomationLog, Job, PoiRecord } from '@/lib/types';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as {
      jobStatus?: Job['job_status'];
      recordUpdates?: Array<Partial<PoiRecord> & { record_id: string }>;
      newLogs?: AutomationLog[];
    };

    const updated = await saveCheckpointUpdate({
      jobId: id,
      jobStatus: body.jobStatus,
      recordUpdates: body.recordUpdates,
      newLogs: body.newLogs,
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan checkpoint.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
