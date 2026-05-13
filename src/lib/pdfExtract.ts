// @ts-nocheck
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export async function extractTextFromUrl(url: string): Promise<string> {
  const resp   = await fetch(url)
  const buffer = await resp.arrayBuffer()
  const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise
  
  let fullText = ''
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    
    // Group items by line using y-coordinate
    // Items with same y (within 2px) are on the same line
    const lineMap = new Map<number, string[]>()
    
    for (const item of content.items as any[]) {
      if (!item.str?.trim()) continue
      const y = Math.round(item.transform[5])
      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y)!.push(item.str)
    }
    
    // Sort lines by y descending (top to bottom on page)
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)
    
    for (const y of sortedYs) {
      const lineText = lineMap.get(y)!.join(' ').trim()
      if (lineText) fullText += lineText + '\n'
    }
    
    fullText += '\n'
  }
  
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
