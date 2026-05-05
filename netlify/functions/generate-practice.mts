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
      return new Response(JSON.stringify({ error: 'ANTHROPIC_KEY no configurado' }), {
        status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const isMath = subject === 'Matemáticas'

    // ── Descargar el PDF desde Supabase (servidor a servidor, sin CORS) ──
    const userContent: any[] = []

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
        }
      } catch (e) {
        console.warn('No se pudo descargar el PDF:', e)
      }
    }

    userContent.push({
      type: 'text',
      text: `Analizá este examen del MEP de Costa Rica.
Material: ${title}
Archivo: ${fileName}
Materia: ${subject}

Extraé las preguntas que ya existen en el documento. Si son de opción múltiple, extraélas con sus opciones exactas e indicá cuál es la correcta. Si son de desarrollo, usá type "open".

Generá entre 5 y 10 preguntas. Los puntos deben ser números enteros.

Respondé ÚNICAMENTE con un JSON array, sin markdown, sin texto adicional:
[
  {
    "id": "q1",
    "text": "enunciado completo",
    "type": "${isMath ? 'open' : 'multiple'}",
    ${!isMath ? '"options": ["A", "B", "C", "D"],\n    "correctOption": 0,' : ''}
    "points": 10
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
        max_tokens: 3000,
        system: `Sos una tutora experta en ${subject}. Extraés preguntas de exámenes del MEP de Costa Rica y las devolvés en formato JSON. Respondés ÚNICAMENTE con el JSON array solicitado, sin ningún texto adicional.`,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    const data = await response.json()
    console.log('Status:', response.status)
    console.log('Content preview:', data.content?.[0]?.text?.slice(0, 300))

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err: any) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}
