import { useState } from 'react'
import type { Lesson, Student, Subject } from '../lib/data'
import { db } from '../lib/data'
import { Plus, Trash2, AlertTriangle, Loader2, FileText, Users, Eye, EyeOff, Upload } from 'lucide-react'

const SUBJECTS: Subject[] = ['Matemáticas', 'Español', 'Ciencias', 'Estudios Sociales', 'Inglés']

interface Props { lessons: Lesson[]; students: Student[]; reload: () => void }

function ytEmbed(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

export default function LessonsTab({ lessons, students, reload }: Props) {
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

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
    } catch (_e) { setErr('Error subiendo el archivo. Intentá de nuevo.') }
    finally { setUploading(false) }
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
              <select value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value as Subject}))}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div className="field full">
              <label>Contenido / Explicación (texto)</label>
              <textarea rows={5} value={form.content}
                onChange={e => setForm(f => ({...f, content: e.target.value}))}
                placeholder="Escribí la explicación de la lección aquí..."/>
            </div>

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

          {err && <div className="error-msg"><AlertTriangle size={13}/> {err}</div>}
          <div className="form-actions">
            <button className="btn-outline" onClick={() => { setShowForm(false); setErr('') }}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <><Loader2 size={14} className="spin"/> Guardando...</> : 'Guardar lección'}
            </button>
          </div>
        </div>
      )}

      <div className="lessons-grid">
        {lessons.length === 0 && <p className="empty-hint">No hay lecciones aún.</p>}
        {lessons.map(l => (
          <div className="lesson-card" key={l.id}>
            <div className="lesson-card-header">
              <div>
                <span className={`subject-badge sb-${l.subject.split(' ')[0].toLowerCase()}`}>{l.subject}</span>
                <span className={`status-dot ${l.isActive ? 'active' : ''}`}>{l.isActive ? '● Activo' : '○ Inactivo'}</span>
              </div>
              <div className="card-actions">
                <button className="icon-btn" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                  {expanded === l.id ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
                <button className="icon-btn danger" onClick={() => remove(l.id)}><Trash2 size={15}/></button>
              </div>
            </div>

            <h4 className="lesson-title">{l.title}</h4>
            {l.fileName && <p className="lesson-meta"><FileText size={12}/> {l.fileName}</p>}
            {l.assignedTo.length > 0 && <p className="lesson-meta"><Users size={12}/> {l.assignedTo.length} alumno{l.assignedTo.length !== 1 ? 's' : ''}</p>}

            {expanded === l.id && (
              <div className="lesson-expanded">
                {l.content && <p className="lesson-content">{l.content}</p>}
                {l.fileUrl && (
                  <a href={l.fileUrl} target="_blank" rel="noreferrer" className="btn-outline sm">
                    <FileText size={13}/> Ver documento
                  </a>
                )}
                {l.youtubeUrl && ytEmbed(l.youtubeUrl) && (
                  <div className="yt-preview" style={{marginTop:12}}>
                    <iframe width="100%" height="180"
                      src={`https://www.youtube.com/embed/${ytEmbed(l.youtubeUrl)}`}
                      allowFullScreen style={{borderRadius:8, border:'none'}}/>
                  </div>
                )}
              </div>
            )}

            <div className="lesson-footer">
              <button className="btn-outline sm" onClick={() => toggleActive(l)}>
                {l.isActive ? <><EyeOff size={12}/> Desactivar</> : <><Eye size={12}/> Activar</>}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
