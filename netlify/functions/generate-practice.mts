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
        error: 'No se pudo extraer contenido del PDF. Intentá subir el archivo de nuevo.'
      }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const userContent: any[] = []

    if (hasImages) {
      for (const b64 of pageImages.slice(0, 10)) {
        userContent.push({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: b64 }
        })
      }
    }

    const textSection = hasText && !hasImages ? `TEXTO EXTRAÍDO DEL EXAMEN:\n${pdfText.slice(0, 12000)}` : ''

    const prompt = [
      `Analizá este examen del MEP de Costa Rica.`,
      `Material: ${title}`,
      `Archivo: ${fileName}`,
      `Materia: ${subject}`,
      textSection,
      ``,
      `INSTRUCCIONES CRÍTICAS:`,
      `- Extraé ÚNICAMENTE las preguntas numeradas: 1) 2) 3)... o 1. 2. 3. etc.`,
      `- IGNORÁ COMPLETAMENTE: encabezados, nombre/cédula del estudiante, fecha, instrucciones generales del examen, textos de lectura o contexto que no sean preguntas, firmas, avisos legales, información de la institución`,
      `- Para opción múltiple: enunciado completo + opciones exactas sin la letra (solo el texto de cada opción)`,
      `- Si el enunciado referencia una figura/gráfica que no está en el texto: escribí "[Ver figura en el examen]" al inicio del enunciado`,
      `- Para matemáticas con procedimiento/desarrollo: type "open"`,
      `- correctOption: 0=A, 1=B, 2=C, 3=D`,
      `- points: ${isMath ? '10' : '5'} para todas`,
      ``,
      `Respondé SOLO con el JSON array. Sin markdown, sin texto antes o después:`,
      `[{"id":"q1","text":"enunciado","type":"multiple","options":["opción A","opción B","opción C","opción D"],"correctOption":0,"points":${isMath ? '10' : '5'}}]`,
    ].join('\n')

    userContent.push({ type: 'text', text: prompt })

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
        system: `Sos una tutora experta en ${subject} de Costa Rica. Tu única tarea es extraer las preguntas numeradas de exámenes del MEP, ignorando todo el texto que no sea una pregunta. Respondés ÚNICAMENTE con el JSON array solicitado, sin markdown ni texto adicional.`,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    const data = await response.json()
    console.log('Status:', response.status, '| Mode:', hasImages ? 'vision' : 'text', '| Preview:', data.content?.[0]?.text?.slice(0, 300))

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
