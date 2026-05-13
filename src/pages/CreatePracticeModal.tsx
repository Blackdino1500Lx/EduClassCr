import { useState } from 'react'
import type { Lesson, Student, Question } from '../lib/data'
import { db, qImages } from '../lib/data'
import { extractTextFromUrl } from '../lib/pdfExtract'
import { parseQuestionsFromText } from '../lib/pdfParse'
import { X, Loader2, AlertTriangle, Check, Trash2, Plus, Edit3, Image } from 'lucide-react'

interface Props {
  lesson: Lesson; students: Student[]
  onClose: () => void; onSaved: () => void
}
type Step = 'extracting' | 'review' | 'saving' | 'done' | 'error'
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
      // Step 1: Extract text from PDF
      setProgress('Extrayendo texto del PDF...')
      let pdfText = ''
      if (lesson.fileUrl) {
       pdfText = await extractTextFromUrl(lesson.fileUrl)
console.log('Texto extraído:', pdfText.length, 'chars')
console.log('Primeras líneas:', pdfText.slice(0, 500))
      }
      if (!pdfText || pdfText.trim().length < 100) {
        throw new Error('No se pudo extraer texto del PDF.')
      }

      // Step 2: Parse questions with regex (ZERO AI cost, instant)
      setProgress('Parseando preguntas...')
      const parsed = parseQuestionsFromText(pdfText)
      if (parsed.length === 0) {
        throw new Error('No se encontraron preguntas en el PDF.')
      }

      // Step 3: Load matching images from question_images table
      setProgress('Buscando imágenes...')
      const examKey = lesson.examKey ?? qImages.buildExamKey(
        (lesson.fileName ?? lesson.title).replace(/\.pdf$/i, '')
      )
      let imgs: Awaited<ReturnType<typeof qImages.forExam>> = []
      try {
        imgs = await qImages.forExam(examKey)
        console.log(`Found ${imgs.length} images for examKey: ${examKey}`)
      } catch (_e) {
        console.warn('No images found')
      }

      // Step 4: Build Question objects with auto-attached images
      const isMath = lesson.subject === 'Matemáticas'
      const qs: Question[] = parsed.map(p => {
        const img = qImages.findForQuestion(imgs, p.num)
        return {
          id:            uid(),
          text:          p.text,
          type:          (isMath && p.options.length === 0) ? 'open' : 'multiple',
          options:       p.options.length >= 3 ? p.options.slice(0, 4) : ['', '', '', ''],
          correctOption: 0,
          points:        isMath ? 10 : 5,
          imageUrl:      img?.imageUrl,
        }
      })

      setQuestions(qs)
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

  const handleImageUpload = async (qId: string, file: File) => {
    setUploadingImg(qId)
    try {
      const { url } = await db.storage.uploadFile(file)
      updateQ(qId, { imageUrl: url })
    } catch (_e) { alert('Error subiendo imagen') }
    finally { setUploadingImg(null) }
  }

  const save = async () => {
    if (!title.trim())           { alert('El título es requerido'); return }
    if (questions.length === 0)  { alert('Necesitás al menos una pregunta'); return }
    if (assignedTo.length === 0) { alert('Asigná a al menos un alumno'); return }
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
  const withImages  = questions.filter(q => q.imageUrl).length

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card modal-large">
        <div className="modal-header">
          <div>
            <h3>Crear práctica</h3>
            <p className="modal-subtitle" style={{padding:0,marginTop:4}}>{lesson.title}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>

        {step === 'extracting' && (
          <div className="modal-loading">
            <Loader2 size={32} className="spin"/>
            <p className="ai-progress-text">{progress}</p>
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

              {/* Summary banner */}
              <div className="ai-generated-banner">
                <Check size={14} style={{color:'var(--success)'}}/>
                <span>
                  <strong>{questions.length} preguntas</strong> extraídas · {totalPoints} pts
                  {withImages > 0 && <> · <strong>{withImages}</strong> con imagen adjunta 🖼️</>}
                </span>
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
                        <label className={`icon-btn ${q.imageUrl?'active-img-btn':''}`}
                          title="Adjuntar imagen" style={{cursor:'pointer'}}>
                          {uploadingImg===q.id ? <Loader2 size={14} className="spin"/> : <Image size={14}/>}
                          <input type="file" accept="image/*" style={{display:'none'}}
                            onChange={e => { const f=e.target.files?.[0]; if(f) handleImageUpload(q.id,f) }}/>
                        </label>
                        <button className="icon-btn" onClick={() => setEditingQ(editingQ===q.id?null:q.id)}><Edit3 size={14}/></button>
                        <button className="icon-btn danger sm" onClick={() => removeQ(q.id)}><Trash2 size={14}/></button>
                      </div>
                    </div>

                    {q.imageUrl && (
                      <div className="q-image-preview">
                        <img src={q.imageUrl} alt="Figura"/>
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
                                <input type="text" value={opt}
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
