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
    const { subject, title, fileName, pdfText, pageImages } = await request.json()
    const ANTHROPIC_KEY = Netlify.env.get('ANTHROPIC_KEY')

    if (!ANTHROPIC_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_KEY no configurado' }), {
        status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const isMath = subject === 'Matemáticas'
    const hasText = pdfText && pdfText.trim().length > 100
    const hasImages = pageImages && pageImages.length > 0

    if (!hasText && !hasImages) {
      return new Response(JSON.stringify({ 
        error: 'El PDF está escaneado como imagen y no se pudieron extraer las páginas. Intentá subir el PDF de nuevo.' 
      }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Build message content — prefer images if available (better for math/graphics)
    const userContent: any[] = []

    if (hasImages) {
      // Send up to 10 pages as images to Claude vision
      const pagesToSend = pageImages.slice(0, 10)
      for (const b64 of pagesToSend) {
        userContent.push({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: b64 }
        })
      }
    }

    const promptText = `Analizá ${hasImages ? 'estas páginas del examen' : 'este texto extraído del examen'} del MEP de Costa Rica.

Material: ${title}
Archivo: ${fileName}
Materia: ${subject}

${hasText && !hasImages ? `TEXTO:\n${pdfText.slice(0, 12000)}` : ''}

INSTRUCCIONES:
- Extraé TODAS las preguntas numeradas
- Para opción múltiple: enunciado completo + 4 opciones exactas (A, B, C, D)
- Si la pregunta tiene una gráfica o figura: incluila en el enunciado describiendo qué muestra
- Para matemáticas con desarrollo: type "open"
- correctOption: 0=A, 1=B, 2=C, 3=D
- points: ${isMath ? '10' : '5'}

Respondé SOLO con el JSON array, sin markdown:
[{"id":"q1","text":"...","type":"multiple","options":["A","B","C","D"],"correctOption":0,"points":${isMath ? '10' : '5'}}]`

    userContent.push({ type: 'text', text: promptText })

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
        system: `Sos una tutora experta en ${subject} de Costa Rica. Extraés TODAS las preguntas de exámenes del MEP. Respondés ÚNICAMENTE con JSON array válido, sin markdown.`,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    const data = await response.json()
    console.log('Status:', response.status, '| Mode:', hasImages ? 'vision' : 'text')
    console.log('Preview:', data.content?.[0]?.text?.slice(0, 300))

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
