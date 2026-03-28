import { openai } from '@/lib/openai'
import { NextRequest } from 'next/server'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const { text } = await req.json()

  if (!text || typeof text !== 'string') {
    return new Response(JSON.stringify({ error: 'text is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'fable',
    input: text,
    response_format: 'mp3',
  })

  const audioStream = response.body as ReadableStream<Uint8Array>

  return new Response(audioStream, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked',
    },
  })
}
