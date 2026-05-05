// @ts-nocheck
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

export async function extractPdfPages(file: File, maxPages = 20): Promise<{ page: number; blob: Blob }[]> {
  const buffer = await file.arrayBuffer()
  const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise
  const total  = Math.min(pdf.numPages, maxPages)
  const result: { page: number; blob: Blob }[] = []

  for (let i = 1; i <= total; i++) {
    const page     = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas   = document.createElement('canvas')
    canvas.width   = viewport.width
    canvas.height  = viewport.height
    const ctx      = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
    const blob = await new Promise<Blob>(resolve =>
      canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.85)
    )
    result.push({ page: i, blob })
  }

  return result
}
