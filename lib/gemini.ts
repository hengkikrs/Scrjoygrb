import { GoogleGenAI, Type } from '@google/genai';
import type { AiErrorExplanation, AiScheduleInterpretation } from './types';
import { validateAiErrorLocally, validateAiScheduleLocally } from './workflow-validation';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function interpretOpeningHoursWithGemini(
  rawSchedule: string
): Promise<{ ok: boolean; result?: AiScheduleInterpretation; error?: string }> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      ok: false,
      error:
        'GEMINI_API_KEY belum dikonfigurasi pada server. Gunakan Mode Tanpa AI atau masukkan format standar (contoh: Mon-Sun 08:00-22:00).',
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Tafsirkan variasi teks jam operasional POI berikut menjadi format terstruktur 24-jam.\nTeks sumber: "${rawSchedule}"\nJika teks ambigu (misal "pagi sampai habis" tanpa jam jelas), set mappable=false dan jangan menebak jam.`,
      config: {
        systemInstruction:
          'Anda adalah asisten validasi data POI yang ketat. Jangan pernah mengarang jam buka/tutup jika tidak tertulis eksplisit pada teks sumber. Output harus selalu JSON sesuai schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            normalized_schedule: {
              type: Type.STRING,
              description:
                'Format standar seperti "Mon-Sun 08:00-22:00" jika bisa dipetakan pasti, atau string kosong jika ambigu.',
            },
            days: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Daftar hari dalam singkatan Inggris: Mon, Tue, Wed, Thu, Fri, Sat, Sun.',
            },
            open_time: {
              type: Type.STRING,
              description: 'Jam buka HH:MM 24-jam atau kosong jika ambigu.',
            },
            close_time: {
              type: Type.STRING,
              description: 'Jam tutup HH:MM 24-jam atau kosong jika ambigu.',
            },
            mappable: {
              type: Type.BOOLEAN,
              description: 'True hanya jika hari dan jam buka/tutup eksplisit dan jelas.',
            },
            explanation: {
              type: Type.STRING,
              description: 'Penjelasan singkat dalam Bahasa Indonesia mengapa valid atau perlu NEEDS_REVIEW.',
            },
          },
          required: [
            'normalized_schedule',
            'days',
            'open_time',
            'close_time',
            'mappable',
            'explanation',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<AiScheduleInterpretation>;
    const validated = validateAiScheduleLocally(parsed);
    return { ok: true, result: validated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menghubungi Gemini API.';
    return { ok: false, error: msg };
  }
}

export async function explainErrorWithGemini(params: {
  errorCode: string;
  lastMessage: string;
  screenTitle: string;
}): Promise<{ ok: boolean; result?: AiErrorExplanation; error?: string }> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      ok: false,
      error:
        'GEMINI_API_KEY belum dikonfigurasi pada server. Lihat tabel penanganan error lokal untuk tindakan pemulihan.',
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Kode error: ${params.errorCode}\nLayar terakhir: ${params.screenTitle}\nPesan log: ${params.lastMessage}\nBerikan penjelasan singkat dan langkah pemulihan aman bagi operator manusia.`,
      config: {
        systemInstruction:
          'Anda adalah asisten pemulihan RPA yang aman. DILARANG menyarankan bypass CAPTCHA, OTP, login, atau mekanisme keamanan. Selalu prioritaskan Manual Takeover, verifikasi layar, dan pencegahan submit ganda. Jawab dalam Bahasa Indonesia.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: 'Ringkasan penyebab error dalam 1-2 kalimat.',
            },
            safe_recovery_steps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2-4 langkah pemulihan aman untuk operator.',
            },
            requires_manual_operator: {
              type: Type.BOOLEAN,
              description: 'Apakah operator perlu mengambil alih secara manual.',
            },
          },
          required: ['summary', 'safe_recovery_steps', 'requires_manual_operator'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<AiErrorExplanation>;
    const validated = validateAiErrorLocally(parsed, params.errorCode);
    return { ok: true, result: validated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menghubungi Gemini API.';
    return { ok: false, error: msg };
  }
}
