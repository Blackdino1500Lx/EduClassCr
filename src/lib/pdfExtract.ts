import * as pdfjsLib from 'pdfjs-dist'

// Usar el worker bundleado directamente con Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

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
