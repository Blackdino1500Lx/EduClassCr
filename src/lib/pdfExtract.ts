// @ts-nocheck
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Tell pdfjs to use the worker from public folder
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export async function extractTextFromUrl(url: string): Promise<string> {
  const resp   = await fetch(url)
  const buffer = await resp.arrayBuffer()
  const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += `\n[Página ${i}]\n` + content.items.map((x: any) => x.str).join(' ')
  }
  return text.trim()
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
