/**
 * Parse questions from MEP exam PDF text.
 * Extracts numbered questions with A/B/C/D options.
 * Zero AI cost — pure regex.
 */

export interface ParsedQuestion {
  num:     number
  text:    string
  options: string[]
}

const SKIP_PATTERNS = [
  /^Práctica de Matemáticas/,
  /^Matemáticas (Sétimo|Octavo|Noveno|Bachillerato)/,
  /^SELECCIÓN ÚNICA/,
  /^\d+ ÍTEMS$/,
  /^Recomendaciones/,
  /^ÍTEMS$/,
  /^Tercer Ciclo/,
  /^General Básica/,
  /^Convenio MEP/,
]

export function parseQuestionsFromText(rawText: string): ParsedQuestion[] {
  // Split into lines, strip empty
  const allLines = rawText.split('\n').map(l => l.trim()).filter(Boolean)

  // Remove lines matching skip patterns
  const lines = allLines.filter(l => !SKIP_PATTERNS.some(p => p.test(l)))

  const questions: ParsedQuestion[] = []
  let current: ParsedQuestion | null = null
  let inOptions = false

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Match question: "10)" or "10) texto"
    const qMatch = line.match(/^(\d+)\)\s*(.*)/)
    if (qMatch && !/^[A-D]\)/.test(line)) {
      if (current && current.options.length >= 3) questions.push(current)
      current  = { num: parseInt(qMatch[1]), text: qMatch[2].trim(), options: [] }
      inOptions = false
      i++
      continue
    }

    if (!current) { i++; continue }

    // Match option: "A)" or "A) texto"
    const optMatch = line.match(/^([A-D])\)\s*(.*)/)
    if (optMatch) {
      inOptions = true
      const val: string[] = optMatch[2] ? [optMatch[2]] : []
      let j = i + 1
      while (j < lines.length && !/^[A-D]\)|^\d+\)/.test(lines[j])) {
        val.push(lines[j])
        j++
      }
      current.options.push(val.join(' ').trim())
      i = j
      continue
    }

    // Accumulate question text
    if (!inOptions) {
      current.text += (current.text ? ' ' : '') + line
    }

    i++
  }

  if (current && current.options.length >= 3) questions.push(current)

  return questions
}
