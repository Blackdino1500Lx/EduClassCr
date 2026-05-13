import { useState, useRef } from 'react'
import JSZip from 'jszip'
import type { Lesson, Student, Subject } from '../lib/data'
import { db, qImages } from '../lib/data'
import CreatePracticeModal from './CreatePracticeModal'
import { Plus, Trash2, AlertTriangle, Loader2, FileText, Users, Eye, EyeOff, Upload, Sparkles, Image as ImageIcon } from 'lucide-react'

const SUBJECTS: Subject[] = ['Matemáticas', 'Español', 'Ciencias', 'Estudios Sociales', 'Inglés']

interface Props { lessons: Lesson[]; students: Student[]; reload: () => void }

function ytEmbed(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

// ── Componente para agrupar por materia ─────────────────────────
function SubjectSection({ subject, lessons, students, onToggleActive, onRemove, onCreatePractice }: {
  subject: Subject
  lessons: Lesson[]
  students: Student[]
  onToggleActive: (lesson: Lesson) => void
  onRemove: (id: string) => void
  onCreatePractice: (lesson: Lesson) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  
  if (lessons.length === 0) return null
  
  return (
    <div className="subject-section">
      <div className="subject-header">
        <span className={`subject-badge-large sb-${subject.split(' ')[0].toLowerCase()}`}>
          {subject}
        </span>
        <span className="subject-count">{lessons.length} lecciones</span>
      </div>
      <div className="library-grid">
        {lessons.map(l => (
          <div className={`lib-card ${l.isActive ? 'lib-active' : 'lib-inactive'}`} key={l.id}>
            <div className="lib-card-top">
              <span className={`subject-badge sb-${l.subject.split(' ')[0].toLowerCase()}`}>{l.subject}</span>
              <span className={`status-pill ${l.isActive ? 'pill-active' : 'pill-inactive'}`}>
                {l.isActive ? '● Activo' : '○ Inactivo'}
              </span>
            </div>
            <div className="lib-card-icon"><FileText size={28}/></div>
            <h4 className="lib-card-title">{l.title}</h4>
            {l.fileName && <p className="lib-card-file">{l.fileName}</p>}
            <div className="lib-card-assigned">
              <Users size={12}/>
              <span>{l.assignedTo.length === 0 ? 'Sin asignar' : `${l.assignedTo.length} alumno${l.assignedTo.length !== 1 ? 's' : ''}`}</span>
            </div>
            <div className="lib-card-actions">
              <button className="btn-outline sm" onClick={() => onToggleActive(l)}>
                {l.isActive ? <><EyeOff size={13}/> Desactivar</> : <><Eye size={13}/> Activar</>}
              </button>
              <button className="btn-primary sm" onClick={() => onCreatePractice(l)}>
                <Sparkles size={13}/> Crear práctica
              </button>
              <button className="btn-outline sm danger" onClick={() => onRemove(l.id)}>
                <Trash2 size={13}/> Eliminar
              </button>
            </div>
            
            {expanded === l.id && (
              <div className="lesson-expanded" style={{marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0'}}>
                {l.content && <p className="lesson-content" style={{fontSize: '0.875rem', marginBottom: '0.75rem'}}>{l.content}</p>}
                {l.fileUrl && (
                  <a href={l.fileUrl} target="_blank" rel="noreferrer" className="btn-outline sm">
                    <FileText size={13}/> Ver documento
                  </a>
                )}
                {l.youtubeUrl && ytEmbed(l.youtubeUrl) && (
                  <div className="yt-preview" style={{marginTop: 12}}>
                    <iframe width="100%" height="180"
                      src={`https://www.youtube.com/embed/${ytEmbed(l.youtubeUrl)}`}
                      allowFullScreen style={{borderRadius: 8, border: 'none'}}/>
                  </div>
                )}
              </div>
            )}
            
            <button 
              className="view-details-btn" 
              onClick={() => setExpanded(expanded === l.id ? null : l.id)}
              style={{
                marginTop: '0.75rem',
                width: '100%',
                fontSize: '0.75rem',
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '0.5rem'
              }}
            >
              {expanded === l.id ? '▲ Ver menos' : '▼ Ver detalles'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LessonsTab({ lessons, students, reload }: Props) {
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')
  const [uploading, setUploading] = useState(false)
  const [createTarget, setCreateTarget] = useState<Lesson | null>(null)
  const [pendingImagesZip, setPendingImagesZip] = useState<File | null>(null)
  const imagesZipRef = useRef<HTMLInputElement>(null)

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

  const handleImagesZip = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingImagesZip(file)
    e.target.value = ''
  }

  const processImagesZip = async (zipFile: File, examKey: string) => {
    const zip = await JSZip.loadAsync(zipFile)
    const images: { file: File, name: string, questionNum: number }[] = []
    
    for (const [relativePath, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue
      const ext = relativePath.toLowerCase()
      if (!ext.endsWith('.png') && !ext.endsWith('.jpg') && !ext.endsWith('.jpeg')) continue
      
      const blob = await entry.async('blob')
      const fileName = relativePath.split('/').pop() || relativePath
      const imgFile = new File([blob], fileName, { type: 'image/png' })
      const questionNum = parseInt(fileName.match(/\d+/)?.[0] || '0')
      
      images.push({ file: imgFile, name: fileName, questionNum })
    }
    
    for (const img of images) {
      const { url } = await db.storage.uploadFile(img.file)
      await qImages.add({
        examKey,
        fromQ: img.questionNum,
        toQ: img.questionNum,
        imageUrl: url,
        imageName: img.name,
      })
    }
    
    return images.length
  }

  const save = async () => {
    if (!form.title.trim())           { setErr('El título es requerido'); return }
    if (form.assignedTo.length === 0) { setErr('Asigná a al menos un alumno'); return }
    if (!form.content && !form.fileUrl && !form.youtubeUrl) { setErr('Agregá contenido: texto, documento o video'); return }
    
    setSaving(true); setErr('')
    try {
      const examKey = qImages.buildExamKey(form.title.replace(/[^a-zA-Z0-9]/g, '_'))
      
      await db.lessons.add({ ...form, examKey })
      
      if (pendingImagesZip) {
        await processImagesZip(pendingImagesZip, examKey)
        setPendingImagesZip(null)
      }
      
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

  const lessonsBySubject = SUBJECTS.map(subject => ({
    subject,
    lessons: lessons.filter(l => l.subject === subject)
  })).filter(group => group.lessons.length > 0)

  return (
    <div>
      <div className="section-topbar">
        <h2>Lecciones ({lessons.length})</h2>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}>
          <Plus size={15}/> Nueva lección
        </button>
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
              <label>📷 ZIP de imágenes (opcional)</label>
              <div className="image-zip-upload">
                <button 
                  type="button"
                  className="btn-outline"
                  onClick={() => imagesZipRef.current?.click()}
                >
                  <ImageIcon size={14}/> {pendingImagesZip ? 'Cambiar ZIP' : 'Seleccionar ZIP de imágenes'}
                </button>
                {pendingImagesZip && (
                  <span className="selected-file">
                    ✅ {pendingImagesZip.name}
                  </span>
                )}
                <input 
                  ref={imagesZipRef} 
                  type="file" 
                  accept=".zip" 
                  style={{display:'none'}} 
                  onChange={handleImagesZip}
                />
              </div>
              <small className="hint-text">
                Las imágenes se asociarán automáticamente por número de pregunta al crear prácticas
              </small>
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
            <button className="btn-outline" onClick={() => { 
              setShowForm(false); 
              setErr(''); 
              setPendingImagesZip(null);
            }}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <><Loader2 size={14} className="spin"/> Guardando...</> : 'Guardar lección'}
            </button>
          </div>
        </div>
      )}

      {lessons.length === 0 
        ? <p className="empty-hint">No hay lecciones aún. Creá una nueva lección para empezar.</p>
        : (
          <div className="subjects-container">
            {lessonsBySubject.map(({ subject, lessons: subjectLessons }) => (
              <SubjectSection
                key={subject}
                subject={subject}
                lessons={subjectLessons}
                students={students}
                onToggleActive={toggleActive}
                onRemove={remove}
                onCreatePractice={setCreateTarget}
              />
            ))}
          </div>
        )
      }

      {createTarget && (
        <CreatePracticeModal
          lesson={createTarget}
          students={students}
          onClose={() => setCreateTarget(null)}
          onSaved={() => { setCreateTarget(null); reload() }}
        />
      )}
    </div>
  )
}