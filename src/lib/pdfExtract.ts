// @ts-nocheck
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export async function extractTextFromUrl(url: string): Promise<string> {
  const resp   = await fetch(url)
  const buffer = await resp.arrayBuffer()
  return extractTextFromBuffer(buffer)
}

export async function extractTextFromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  return extractTextFromBuffer(buffer)
}

async function extractTextFromBuffer(buffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  let fullText = ''

  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()

    const lines: { y: number; items: any[] }[] = []
    for (const item of content.items as any[]) {
      if (!item.str?.trim()) continue
      const y = item.transform[5]
      let line = lines.find(l => Math.abs(l.y - y) <= 3)   // tolerancia de 3 px
      if (!line) { line = { y, items: [] }; lines.push(line) }
      line.items.push(item)
    }

    lines.sort((a, b) => b.y - a.y)                          // arriba -> abajo
    for (const l of lines) {
      l.items.sort((a, b) => a.transform[4] - b.transform[4]) // izquierda -> derecha
      const text = l.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim()
      if (text) fullText += text + '\n'
    }
    fullText += '\n'
  }

  await pdf.destroy()
  return fullText.trim()
}

export async function extractPdfPages(file: File, maxPages = 30): Promise<{ page: number; blob: Blob }[]> {
  const buffer = await file.arrayBuffer()
  const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise
  const total  = Math.min(pdf.numPages, maxPages)
  const result = []
  for (let i = 1; i <= total; i++) {
    try {
      const page     = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 1.0 })
      const canvas   = document.createElement('canvas')
      canvas.width   = viewport.width
      canvas.height  = viewport.height
      const ctx      = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport }).promise
      const blob = await new Promise<Blob>(resolve =>
        canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.65)
      )
      result.push({ page: i, blob })
    } catch (e) {
      console.warn(`Error página ${i}:`, e)
    }
  }
  return result
}