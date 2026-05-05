/**
 * Convierte una URL pública de PDF a base64.
 * Usamos esto para pasárselo directamente a Claude como documento.
 */
export async function pdfUrlToBase64(url: string): Promise<string> {
  // Supabase Storage necesita el proxy para evitar CORS en algunos casos.
  // Si falla, retornamos null y Claude usará solo el título/contexto.
  const response = await fetch(url, { mode: 'cors' })
  if (!response.ok) throw new Error(`No se pudo descargar el PDF: ${response.status}`)
  const buffer = await response.arrayBuffer()
  const bytes  = new Uint8Array(buffer)
  let binary   = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
