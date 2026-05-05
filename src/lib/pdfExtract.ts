// @ts-nocheck

let pdfjsLib: any = null

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib
  pdfjsLib = await import('pdfjs-dist')
  // Use worker from same origin
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  return pdfjsLib
}

/**
 * Extrae texto del PDF. Funciona para PDFs con texto seleccionable.
 */
export async function extractTextFromUrl(url: string): Promise<string> {
  const lib    = await getPdfJs()
  const resp   = await fetch(url)
  const buffer = await resp.arrayBuffer()
  const pdf    = await lib.getDocument({ data: buffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += `\n[Página ${i}]\n` + content.items.map((x: any) => x.str).join(' ')
  }
  return text.trim()
}

/**
 * Renderiza páginas del PDF como JPEG base64.
 * Funciona para PDFs escaneados (imágenes).
 */
export async function renderPdfPagesToBase64(url: string, maxPages = 10): Promise<string[]> {
  const lib    = await getPdfJs()
  const resp   = await fetch(url)
  const buffer = await resp.arrayBuffer()
  const pdf    = await lib.getDocument({ data: buffer }).promise
  const total  = Math.min(pdf.numPages, maxPages)
  const result: string[] = []

  for (let i = 1; i <= total; i++) {
    try {
      const page     = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 1.2 })
      const canvas   = document.createElement('canvas')
      canvas.width   = viewport.width
      canvas.height  = viewport.height
      const ctx      = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport }).promise
      // Convert to base64 JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', 0.80)
      const b64 = dataUrl.split(',')[1]
      result.push(b64)
    } catch (e) {
      console.warn(`Error página ${i}:`, e)
    }
  }
  return result
}

/**
 * Renderiza páginas de un File PDF como blobs para subir a Storage.
 */
export async function extractPdfPages(file: File, maxPages = 30): Promise<{ page: number; blob: Blob }[]> {
  const lib    = await getPdfJs()
  const buffer = await file.arrayBuffer()
  const pdf    = await lib.getDocument({ data: buffer }).promise
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
      const blob = await new Promise<Blob>(resolve =>
        canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.82)
      )
      result.push({ page: i, blob })
    } catch (e) {
      console.warn(`Error página ${i}:`, e)
    }
  }
  return result
}
