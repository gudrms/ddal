import OpenAI from 'openai'

// Chat 전용: Gemini (OpenAI 호환 API 사용)
export const gemini = new OpenAI({
  apiKey: 'AIzaSyD9oLLxNzmPqIyHp4tcaU3bJSXbArBwMzY',
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
})

// TTS 전용: OpenAI 계속 사용 (Gemini는 아직 TTS 호환 엔드포인트를 제공하지 않음)
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-...', // 기존 OpenAI 키를 여기에 넣거나 환경 변수 유지
})
