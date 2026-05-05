import { useState } from 'react'
import type { Lesson, Student, Question } from '../lib/data'
import { db } from '../lib/data'
import { pdfUrlToBase64 } from '../lib/pdfExtract'
import { X, Sparkles, Loader2, AlertTriangle, Check, Trash2, Plus, Edit3 } from 'lucide-react'

interface Props {
  lesson: Lesson; students: Student[]
  onClose: () => void; onSaved: () => void
}

type Step = 'extracting' | 'generating' | 'review' | 'saving' | 'done' | 'error'

const uid = () => Math.random().toString(36).slice(2, 10)
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY as string

async function generateFromPdf(lesson: Lesson): Promise<Question[]> {
  const isMath = lesson.subject === 'Matemáticas'

  const systemPrompt = `Sos una tutora experta en ${lesson.subject}. Tu tarea es extraer o generar preguntas de práctica a partir del contenido de un examen del MEP de Costa Rica.
INSTRUCCIONES:
- Identificá preguntas numeradas en el documento y extraélas tal como están
- Para opción múltiple: extraé las opciones exactas e indicá cuál es la correcta (índice 0-3)
- Para desarrollo/matemáticas: usá type "open"
- Generá entre 5 y 10 preguntas
- ${isMath ? 'Preferí type "open" para desarrollo matemático' : 'Preferí type "multiple" con 4 opciones'}
- Respondé ÚNICAMENTE con un JSON array válido, sin markdown ni texto extra`

  const userContent: any[] = []

  // Si hay PDF, mandarlo como documento a Claude
  if (lesson.fileUrl) {
    try {
      const b64 = await pdfUrlToBase64(lesson.fileUrl)
      userContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: b64 }
      })
    } catch (_e) {
      // Si falla el PDF, usar texto de contexto
      console.warn('No se pudo cargar el PDF, usando contexto de texto')
    }
  }

  userContent.push({
    type: 'text',
    text: `Extraé las preguntas de práctica de este examen de ${lesson.subject} — ${lesson.title}.\n\nContexto adicional: ${lesson.content ?? ''}\n\nRespondé SOLO con el JSON array de preguntas.`
  })

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`API error ${response.status}: ${err}`)
  }

  const data  = await response.json()
  const raw   = data.content?.[0]?.text ?? '[]'
  const clean = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(clean).map((q: any) => ({ ...q, id: uid() }))
}

export default function CreatePracticeModal({ lesson, students, onClose, onSaved }: Props) {
  const [step, setStep]               = useState<Step>('extracting')
  const [progress, setProgress]       = useState('Leyendo el PDF...')
  const [questions, setQuestions]     = useState<Question[]>([])
  const [editingQ, setEditingQ]       = useState<string | null>(null)
  const [error, setError]             = useState('')
  const [title, setTitle]             = useState(`Práctica · ${lesson.title}`)
  const [description, setDescription] = useState(`Basada en: ${lesson.fileName ?? lesson.title}`)
  const [dueDate, setDueDate]         = useState('')
  const [assignedTo, setAssignedTo]   = useState<string[]>([])

  // Auto-start
  useState(() => { startGeneration() })

  async function startGeneration() {
    setStep('extracting'); setError('')
    setProgress(lesson.fileUrl ? 'Descargando PDF...' : 'Preparando contenido...')
    try {
      setStep('generating')
      setProgress('Claude está leyendo el examen y extrayendo preguntas...')
      const qs = await generateFromPdf(lesson)
      setQuestions(qs)
      setStep('review')
    } catch (e: any) {
      setError(e.message ?? 'Error procesando')
      setStep('error')
    }
  }

  const updateQ = (id: string, patch: Partial<Question>) =>
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q))
  const removeQ = (id: string) =>
    setQuestions(prev => prev.filter(q => q.id !== id))
  const addQ = () => {
    const isMath = lesson.subject === 'Matemáticas'
    setQuestions(prev => [...prev, {
      id: uid(), text: '', points: 10,
      type: isMath ? 'open' : 'multiple',
      options: isMath ? undefined : ['', '', '', ''],
      correctOption: 0,
    }])
  }

  const save = async () => {
    if (!title.trim())           { alert('El título es requerido'); return }
    if (questions.length === 0)  { alert('Necesitás al menos una pregunta'); return }
    if (assignedTo.length === 0) { alert('Asigná la práctica a al menos un alumno'); return }
    if (questions.some(q => !q.text.trim())) { alert('Completá el enunciado de todas las preguntas'); return }
    setStep('saving')
    try {
      await db.practices.add({
        title, subject: lesson.subject, description, questions,
        assignedTo, dueDate: dueDate || undefined,
        isActive: true, lessonId: lesson.id,
      })
      setStep('done')
      setTimeout(() => { onSaved(); onClose() }, 1200)
    } catch (e: any) {
      setError(e.message ?? 'Error guardando'); setStep('error')
    }
  }

  const totalPoints = questions.reduce((a, q) => a + q.points, 0)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card modal-large">
        <div className="modal-header">
          <div>
            <h3>Crear práctica con IA</h3>
            <p className="modal-subtitle" style={{padding:0, marginTop:4}}>{lesson.title}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>

        {/* States */}
        {(step === 'extracting' || step === 'generating') && (
          <div className="modal-loading">
            <div className="ai-spinner"><Sparkles size={32} className="sparkle-spin"/></div>
            <p className="ai-progress-text">{progress}</p>
            <div className="ai-progress-bar">
              <div className={`ai-progress-fill ${step === 'generating' ? 'fill-70' : 'fill-30'}`}/>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="modal-body">
            <div className="error-msg" style={{marginBottom:16}}>
              <AlertTriangle size={16}/> {error}
            </div>
            {!ANTHROPIC_KEY || ANTHROPIC_KEY === 'TU_API_KEY_AQUI' ? (
              <div className="hint-text" style={{marginBottom:16}}>
                ⚠️ Falta configurar <strong>VITE_ANTHROPIC_KEY</strong> en las variables de entorno de Netlify.
              </div>
            ) : null}
            <div className="form-actions">
              <button className="btn-outline" onClick={onClose}>Cerrar</button>
              <button className="btn-primary" onClick={startGeneration}>Reintentar</button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="modal-loading">
            <Check size={48} style={{color:'var(--success)'}}/>
            <p style={{fontWeight:600, fontSize:16}}>¡Práctica creada exitosamente!</p>
          </div>
        )}

        {step === 'saving' && (
          <div className="modal-loading">
            <Loader2 size={32} className="spin"/><p>Guardando práctica...</p>
          </div>
        )}

        {step === 'review' && (
          <>
            <div className="modal-body">
              <div className="create-practice-meta">
                <div className="field full"><label>Título</label>
                  <input value={title} onChange={e => setTitle(e.target.value)}/>
                </div>
                <div className="field full"><label>Descripción</label>
                  <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}/>
                </div>
                <div className="field"><label>Fecha límite (opcional)</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/>
                </div>
              </div>

              <div className="field full" style={{marginBottom:20}}>
                <label>Asignar a alumnos</label>
                <div className="assign-grid">
                  {students.length === 0
                    ? <span className="hint-text">Registrá alumnos primero.</span>
                    : students.map(s => (
                      <label key={s.id} className={`assign-chip ${assignedTo.includes(s.id) ? 'selected' : ''}`}>
                        <input type="checkbox" checked={assignedTo.includes(s.id)}
                          onChange={e => setAssignedTo(prev =>
                            e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id)
                          )}/>
                        {s.firstName} {s.lastName}
                      </label>
                    ))
                  }
                </div>
              </div>

              <div className="ai-generated-banner">
                <Sparkles size={14}/>
                <span>IA generó <strong>{questions.length} preguntas</strong> · {totalPoints} pts totales. Revisá y editá antes de guardar.</span>
                <button className="btn-outline sm" onClick={addQ}><Plus size={12}/> Agregar</button>
              </div>

              <div className="questions-list" style={{marginTop:12}}>
                {questions.map((q, idx) => (
                  <div className="question-card" key={q.id}>
                    <div className="q-header">
                      <span className="q-num">P{idx+1} · {q.type==='open'?'Desarrollo':'Opción múltiple'}</span>
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <div className="field-inline"><label>Pts</label>
                          <input type="number" min={1} max={100} value={q.points} style={{width:56}}
                            onChange={e => updateQ(q.id,{points:+e.target.value})}/>
                        </div>
                        <button className="icon-btn" onClick={() => setEditingQ(editingQ===q.id?null:q.id)}><Edit3 size={14}/></button>
                        <button className="icon-btn danger sm" onClick={() => removeQ(q.id)}><Trash2 size={14}/></button>
                      </div>
                    </div>

                    {editingQ === q.id ? (
                      <>
                        <textarea rows={3} className="q-input" value={q.text}
                          onChange={e => updateQ(q.id,{text:e.target.value})} placeholder="Enunciado"/>
                        {q.type==='multiple' && q.options && (
                          <div className="options-builder">
                            {q.options.map((opt,oi) => (
                              <div key={oi} className="opt-row">
                                <input type="radio" name={`correct-${q.id}`} checked={q.correctOption===oi}
                                  onChange={() => updateQ(q.id,{correctOption:oi})}/>
                                <span className="opt-letter">{String.fromCharCode(65+oi)}</span>
                                <input type="text" value={opt} placeholder={`Opción ${String.fromCharCode(65+oi)}`}
                                  onChange={e => { const opts=[...(q.options??[])]; opts[oi]=e.target.value; updateQ(q.id,{options:opts}) }}/>
                              </div>
                            ))}
                            <p className="hint-text">Círculo = respuesta correcta</p>
                          </div>
                        )}
                        <button className="btn-outline sm" style={{marginTop:8}} onClick={() => setEditingQ(null)}>
                          <Check size={12}/> Listo
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="q-text">{q.text || <em style={{color:'var(--muted)'}}>Sin enunciado</em>}</p>
                        {q.type==='multiple' && q.options && (
                          <div className="options-list" style={{pointerEvents:'none'}}>
                            {q.options.map((opt,oi) => (
                              <div key={oi} className={`option-label ${oi===q.correctOption?'selected':''}`}>
                                <span className="opt-letter">{String.fromCharCode(65+oi)}</span>
                                {opt||<em>Vacía</em>}
                                {oi===q.correctOption && <span style={{marginLeft:'auto',fontSize:11,color:'var(--success)'}}>✓ correcta</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-outline" onClick={onClose}>Cancelar</button>
              <button className="btn-primary" onClick={save}>
                <Check size={15}/> Guardar práctica ({questions.length} preguntas · {totalPoints} pts)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
