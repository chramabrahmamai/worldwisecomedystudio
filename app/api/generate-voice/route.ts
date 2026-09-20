import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

function wavFromPcm(pcm: Uint8Array, sampleRate = 24000) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, 36 + pcm.byteLength, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, pcm.byteLength, true);
  const wav = new Uint8Array(44 + pcm.byteLength); wav.set(new Uint8Array(header)); wav.set(pcm, 44); return wav;
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI_SETUP_REQUIRED" }, { status: 503 });
  const body = await request.json() as { narration?: string; voice?: string };
  const narration = body.narration?.trim();
  if (!narration || narration.length > 2000) return NextResponse.json({ error: "INVALID_NARRATION" }, { status: 400 });

  try {
    const configuredModel = process.env.GEMINI_TTS_MODEL;
    const attempts = configuredModel ? [configuredModel, configuredModel, configuredModel] : ["gemini-3.1-flash-tts-preview", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];
    let audio = "";
    let lastStatus = 502;
    let lastReason = "UNKNOWN";
    for (const model of attempts) {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          input: `Synthesize speech for the transcript below. Read only the transcript, exactly as written. Use a warm, energetic news-comedy delivery with natural pauses.\n\nTRANSCRIPT:\n${narration}`,
          response_format: { type: "audio" },
          generation_config: { speech_config: [{ voice: body.voice || "Kore" }] },
        }),
      });
      lastStatus = response.status;
      if (response.ok) {
        const payload = await response.json() as { output_audio?: { data?: string } };
        audio = payload.output_audio?.data || "";
        if (audio) break;
        lastReason = "EMPTY_AUDIO";
      } else {
        const payload = await response.json().catch(() => ({})) as { error?: { status?: string } };
        lastReason = payload.error?.status || `HTTP_${response.status}`;
        if (response.status === 400 || response.status === 401 || response.status === 403) break;
      }
    }
    if (!audio) return NextResponse.json({ error: "VOICE_PROVIDER_ERROR", reason: lastReason, providerStatus: lastStatus }, { status: 502 });
    const wav = wavFromPcm(decodeBase64(audio));
    return new NextResponse(wav, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "Content-Length": String(wav.byteLength) } });
  } catch {
    return NextResponse.json({ error: "VOICE_GENERATION_FAILED" }, { status: 502 });
  }
}
