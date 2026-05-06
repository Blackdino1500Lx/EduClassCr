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
    const { subject, title, fileName, pdfText, chunkInfo } = await request.json()
    const ANTHROPIC_KEY = Netlify.env.get('ANTHROPIC_KEY')

    if (!ANTHROPIC_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_KEY no configurado' }), {
        status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    if (!pdfText || pdfText.trim().length < 50) {
      return new Response(JSON.stringify({ error: 'Texto muy corto o vacío' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const isMath = subject === 'Matemáticas'
    const chunkNote = chunkInfo ? `Esta es la ${chunkInfo} del examen. Extraé solo las preguntas numeradas que aparezcan en este fragmento.` : ''

    const prompt = [
      `Examen del MEP de Costa Rica — ${subject}`,
      `Material: ${title} | Archivo: ${fileName}`,
      chunkNote,
      ``,
      `TEXTO:`,
      pdfText,
      ``,
      `INSTRUCCIONES:`,
      `- Extraé ÚNICAMENTE las preguntas numeradas (1) 2) 3)... o 1. 2. 3.)`,
      `- IGNORÁ: encabezados, nombre del estudiante, instrucciones generales, textos que no sean preguntas`,
      `- Opción múltiple: enunciado + 4 opciones exactas sin la letra`,
      `- Figura/gráfica no visible en texto: "[Ver figura en el examen]" al inicio`,
      `- Matemáticas con procedimiento: type "open"`,
      `- correctOption: 0=A 1=B 2=C 3=D`,
      `- points: ${isMath ? '10' : '5'}`,
      ``,
      `Respondé SOLO con JSON array, sin markdown:`,
      `[{"id":"q1","text":"...","type":"multiple","options":["A","B","C","D"],"correctOption":0,"points":${isMath ? '10' : '5'}}]`,
    ].join('\n')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // Faster model for extraction
        max_tokens: 4000,
        system: `Extraés preguntas numeradas de exámenes del MEP de Costa Rica. Respondés ÚNICAMENTE con JSON array válido, sin markdown ni texto adicional.`,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    console.log('Status:', response.status, '| Chunk:', chunkInfo ?? 'full', '| Preview:', data.content?.[0]?.text?.slice(0, 150))

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
