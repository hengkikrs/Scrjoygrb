import { NextRequest, NextResponse } from 'next/server';
import { createJobFromCsv } from '@/lib/persistence';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      filename?: string;
      csvContent?: string;
      delimiter?: ',' | ';';
    };

    if (!body.csvContent || typeof body.csvContent !== 'string') {
      return NextResponse.json(
        { error: 'CSV_INVALID: Konten CSV tidak boleh kosong.' },
        { status: 400 }
      );
    }

    const result = await createJobFromCsv(
      body.filename?.trim() || 'imported_poi.csv',
      body.csvContent,
      body.delimiter
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.state, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengimpor file CSV.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
