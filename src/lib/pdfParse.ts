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
  /^ÍTEMS$/,
  /^MINISTERIO/,
  /^DIRECCIÓN/,
  /^DEPARTAMENTO/,
  /^Recomendaciones/,
  /^Tercer Ciclo/,
  /^General Básica/,
  /^Convenio MEP/,
  /^Programa III/,
]

export function parseQuestionsFromText(rawText: string): ParsedQuestion[] {
  const allLines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  const lines    = allLines.filter(l => !SKIP_PATTERNS.some(p => p.test(l)))

  const questions: ParsedQuestion[] = []
  let current: ParsedQuestion | null = null
  let inOptions = false

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Question: "10)" or "10) texto" — NOT "A)" options
    const qMatch = /^(\d+)\)\s*(.*)/.exec(line)
    if (qMatch && !/^[A-D]\)/.test(line)) {
      if (current && current.options.length >= 3) questions.push(current)
      current   = { num: parseInt(qMatch[1]), text: qMatch[2].trim(), options: [] }
      inOptions = false
      i++
      continue
    }

    if (!current) { i++; continue }

    // Option: "A)" or "A) texto"
    const optMatch = /^([A-D])\)\s*(.*)/.exec(line)
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

    if (!inOptions) {
      current.text += (current.text ? ' ' : '') + line
    }
    i++
  }

  if (current && current.options.length >= 3) questions.push(current)
  return questions
}