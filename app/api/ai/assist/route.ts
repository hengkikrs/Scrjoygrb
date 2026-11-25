import { NextRequest, NextResponse } from 'next/server';
import {
  explainErrorWithGemini,
  interpretOpeningHoursWithGemini,
} from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      consentGranted?: boolean;
      task?: 'interpret_opening_hours' | 'explain_error';
      rawSchedule?: string;
      errorCode?: string;
      lastMessage?: string;
      screenTitle?: string;
    };

    if (!body.consentGranted) {
      return NextResponse.json(
        {
          error:
            'Persetujuan operator diperlukan sebelum mengirim teks jadwal atau pesan error ke layanan AI.',
        },
        { status: 403 }
      );
    }

    if (body.task === 'interpret_opening_hours') {
      if (!body.rawSchedule?.trim()) {
        return NextResponse.json(
          { error: 'Teks jam operasional tidak boleh kosong.' },
          { status: 400 }
        );
      }
      const res = await interpretOpeningHoursWithGemini(body.rawSchedule);
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 502 });
      }
      return NextResponse.json(res.result);
    }

    if (body.task === 'explain_error') {
      if (!body.errorCode?.trim()) {
        return NextResponse.json(
          { error: 'Kode error harus disertakan.' },
          { status: 400 }
        );
      }
      const res = await explainErrorWithGemini({
        errorCode: body.errorCode,
        lastMessage: body.lastMessage ?? '',
        screenTitle: body.screenTitle ?? 'Tidak diketahui',
      });
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 502 });
      }
      return NextResponse.json(res.result);
    }

    return NextResponse.json({ error: 'Jenis tugas AI tidak dikenali.' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kesalahan internal server AI.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
