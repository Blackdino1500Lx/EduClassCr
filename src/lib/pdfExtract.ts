import * as pdfjsLib from 'pdfjs-dist'

// Worker necesario para pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

/**
 * Descarga un PDF desde una URL pública y extrae su texto completo.
 * Retorna el texto de todas las páginas concatenado.
 */
export async function extractTextFromPdfUrl(url: string): Promise<string> {
  const response = await fetch(url)
  const buffer   = await response.arrayBuffer()
  const pdf      = await pdfjsLib.getDocument({ data: buffer }).promise

  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ')
    fullText += `\n--- Página ${i} ---\n${pageText}`
  }

  return fullText.trim()
}
