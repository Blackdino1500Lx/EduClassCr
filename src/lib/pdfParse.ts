export interface ParsedQuestion {
  num:     number
  text:    string
  options: string[]
}

const SKIP_PATTERNS = [
  /^Práctica de Matemáticas/,
  /^Matemáticas (Sétimo|Octavo|Noveno|Bachillerato)/,
  /^Matemática Bachillerato/,
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
  /^Convocatoria/,
  /^BxM$/,
  /^_{5,}/,
  /^\d+$/,
]

export function parseQuestionsFromText(rawText: string): ParsedQuestion[] {
  // Normalize lines: collapse runs of spaces, and fix "1 )" / "A )" produced
  // when pdfjs returns the number/letter and the bracket as separate items
  // that get joined with a space.
  const allLines = rawText
    .split('\n')
    .map(l => l.trim().replace(/^(\d+)\s+([.)]) */,  '$1$2 ')   // "1 ) texto" → "1) texto"
                       .replace(/^([A-D])\s+([.)]) */,  '$1$2 ')) // "A ) texto" → "A) texto"
    .filter(Boolean)
  const lines = allLines.filter(l => !SKIP_PATTERNS.some(p => p.test(l)))

  const questions: ParsedQuestion[] = []
  let current: ParsedQuestion | null = null
  let inOptions = false

  // Returns true if a line looks like the start of a new question
  const isQuestionLine = (l: string) => {
    const qParen = /^(\d+)\)\s*(.*)/.exec(l)
    const qDot   = /^(\d+)\.\s+(.+)/.exec(l)
    if (qParen && !/^[A-D]\)/.test(l)) return true
    if (qDot   && !/^[A-D]\./.test(l) && parseInt(qDot[1]) <= 100) return true
    return false
  }

  // Returns true if a line looks like an option label (A) B) C) D) or A. B. C. D.)
  const isOptionLine = (l: string) => /^[A-D][.)]\s*/.test(l)

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Detect question header
    const qParen = /^(\d+)\)\s*(.*)/.exec(line)
    const qDot   = /^(\d+)\.\s+(.+)/.exec(line)
    const isQParen = qParen && !/^[A-D]\)/.test(line)
    const isQDot   = qDot   && !/^[A-D]\./.test(line) && parseInt(qDot[1]) <= 100
    const qMatch   = isQParen ? qParen : isQDot ? qDot : null

    if (qMatch) {
      if (current && (current.options.length === 0 || current.options.length >= 3)) questions.push(current)
      current   = { num: parseInt(qMatch[1]), text: qMatch[2].trim(), options: [] }
      inOptions = false
      i++
      continue
    }

    if (!current) { i++; continue }

    // Detect option label
    const optMatch = /^([A-D])[.)]\s*(.*)/.exec(line)
    if (optMatch) {
      inOptions = true
      const val: string[] = optMatch[2] ? [optMatch[2]] : []
      let j = i + 1
      // Stop at next option label OR next question header
      while (j < lines.length && !isOptionLine(lines[j]) && !isQuestionLine(lines[j])) {
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

  if (current && (current.options.length === 0 || current.options.length >= 3)) questions.push(current)
  return questions
}
