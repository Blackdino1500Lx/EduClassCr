import { useState } from 'react'
import type { Lesson, Student, Question } from '../lib/data'
import { db, qImages } from '../lib/data'
import { extractTextFromUrl } from '../lib/pdfExtract'
import { X, Sparkles, Loader2, AlertTriangle, Check, Trash2, Plus, Edit3, Image } from 'lucide-react'

interface Props {
  lesson: Lesson; students: Student[]
  onClose: () => void; onSaved: () => void
}
type Step = 'extracting' | 'generating' | 'review' | 'saving' | 'done' | 'error'
const uid = () => Math.random().toString(36).slice(2, 10)

export default function CreatePracticeModal({ lesson, students, onClose, onSaved }: Props) {
  const [step, setStep]               = useState<Step>('extracting')
  const [progress, setProgress]       = useState('')
  const [questions, setQuestions]     = useState<Question[]>([])
  const [editingQ, setEditingQ]       = useState<string | null>(null)
  const [error, setError]             = useState('')
  const [title, setTitle]             = useState(`Práctica · ${lesson.title}`)
  const [description, setDescription] = useState(`Basada en: ${lesson.fileName ?? lesson.title}`)
  const [dueDate, setDueDate]         = useState('')
  const [assignedTo, setAssignedTo]   = useState<string[]>([])
  const [uploadingImg, setUploadingImg] = useState<string | null>(null)


  useState(() => { startProcess() })

  async function startProcess() {
    setStep('extracting'); setError('')
    try {
      let pdfText = ''
      if (lesson.fileUrl) {
        setProgress('Extrayendo texto del PDF...')
        try {
          pdfText = await extractTextFromUrl(lesson.fileUrl)
          console.log('Texto extraído:', pdfText.length, 'caracteres')
        } catch (e) {
          console.warn('Error extrayendo texto:', e)
        }
      }

      if (!pdfText || pdfText.trim().length < 50) {
        throw new Error('No se pudo extraer texto del PDF. Asegurate de que el PDF tenga texto seleccionable (no sea una imagen escaneada).')
      }

      setStep('generating')
      setProgress('Claude está analizando el examen...')

      const response = await fetch('/.netlify/functions/generate-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject:  lesson.subject,
          title:    lesson.title,
          fileName: lesson.fileName,
          pdfText:  pdfText.slice(0, 6000),
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `Error ${response.status}` }))
        throw new Error(err.error ?? `Error del servidor: ${response.status}`)
      }

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      const raw = data.content?.[0]?.text ?? ''
      if (!raw) throw new Error('La IA no devolvió contenido.')

      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error(`Formato inesperado: ${raw.slice(0, 200)}`)

      const parsed = JSON.parse(jsonMatch[0])
      // Build exam key from lesson title/filename to find matching images
      // e.g. "Examenes de Mep 7/2023.pdf" → "examenes_de_mep_7_2023"
      const baseFolder = lesson.title.replace(/·.*/, '').trim().replace(/\s+/g, '_')
      const year = (lesson.fileName ?? '').replace('.pdf', '').replace(/\s/g, '_')
      const examKey = qImages.buildExamKey(`${baseFolder}_${year}`)
      console.log('Looking for images with examKey:', examKey)
      let imgs: Awaited<ReturnType<typeof qImages.forExam>> = []
      try {
        imgs = await qImages.forExam(examKey)
        console.log('Found', imgs.length, 'image mappings for', examKey)

      } catch (e) {
        console.warn('No images found for this exam:', e)
      }

      const parsedQs: Question[] = parsed.map((q: any, idx: number) => {
        // Try to get question number from text "1)" "1." etc, fallback to index
        const textMatch = String(q.text ?? '').match(/^\s*(\d+)[.)\s]/)
        const questionNum = textMatch ? parseInt(textMatch[1]) : idx + 1
        const img = qImages.findForQuestion(imgs, questionNum)
        return {
          id:            uid(),
          text:          String(q.text ?? ''),
          type:          q.type === 'open' ? 'open' : 'multiple',
          options:       q.options ?? (q.type !== 'open' ? ['', '', '', ''] : undefined),
          correctOption: typeof q.correctOption === 'number' ? q.correctOption : 0,
          points:        Number(q.points) || 5,
          imageUrl:      img?.imageUrl,
        }
      })
      setQuestions(parsedQs)
      setStep('review')
    } catch (e: any) {
      setError(e.message ?? 'Error procesando el PDF')
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
      id: uid(), text: '', points: 5,
      type: isMath ? 'open' : 'multiple',
      options: isMath ? undefined : ['', '', '', ''],
      correctOption: 0,
    }])
  }

  // Upload image for a specific question
  const handleImageUpload = async (qId: string, file: File) => {
    setUploadingImg(qId)
    try {
      const { url } = await db.storage.uploadFile(file)
      updateQ(qId, { imageUrl: url })
    } catch (e) {
      alert('Error subiendo la imagen. Intentá de nuevo.')
    } finally {
      setUploadingImg(null)
    }
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

  const totalPoints = questions.reduce((a, q) => a + (Number(q.points) || 0), 0)
  const hasGraphics  = questions.some(q => q.text.includes('[Ver figura'))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card modal-large">
        <div className="modal-header">
          <div>
            <h3>Crear práctica con IA</h3>
            <p className="modal-subtitle" style={{padding:0,marginTop:4}}>{lesson.title}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>

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
            <div className="form-actions">
              <button className="btn-outline" onClick={onClose}>Cerrar</button>
              <button className="btn-primary" onClick={startProcess}>Reintentar</button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="modal-loading">
            <Check size={48} style={{color:'var(--success)'}}/>
            <p style={{fontWeight:600,fontSize:16}}>¡Práctica creada!</p>
          </div>
        )}

        {step === 'saving' && (
          <div className="modal-loading"><Loader2 size={32} className="spin"/><p>Guardando...</p></div>
        )}

        {step === 'review' && (
          <>
            <div className="modal-body">
              {/* Metadata */}
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

              {/* Assign */}
              <div className="field full" style={{marginBottom:20}}>
                <label>Asignar a alumnos</label>
                <div className="assign-grid">
                  {students.length === 0
                    ? <span className="hint-text">Registrá alumnos primero.</span>
                    : students.map(s => (
                      <label key={s.id} className={`assign-chip ${assignedTo.includes(s.id)?'selected':''}`}>
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

              {/* Graphics notice */}
              {hasGraphics && (
                <div className="math-graphics-notice">
                  <Image size={15}/>
                  <span>Algunas preguntas tienen <strong>[Ver figura]</strong> — podés subir la imagen correspondiente con el botón 🖼️ en cada pregunta.</span>
                </div>
              )}

              {/* AI banner */}
              <div className="ai-generated-banner">
                <Sparkles size={14}/>
                <span>IA extrajo <strong>{questions.length} preguntas</strong> · {totalPoints} pts totales. Revisá y editá antes de guardar.</span>
                <button className="btn-outline sm" onClick={addQ}><Plus size={12}/> Agregar</button>
              </div>

              {/* Questions */}
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
                        {/* Image upload button */}
                        <label className={`icon-btn ${q.imageUrl?'active-img-btn':''}`} title="Adjuntar imagen" style={{cursor:'pointer'}}>
                          {uploadingImg === q.id
                            ? <Loader2 size={14} className="spin"/>
                            : <Image size={14}/>
                          }
                          <input type="file" accept="image/*" style={{display:'none'}}
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(q.id, f) }}/>
                        </label>
                        <button className="icon-btn" onClick={() => setEditingQ(editingQ===q.id?null:q.id)}><Edit3 size={14}/></button>
                        <button className="icon-btn danger sm" onClick={() => removeQ(q.id)}><Trash2 size={14}/></button>
                      </div>
                    </div>

                    {/* Image preview */}
                    {q.imageUrl && (
                      <div className="q-image-preview">
                        <img src={q.imageUrl} alt="Figura adjunta"/>
                        <button className="remove-img-btn" onClick={() => updateQ(q.id,{imageUrl:undefined})}>
                          <X size={12}/> Quitar
                        </button>
                      </div>
                    )}

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
                                {opt||<em style={{color:'var(--muted)'}}>Vacía</em>}
                                {oi===q.correctOption && <span style={{marginLeft:'auto',fontSize:11,color:'var(--success)'}}>✓</span>}
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
