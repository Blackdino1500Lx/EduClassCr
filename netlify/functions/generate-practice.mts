import type { Context } from "@netlify/functions"

export default async (request: Request, _context: Context) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { pdfUrl, subject, title, fileName } = await request.json()
    const ANTHROPIC_KEY = Netlify.env.get('ANTHROPIC_KEY')

    if (!ANTHROPIC_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_KEY no configurado en Netlify → Environment Variables' }), {
        status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const isMath = subject === 'Matemáticas'
    const userContent: any[] = []

    // Download PDF server-side (no CORS issues)
    if (pdfUrl) {
      try {
        const pdfResponse = await fetch(pdfUrl)
        if (pdfResponse.ok) {
          const buffer = await pdfResponse.arrayBuffer()
          const base64 = Buffer.from(buffer).toString('base64')
          userContent.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 }
          })
          console.log('PDF loaded, size:', buffer.byteLength, 'bytes')
        } else {
          console.warn('PDF fetch failed:', pdfResponse.status)
        }
      } catch (e) {
        console.warn('PDF download error:', e)
      }
    }

    userContent.push({
      type: 'text',
      text: `Analizá COMPLETAMENTE este examen del MEP de Costa Rica.

Material: ${title}
Archivo: ${fileName}  
Materia: ${subject}

INSTRUCCIONES CRÍTICAS:
- Extraé TODAS las preguntas del examen, sin excepción. Si el examen tiene 55 preguntas, extraé las 55.
- Para cada pregunta de opción múltiple: incluí el enunciado completo y las 4 opciones (A, B, C, D) exactamente como aparecen
- Si una pregunta tiene una gráfica o imagen, describí brevemente qué muestra entre corchetes al inicio del enunciado, ej: "[Gráfico: polígono irregular en sistema de coordenadas con vértices en (1,2), (2,5)...]"
- Para preguntas de desarrollo: usá type "open"
- Los puntos deben ser números enteros (típicamente entre 1 y 5 para exámenes del MEP)
- La respuesta correcta (correctOption) debe ser el índice 0=A, 1=B, 2=C, 3=D

Respondé ÚNICAMENTE con el JSON array completo. Sin markdown, sin explicaciones, sin texto antes o después:

[
  {
    "id": "q1",
    "text": "enunciado completo de la pregunta",
    "type": "multiple",
    "options": ["opción A exacta", "opción B exacta", "opción C exacta", "opción D exacta"],
    "correctOption": 0,
    "points": 5
  }
]`
    })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,  // aumentado para exámenes grandes
        system: `Sos una tutora experta en ${subject} de Costa Rica. Tu única tarea es extraer TODAS las preguntas de exámenes del MEP en formato JSON. Respondés ÚNICAMENTE con el JSON array, sin ningún texto adicional, sin markdown.`,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    const data = await response.json()
    console.log('Anthropic status:', response.status)
    console.log('Content preview:', data.content?.[0]?.text?.slice(0, 500))

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err: any) {
    console.error('Function error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}
