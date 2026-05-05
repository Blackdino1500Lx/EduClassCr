// @ts-nocheck
import * as pdfjsLib from 'pdfjs-dist'

// Usar CDN worker que funciona tanto en dev como en producción
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`

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
      console.warn(`Error en página ${i}:`, e)
    }
  }

  return result
}
