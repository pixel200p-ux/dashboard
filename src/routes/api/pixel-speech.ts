import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { requireUserId, UnauthorizedError } from "@/lib/auth/verify.server";
import {
  generatePixelSpeech,
  getSharedElevenLabsKey,
  pixelEdgeVoices,
  type PixelSpeechMode,
} from "@/lib/pixel-voice.server";

const edgeVoiceIds = pixelEdgeVoices().map((voice) => voice.id);
const speechSchema = z.object({
  mode: z.enum(["auto", "elevenlabs", "edge"]),
  elevenLabsVoiceId: z.string().trim().min(1).max(100),
  edgeVoiceId: z.string().trim().refine((voiceId) => edgeVoiceIds.includes(voiceId)),
  text: z.string().trim().min(1).max(10_000),
});

function errorResponse(error: unknown): Response {
  if (error instanceof UnauthorizedError) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Không tạo được giọng nói Pixel.";
  const status = message.includes("Forbidden:") ? 403 : 502;
  return Response.json({ message }, { status });
}

export const Route = createFileRoute("/api/pixel-speech")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const authorization = request.headers.get("authorization");
          const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
          await requireUserId(bearerToken);

          const contentLength = Number(request.headers.get("content-length"));
          if (Number.isFinite(contentLength) && contentLength > 48_000) {
            return Response.json({ message: "Yêu cầu đọc quá lớn." }, { status: 413 });
          }
          const reader = request.body?.getReader();
          if (!reader) return Response.json({ message: "Thiếu nội dung yêu cầu." }, { status: 400 });
          const chunks: Uint8Array[] = [];
          let totalBytes = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.byteLength;
            if (totalBytes > 48_000) {
              await reader.cancel();
              return Response.json({ message: "Yêu cầu đọc quá lớn." }, { status: 413 });
            }
            chunks.push(value);
          }
          const bytes = new Uint8Array(totalBytes);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
          }
          let body: unknown;
          try {
            body = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
          } catch {
            return Response.json({ message: "Nội dung yêu cầu không phải JSON hợp lệ." }, { status: 400 });
          }
          const parsed = speechSchema.safeParse(body);
          if (!parsed.success) {
            return Response.json({ message: "Yêu cầu đọc không hợp lệ." }, { status: 400 });
          }

          const input = parsed.data;
          const key = input.mode === "edge" ? undefined : await getSharedElevenLabsKey();
          const result = await generatePixelSpeech({
            key,
            mode: input.mode as PixelSpeechMode,
            elevenLabsVoiceId: input.elevenLabsVoiceId,
            edgeVoiceId: input.edgeVoiceId,
            text: input.text,
            signal: request.signal,
          });
          return result.response;
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
