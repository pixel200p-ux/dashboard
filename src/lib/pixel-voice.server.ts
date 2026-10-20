import { getSql } from "@/lib/db";

const SHARED_OWNER = "shared";
const EDGE_VOICES = [
  { id: "vi-VN-HoaiMyNeural", name: "Hoài Mỹ (Edge TTS)" },
  { id: "vi-VN-NamMinhNeural", name: "Nam Minh (Edge TTS)" },
] as const;

type ElevenLabsErrorBody = {
  detail?: {
    type?: string;
    code?: string;
    message?: string;
    status?: string;
  };
};

type ElevenLabsVoicesResponse = {
  voices?: {
    voice_id?: string;
    name?: string;
    category?: string;
    labels?: Record<string, string>;
  }[];
};

export type PixelVoice = {
  id: string;
  name: string;
  category?: string;
  labels: Record<string, string>;
};

export type PixelSpeechMode = "auto" | "elevenlabs" | "edge";
export type PixelSpeechResult = { response: Response; provider: "elevenlabs" | "edge" };

async function readElevenLabsError(response: Response): Promise<{
  message: string;
  quotaExhausted: boolean;
}> {
  const body = await response.json().catch(() => null) as ElevenLabsErrorBody | null;
  const detail = body?.detail;
  const quotaExhausted = (response.status === 402 && detail?.type === "payment_required")
    || detail?.type === "quota_exceeded"
    || detail?.status === "quota_exceeded"
    || detail?.code === "quota_exceeded"
    || detail?.code === "character_limit_exceeded";
  return {
    message: detail?.message
      || detail?.code
      || detail?.status
      || `ElevenLabs trả về lỗi ${response.status}`,
    quotaExhausted,
  };
}

export async function getSharedElevenLabsKey(): Promise<string> {
  const sql = await getSql();
  const rows = await sql`
    select key_ciphertext, key_nonce, key_auth_tag
    from pixel_ai_keys
    where user_id = ${SHARED_OWNER} and provider = 'elevenlabs' and status != 'inactive'
    order by created_at
    limit 1
  `;
  if (rows.length === 0) {
    throw new Error("Chưa có API key ElevenLabs đang hoạt động. Hãy thêm key trong Cài đặt.");
  }
  const row = rows[0] as Record<string, unknown>;
  const { decryptSecret } = await import("@/lib/pixel-encryption.server");
  return decryptSecret({
    ciphertext: String(row.key_ciphertext),
    nonce: String(row.key_nonce),
    authTag: String(row.key_auth_tag),
  });
}

export async function checkElevenLabsKey(key: string): Promise<boolean> {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
  });
  if (response.ok) return true;
  if ([400, 401, 403].includes(response.status)) return false;
  const { message } = await readElevenLabsError(response);
  throw new Error(message);
}

export async function listElevenLabsVoices(key: string): Promise<PixelVoice[]> {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
  });
  if (!response.ok) {
    const { message } = await readElevenLabsError(response);
    throw new Error(message);
  }
  const result = await response.json() as ElevenLabsVoicesResponse;
  if (!Array.isArray(result.voices)) {
    throw new Error("ElevenLabs không trả về danh sách giọng hợp lệ.");
  }
  return result.voices.flatMap((voice) => (
    voice.voice_id && voice.name
      ? [{
          id: voice.voice_id,
          name: voice.name,
          ...(voice.category ? { category: voice.category } : {}),
          labels: voice.labels ?? {},
        }]
      : []
  ));
}

export async function generatePixelSpeech({
  key,
  mode,
  elevenLabsVoiceId,
  edgeVoiceId,
  text,
  signal,
}: {
  key: string | undefined;
  mode: PixelSpeechMode;
  elevenLabsVoiceId: string;
  edgeVoiceId: string;
  text: string;
  signal: AbortSignal;
}): Promise<PixelSpeechResult> {
  if (mode !== "edge") {
    if (!key) {
      throw new Error("Chưa có API key ElevenLabs đang hoạt động. Hãy thêm key trong Cài đặt.");
    }
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(elevenLabsVoiceId)}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            style: 0.25,
            use_speaker_boost: true,
          },
        }),
        signal,
      },
    );
    if (response.ok && response.body) {
      return {
        response: new Response(response.body, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
            "X-Pixel-TTS-Provider": "elevenlabs",
          },
        }),
        provider: "elevenlabs",
      };
    }
    const { message, quotaExhausted } = await readElevenLabsError(response);
    if (mode !== "auto" || !quotaExhausted) {
      throw new Error(`ElevenLabs: ${message}`);
    }
  }

  if (!EDGE_VOICES.some((voice) => voice.id === edgeVoiceId)) {
    throw new Error("Giọng Edge TTS không hợp lệ.");
  }
  const { EdgeTTS } = await import("node-edge-tts");
  const edge = new EdgeTTS({
    voice: edgeVoiceId,
    lang: "vi-VN",
    outputFormat: "audio-24khz-48kbitrate-mono-mp3",
    timeout: 30_000,
  });
  const audio = edge.streamAudio(text);
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const next = await audio.next();
          if (next.done) {
            controller.close();
            return;
          }
          if (Buffer.isBuffer(next.value)) {
            const chunk = new Uint8Array(next.value);
            controller.enqueue(chunk);
            return;
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await audio.return(undefined);
    },
  });
  return {
    response: new Response(body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Pixel-TTS-Provider": "edge",
      },
    }),
    provider: "edge",
  };
}

export function pixelEdgeVoices(): PixelVoice[] {
  return EDGE_VOICES.map((voice) => ({
    ...voice,
    category: "Microsoft Neural",
    labels: { language: "Vietnamese" },
  }));
}
