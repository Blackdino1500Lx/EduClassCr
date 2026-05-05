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
    const { subject, title, fileName, pdfText } = await request.json()
    const ANTHROPIC_KEY = Netlify.env.get('ANTHROPIC_KEY')

    if (!ANTHROPIC_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_KEY no configurado en Netlify → Environment Variables' }), {
        status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    if (!pdfText || pdfText.trim().length < 50) {
      return new Response(JSON.stringify({ error: 'No se pudo extraer texto del PDF. El archivo puede estar escaneado como imagen.' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const isMath = subject === 'Matemáticas'

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: `Sos una tutora experta en ${subject} de Costa Rica. Tu tarea es extraer TODAS las preguntas de exámenes del MEP a partir del texto extraído del PDF. Respondés ÚNICAMENTE con un JSON array válido. Sin markdown, sin texto adicional.`,
        messages: [{
          role: 'user',
          content: `Extraé TODAS las preguntas de este examen del MEP de Costa Rica.

Material: ${title}
Archivo: ${fileName}
Materia: ${subject}

TEXTO EXTRAÍDO DEL PDF:
${pdfText.slice(0, 15000)}

INSTRUCCIONES:
- Extraé TODAS las preguntas numeradas que encontrés en el texto
- Para opción múltiple: enunciado completo + 4 opciones exactas (A, B, C, D)
- Si la pregunta menciona una gráfica o figura que no podés ver en el texto, indicalo así: "[Ver gráfica en PDF] enunciado..."
- Para preguntas de desarrollo: type "open"
- correctOption: 0=A, 1=B, 2=C, 3=D (si no podés determinarlo, ponés 0)
- points: ${isMath ? '10' : '5'} para todas

Respondé SOLO con el JSON array:
[{"id":"q1","text":"...","type":"multiple","options":["A","B","C","D"],"correctOption":0,"points":${isMath ? '10' : '5'}}]`
        }],
      }),
    })

    const data = await response.json()
    console.log('Status:', response.status, '| Preview:', data.content?.[0]?.text?.slice(0, 200))

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err: any) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}
