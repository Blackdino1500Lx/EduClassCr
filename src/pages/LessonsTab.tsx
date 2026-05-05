import { useState } from 'react'
import type { Lesson, Student, Subject } from '../lib/data'
import { db } from '../lib/data'
import { Plus, Trash2, AlertTriangle, Loader2, FileText, BookOpen, Eye, EyeOff, Upload, Sparkles } from 'lucide-react'

const SUBJECTS: Subject[] = ['Matemáticas', 'Español', 'Ciencias', 'Estudios Sociales', 'Inglés']

interface Props { lessons: Lesson[]; students: Student[]; reload: () => void }

// ── Extract YouTube embed ID ──────────────────────────────────────
function ytEmbed(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

// ── AI question generator via Claude API ─────────────────────────
async function generateQuestionsFromText(text: string, subject: Subject): Promise<any[]> {
  const isMath = subject === 'Matemáticas'
  const prompt = `Sos una tutora experta. Basándote en el siguiente texto educativo, generá 5 preguntas de práctica en español para estudiantes.

MATERIA: ${subject}
TEXTO:
${text.slice(0, 6000)}

INSTRUCCIONES:
- ${isMath ? 'Generá preguntas de DESARROLLO ABIERTO (type: "open") ya que es Matemáticas' : 'Generá preguntas de OPCIÓN MÚLTIPLE (type: "multiple") con 4 opciones cada una'}
- Las preguntas deben ser claras y apropiadas para el nivel escolar
- Respondé SOLO con un JSON array, sin texto adicional, sin markdown

FORMATO EXACTO (array JSON):
[
  {
    "id": "q1",
    "text": "enunciado de la pregunta",
    "type": "${isMath ? 'open' : 'multiple'}",
    ${!isMath ? '"options": ["opción A", "opción B", "opción C", "opción D"],\n    "correctOption": 0,' : ''}
    "points": 10
  }
]`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await response.json()
  const raw  = data.content?.[0]?.text ?? '[]'
  const clean = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

export default function LessonsTab({ lessons, students, reload }: Props) {
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedQs, setGeneratedQs] = useState<any[]>([])
  const [fileText, setFileText]   = useState('')

  const [form, setForm] = useState({
    title: '', subject: SUBJECTS[0] as Subject,
    content: '', youtubeUrl: '',
    fileUrl: '', fileName: '',
    assignedTo: [] as string[], isActive: true,
  })

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setErr('')
    try {
      const { url, name } = await db.storage.uploadFile(file)
      setForm(f => ({ ...f, fileUrl: url, fileName: name }))
      // Also extract text for AI (only for text-based files)
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const text = await file.text()
        setFileText(text)
      } else {
        // For PDFs we can't read client-side easily; use filename as hint
        setFileText(`Documento: ${name}`)
      }
    } catch (_e) { setErr('Error subiendo el archivo. Intentá de nuevo.') }
    finally { setUploading(false) }
  }

  const handleGenerateQuestions = async () => {
    const sourceText = fileText || form.content
    if (!sourceText.trim()) { setErr('Necesitás subir un documento o escribir contenido primero para generar preguntas.'); return }
    setGenerating(true); setErr('')
    try {
      const qs = await generateQuestionsFromText(sourceText, form.subject)
      setGeneratedQs(qs)
    } catch (_e) { setErr('Error generando preguntas con IA. Intentá de nuevo.') }
    finally { setGenerating(false) }
  }

  const save = async () => {
    if (!form.title.trim())           { setErr('El título es requerido'); return }
    if (form.assignedTo.length === 0) { setErr('Asigná a al menos un alumno'); return }
    if (!form.content && !form.fileUrl && !form.youtubeUrl) { setErr('Agregá contenido: texto, documento o video'); return }
    setSaving(true); setErr('')
    try {
      await db.lessons.add({ ...form })
      await reload()
      setShowForm(false)
      setForm({ title: '', subject: SUBJECTS[0], content: '', youtubeUrl: '', fileUrl: '', fileName: '', assignedTo: [], isActive: true })
      setGeneratedQs([]); setFileText('')
    } catch (e: any) { setErr(e.message ?? 'Error guardando lección') }
    finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar esta lección?')) return
    await db.lessons.delete(id); reload()
  }

  const toggleActive = async (l: Lesson) => {
    await db.lessons.update({ ...l, isActive: !l.isActive }); reload()
  }

  return (
    <div>
      <div className="section-topbar">
        <h2>Lecciones ({lessons.length})</h2>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}><Plus size={15}/> Nueva lección</button>
      </div>

      {showForm && (
        <div className="form-card">
          <h3>Crear lección</h3>
          <div className="form-grid">
            <div className="field"><label>Título</label>
              <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="Ej: Introducción a las fracciones"/>
            </div>
            <div className="field"><label>Materia</label>
              <select value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value as Subject, }))}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            {/* Contenido escrito */}
            <div className="field full">
              <label>Contenido / Explicación (texto)</label>
              <textarea rows={5} value={form.content}
                onChange={e => setForm(f => ({...f, content: e.target.value}))}
                placeholder="Escribí la explicación de la lección aquí. El alumno la verá antes de hacer la práctica..."/>
            </div>

            {/* Subir documento */}
            <div className="field full">
              <label>Documento (PDF, TXT)</label>
              <div className="upload-zone">
                {form.fileUrl ? (
                  <div className="upload-done">
                    <FileText size={18} className="text-teal"/>
                    <span>{form.fileName}</span>
                    <button className="btn-outline sm" onClick={() => setForm(f => ({...f, fileUrl:'', fileName:''}))}>Quitar</button>
                  </div>
                ) : (
                  <label className="upload-label">
                    {uploading ? <><Loader2 size={16} className="spin"/> Subiendo...</> : <><Upload size={16}/> Elegir archivo</>}
                    <input type="file" accept=".pdf,.txt,.doc,.docx" onChange={handleFileUpload} style={{display:'none'}} disabled={uploading}/>
                  </label>
                )}
              </div>
            </div>

            {/* YouTube */}
            <div className="field full">
              <label>Video de YouTube (URL)</label>
              <div className="input-icon-wrap">
                📺
                <input value={form.youtubeUrl}
                  onChange={e => setForm(f => ({...f, youtubeUrl: e.target.value}))}
                  placeholder="https://www.youtube.com/watch?v=..."/>
              </div>
              {form.youtubeUrl && ytEmbed(form.youtubeUrl) && (
                <div className="yt-preview">
                  <iframe width="100%" height="200"
                    src={`https://www.youtube.com/embed/${ytEmbed(form.youtubeUrl)}`}
                    allowFullScreen style={{borderRadius:8, border:'none'}}/>
                </div>
              )}
            </div>

            {/* Asignar alumnos */}
            <div className="field full"><label>Asignar a alumnos</label>
              <div className="assign-grid">
                {students.length === 0
                  ? <span className="hint-text">Registrá alumnos primero.</span>
                  : students.map(s => (
                    <label key={s.id} className={`assign-chip ${form.assignedTo.includes(s.id) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={form.assignedTo.includes(s.id)}
                        onChange={e => setForm(f => ({
                          ...f,
                          assignedTo: e.target.checked ? [...f.assignedTo, s.id] : f.assignedTo.filter(x => x !== s.id)
                        }))}/>
                      {s.firstName} {s.lastName}
                    </label>
                  ))
                }
              </div>
            </div>
          </div>

          {/* Generar preguntas con IA */}
          <div className="ai-gen-section">
            <div className="ai-gen-header">
              <Sparkles size={16} className="text-coral"/>
              <span>Generar preguntas con IA desde el contenido</span>
            </div>
            <button className="btn-outline" onClick={handleGenerateQuestions} disabled={generating}>
              {generating ? <><Loader2 size={14} className="spin"/> Generando...</> : <><Sparkles size={14}/> Generar preguntas</>}
            </button>
            {generatedQs.length > 0 && (
              <div className="gen-questions-preview">
                <p className="hint-text">✅ {generatedQs.length} preguntas generadas. Podés usarlas al crear la práctica asociada a esta lección.</p>
                {generatedQs.map((q, i) => (
                  <div key={i} className="gen-q-card">
                    <span className="q-num">P{i+1}</span>
                    <p>{q.text}</p>
                    {q.type === 'multiple' && q.options && (
                      <ul>{q.options.map((o: string, oi: number) => <li key={oi} className={oi === q.correctOption ? 'correct-opt' : ''}>{String.fromCharCode(65+oi)}. {o}</li>)}</ul>
                    )}
                  </div>
                ))}
                <p className="hint-text">💾 Estas preguntas se guardan al crear la lección. Al crear la práctica, seleccioná esta lección y las preguntas se pre-cargarán.</p>
              </div>
            )}
          </div>

          {err && <div className="error-msg"><AlertTriangle size={13}/> {err}</div>}
          <div className="form-actions">
            <button className="btn-outline" onClick={() => { setShowForm(false); setErr(''); setGeneratedQs([]) }}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <><Loader2 size={14} className="spin"/> Guardando...</> : 'Guardar lección'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de lecciones */}
      <div className="practice-list">
        {lessons.length === 0
          ? <div className="empty-state"><BookOpen size={36}/><p>No hay lecciones creadas aún.</p></div>
          : lessons.map(l => (
            <div className={`practice-card ${!l.isActive ? 'done' : ''}`} key={l.id}>
              <div className="pc-top">
                <span className={`subject-badge sb-${l.subject.split(' ')[0].toLowerCase()}`}>{l.subject}</span>
                <div style={{display:'flex', gap:8}}>
                  <button className="icon-btn" onClick={() => toggleActive(l)} title={l.isActive ? 'Desactivar' : 'Activar'}>
                    {l.isActive ? <Eye size={15}/> : <EyeOff size={15}/>}
                  </button>
                  <button className="icon-btn danger" onClick={() => remove(l.id)}><Trash2 size={14}/></button>
                </div>
              </div>
              <h3>{l.title}</h3>
              <div className="lesson-indicators">
                {l.content   && <span className="lesson-chip"><FileText size={11}/> Texto</span>}
                {l.fileUrl   && <span className="lesson-chip"><Upload size={11}/> {l.fileName}</span>}
                {l.youtubeUrl && <span className="lesson-chip">📺 Video</span>}
              </div>
              <div className="pc-meta">
                <span>{l.assignedTo.length} alumno{l.assignedTo.length !== 1 ? 's' : ''}</span>
                <span>{l.isActive ? '✅ Activa' : '⏸ Inactiva'}</span>
              </div>
              <button className="btn-outline sm" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                {expanded === l.id ? 'Ocultar' : 'Ver contenido'}
              </button>
              {expanded === l.id && (
                <div className="lesson-preview">
                  {l.content && <div className="lesson-text-preview"><p>{l.content}</p></div>}
                  {l.fileUrl && <a href={l.fileUrl} target="_blank" rel="noreferrer" className="btn-outline sm" style={{marginTop:8}}><FileText size={13}/> Abrir documento</a>}
                  {l.youtubeUrl && ytEmbed(l.youtubeUrl) && (
                    <div className="yt-preview" style={{marginTop:12}}>
                      <iframe width="100%" height="200" src={`https://www.youtube.com/embed/${ytEmbed(l.youtubeUrl)}`} allowFullScreen style={{borderRadius:8, border:'none'}}/>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        }
      </div>
    </div>
  )
}

// Exportar las preguntas generadas para usarlas en PracticesTab
export { generateQuestionsFromText }
