// @ts-nocheck
import * as pdfjsLib from 'pdfjs-dist'

// Worker hosteado en el mismo dominio — funciona en dev y producción sin CSP issues
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

/**
 * Extrae el texto completo de un PDF desde una URL pública.
 */
export async function extractTextFromUrl(url: string): Promise<string> {
  const response = await fetch(url)
  const buffer   = await response.arrayBuffer()
  const pdf      = await pdfjsLib.getDocument({ data: buffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((item: any) => item.str).join(' ')
    text += `\n[Página ${i}]\n${pageText}`
  }
  return text.trim()
}

/**
 * Renderiza cada página del PDF como imagen JPEG.
 */
export async function extractPdfPages(file: File, maxPages = 30): Promise<{ page: number; blob: Blob }[]> {
  const buffer = await file.arrayBuffer()
  const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise
  const total  = Math.min(pdf.numPages, maxPages)
  const result = []

  for (let i = 1; i <= total; i++) {
    try {
      const page     = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas   = document.createElement('canvas')
      canvas.width   = viewport.width
      canvas.height  = viewport.height
      const ctx      = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport }).promise
      const blob = await new Promise(resolve =>
        canvas.toBlob(b => resolve(b), 'image/jpeg', 0.82)
      )
      result.push({ page: i, blob })
    } catch (e) {
      console.warn(`Error página ${i}:`, e)
    }
  }
  return result
}
