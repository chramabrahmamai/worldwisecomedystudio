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
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview",
        input: `Read the following approved script exactly as written. Do not add, remove, or change words. Use a warm, energetic news-comedy delivery with natural pauses.\n\n${narration}`,
        response_format: { type: "audio" },
        generation_config: { speech_config: [{ voice: body.voice || "Kore" }] },
      }),
    });
    if (!response.ok) return NextResponse.json({ error: "VOICE_PROVIDER_ERROR" }, { status: 502 });
    const payload = await response.json() as { output_audio?: { data?: string } };
    const audio = payload.output_audio?.data;
    if (!audio) return NextResponse.json({ error: "EMPTY_VOICE_RESPONSE" }, { status: 502 });
    const wav = wavFromPcm(decodeBase64(audio));
    return new NextResponse(wav, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "Content-Length": String(wav.byteLength) } });
  } catch {
    return NextResponse.json({ error: "VOICE_GENERATION_FAILED" }, { status: 502 });
  }
}
