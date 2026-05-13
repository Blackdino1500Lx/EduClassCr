import { useState, useRef } from 'react'
import JSZip from 'jszip'
import type { Lesson, Student, Subject, Grade } from '../lib/data'
import { db, qImages } from '../lib/data'
import CreatePracticeModal from './CreatePracticeModal'
import {
  Upload, FileText, Search, Eye, EyeOff, Users, X, AlertTriangle,
  Loader2, CheckCircle, FolderOpen, Filter, Sparkles, Image as ImageIcon
} from 'lucide-react'

interface Props { lessons: Lesson[]; students: Student[]; reload: () => void }

const SUBJECTS: Subject[] = ['Matemáticas', 'Español', 'Ciencias', 'Estudios Sociales', 'Inglés']
const GRADES: Grade[]     = ['7° Grado', '8° Grado', '9° Grado', '10° Grado', '11° Grado', 'Universitario', 'Adulto']

// ── Detecta grado desde path/nombre de carpeta ───────────────────
function detectGrade(path: string): Grade {
  const p = path.toLowerCase()
  if (/bachillerato|bachi/.test(p)) return '11° Grado'
  if (/mep.?7|grado.?7|sétimo|setimo|[^\d]7[°o]/.test(p)) return '7° Grado'
  if (/mep.?8|grado.?8|octavo|[^\d]8[°o]/.test(p)) return '8° Grado'
  if (/mep.?9|grado.?9|noveno|[^\d]9[°o]/.test(p)) return '9° Grado'
  if (/mep.?10|grado.?10|[^\d]10[°o]/.test(p)) return '10° Grado'
  if (/[^\d]11[°o]/.test(p)) return '11° Grado'
  if (/univers/.test(p)) return 'Universitario'
  return '7° Grado'
}

function detectSubject(path: string): Subject {
  if (/matem|math/i.test(path)) return 'Matemáticas'
  if (/espa[nñ]ol|español|lengua/i.test(path)) return 'Español'
  if (/ciencia|biolog|quimic|fisica/i.test(path)) return 'Ciencias'
  if (/social|historia|geograf/i.test(path)) return 'Estudios Sociales'
  if (/ingl[eé]s|english/i.test(path)) return 'Inglés'
  return 'Matemáticas'
}

function friendlyTitle(filePath: string): string {
  const parts = filePath.split('/')
  const folder = parts.length > 1 ? parts[parts.length - 2] : ''
  const file   = parts[parts.length - 1].replace('.pdf', '').replace(/_/g, ' ').trim()
  const grade  = detectGrade(folder + ' ' + filePath)
  return `${grade} · ${file}`
}

interface UploadJob {
  name: string
  customTitle?: string
  customDesc?:  string
  path: string
  grade: Grade
  subject: Subject
  status: 'pending' | 'uploading' | 'done' | 'error' | 'skipped'
  error?: string
}

// ── Assign modal ─────────────────────────────────────────────────
function AssignModal({ lesson, students, onClose, onSave }: {
  lesson: Lesson; students: Student[]; onClose: () => void; onSave: (ids: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>(lesson.assignedTo)
  const [saving, setSaving]     = useState(false)

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const save = async () => {
    setSaving(true)
    await onSave(selected)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <h3>Asignar material</h3>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>
        <p className="modal-subtitle">{lesson.title}</p>
        <div className="modal-body">
          {students.length === 0
            ? <p className="hint-text">No hay alumnos registrados aún.</p>
            : (
              <div className="assign-grid">
                <label className="assign-chip select-all" onClick={() =>
                  setSelected(selected.length === students.length ? [] : students.map(s => s.id))
                }>
                  {selected.length === students.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </label>
                {students.map(s => (
                  <label key={s.id} className={`assign-chip ${selected.includes(s.id) ? 'selected' : ''}`}>
                    <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)}/>
                    <span>{s.firstName} {s.lastName}</span>
                    <span className="chip-grade">{s.grade}</span>
                  </label>
                ))}
              </div>
            )
          }
        </div>
        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <><Loader2 size={14} className="spin"/> Guardando...</> : <>Guardar asignación</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente para agrupar por materia ─────────────────────────
function SubjectSection({ subject, lessons, students, onAssign, onToggleActive, onCreatePractice }: {
  subject: Subject
  lessons: Lesson[]
  students: Student[]
  onAssign: (lesson: Lesson) => void
  onToggleActive: (lesson: Lesson) => void
  onCreatePractice: (lesson: Lesson) => void
}) {
  if (lessons.length === 0) return null
  
  return (
    <div className="subject-section">
      <div className="subject-header">
        <span className={`subject-badge-large sb-${subject.split(' ')[0].toLowerCase()}`}>
          {subject}
        </span>
        <span className="subject-count">{lessons.length} materiales</span>
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
            <p className="lib-card-file">{l.fileName}</p>
            <div className="lib-card-assigned">
              <Users size={12}/>
              <span>{l.assignedTo.length === 0 ? 'Sin asignar' : `${l.assignedTo.length} alumno${l.assignedTo.length !== 1 ? 's' : ''}`}</span>
            </div>
            <div className="lib-card-actions">
              <button className="btn-outline sm" onClick={() => onAssign(l)}>
                <Users size={13}/> Asignar
              </button>
              <button className={`btn-outline sm ${l.isActive ? 'btn-danger-outline' : ''}`} onClick={() => onToggleActive(l)}>
                {l.isActive ? <><EyeOff size={13}/> Desactivar</> : <><Eye size={13}/> Activar</>}
              </button>
              <button className="btn-primary sm" onClick={() => onCreatePractice(l)}>
                <Sparkles size={13}/> Crear práctica
              </button>
              {l.fileUrl && (
                <a href={l.fileUrl} target="_blank" rel="noreferrer" className="btn-outline sm">
                  <FileText size={13}/> Ver PDF
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LibraryTab({ lessons, students, reload }: Props) {
  const [jobs, setJobs]               = useState<UploadJob[]>([])
  const [uploading, setUploading]     = useState(false)
  const [uploadDone, setUploadDone]   = useState(false)
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [filterSubject, setFilterSubject] = useState<string>('all')
  const [filterStatus, setFilterStatus]   = useState<'all'|'active'|'inactive'>('all')
  const [search, setSearch]           = useState('')
  const [assignTarget, setAssignTarget] = useState<Lesson | null>(null)
  const [createTarget, setCreateTarget] = useState<Lesson | null>(null)
  const [pendingFile, setPendingFile]       = useState<File | null>(null)
  const [pendingImagesZip, setPendingImagesZip] = useState<File | null>(null)
  const [pendingTitle, setPendingTitle]     = useState('')
  const [pendingGrade, setPendingGrade]     = useState<Grade>('7° Grado')
  const [pendingSubject, setPendingSubject] = useState<Subject>('Matemáticas')
  const [pendingDesc, setPendingDesc]       = useState('')
  const zipRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)
  const imagesZipRef = useRef<HTMLInputElement>(null)

  // ── Process Images ZIP ─────────────────────────────────────────
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

  // ── Process single PDF + Images ────────────────────────────────
  const handlePdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const grade   = detectGrade(file.name)
    const subject = detectSubject(file.name)
    const baseName = file.name.replace(/\.pdf$/i, '').replace(/_/g, ' ')
    setPendingFile(file)
    setPendingGrade(grade)
    setPendingSubject(subject)
    setPendingTitle(`${grade} · ${baseName}`)
    setPendingDesc('')
    setPendingImagesZip(null)
    e.target.value = ''
  }

  const handleImagesZip = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingImagesZip(file)
    e.target.value = ''
  }

  const confirmSinglePdf = async () => {
    if (!pendingFile || !pendingTitle.trim()) return
    
    const examKey = qImages.buildExamKey(pendingTitle.replace(/[^a-zA-Z0-9]/g, '_'))
    
    const job: UploadJob = {
      name: pendingFile.name, 
      path: pendingFile.name,
      grade: pendingGrade, 
      subject: pendingSubject,
      status: 'pending',
      customTitle: pendingTitle.trim(),
      customDesc:  pendingDesc.trim(),
    }
    
    setJobs([job]); 
    setUploadDone(false); 
    
    // Subir PDF
    await runUploadFiles([{ job, file: pendingFile }], examKey)
    
    // Subir imágenes si hay ZIP
    if (pendingImagesZip) {
      await processImagesZip(pendingImagesZip, examKey)
    }
    
    setPendingFile(null)
    setPendingImagesZip(null)
  }

  // ── Process ZIP ────────────────────────────────────────────────
  const handleZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const zip  = await JSZip.loadAsync(file)
    const newJobs: UploadJob[] = []

    zip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return
      if (!relativePath.toLowerCase().endsWith('.pdf')) return
      if (relativePath.includes('__MACOSX') || relativePath.startsWith('.')) return
      newJobs.push({
        name:    relativePath.split('/').pop() ?? relativePath,
        path:    relativePath,
        grade:   detectGrade(relativePath),
        subject: detectSubject(relativePath),
        status:  'pending',
      })
    })

    setJobs(newJobs); setUploadDone(false)
    e.target.value = ''
    await runUpload(newJobs, zip)
  }

  // ── Upload from ZIP ────────────────────────────────────────────
  const runUpload = async (jobList: UploadJob[], zip: JSZip) => {
    setUploading(true)
    const updated = [...jobList]

    for (let i = 0; i < updated.length; i++) {
      const j = updated[i]
      const exists = lessons.some(l => l.fileName === j.name)
      if (exists) { updated[i] = { ...j, status: 'skipped' }; setJobs([...updated]); continue }

      updated[i] = { ...j, status: 'uploading' }; setJobs([...updated])
      try {
        const blob    = await zip.file(j.path)!.async('blob')
        const file    = new File([blob], j.name, { type: 'application/pdf' })
        const { url } = await db.storage.uploadFile(file)

        const jFolder  = j.path.split('/').slice(-2, -1)[0] ?? ''
        const jBase    = j.name.replace(/\.pdf$/i, '')
        const jExamKey = qImages.buildExamKey(`${jFolder}_${jBase}`)
        await db.lessons.add({
          title:      friendlyTitle(j.path),
          subject:    j.subject,
          content:    `Examen MEP — ${j.grade}. Descargá el PDF para verlo completo.`,
          fileUrl:    url,
          fileName:   j.name,
          examKey:    jExamKey,
          pageImages: [],
          assignedTo: [],
          isActive:   false,
        })
        updated[i] = { ...j, status: 'done' }
      } catch (err: any) {
        updated[i] = { ...j, status: 'error', error: err.message }
      }
      setJobs([...updated])
    }

    setUploading(false); setUploadDone(true)
    reload()
  }

  const runUploadFiles = async (pairs: { job: UploadJob; file: File }[], examKey: string) => {
    setUploading(true)
    const updated = pairs.map(p => p.job)

    for (let i = 0; i < pairs.length; i++) {
      const { job, file } = pairs[i]
      const exists = lessons.some(l => l.fileName === job.name)
      if (exists) { updated[i] = { ...job, status: 'skipped' }; setJobs([...updated]); continue }

      updated[i] = { ...job, status: 'uploading' }; setJobs([...updated])
      try {
        const { url } = await db.storage.uploadFile(file)
        await db.lessons.add({
          title:      job.customTitle ?? `${job.grade} · ${job.name.replace('.pdf','').replace(/_/g,' ')}`,
          subject:    job.subject,
          content:    job.customDesc  ?? `Material — ${job.grade}.`,
          fileUrl:    url,
          fileName:   job.name,
          examKey:    examKey,
          pageImages: [],
          assignedTo: [],
          isActive:   false,
        })
        updated[i] = { ...job, status: 'done' }
      } catch (err: any) {
        updated[i] = { ...job, status: 'error', error: err.message }
      }
      setJobs([...updated])
    }

    setUploading(false); setUploadDone(true)
    reload()
  }

  // ── Toggle active + assign ─────────────────────────────────────
  const toggleActive = async (l: Lesson) => {
    await db.lessons.update({ ...l, isActive: !l.isActive }); reload()
  }

  const saveAssign = async (ids: string[]) => {
    if (!assignTarget) return
    await db.lessons.update({ ...assignTarget, assignedTo: ids, isActive: ids.length > 0 })
    setAssignTarget(null); reload()
  }

  // ── Filtered lessons ───────────────────────────────────────────
  const filtered = lessons.filter(l => {
    if (filterGrade !== 'all' && !l.title.includes(filterGrade)) return false
    if (filterSubject !== 'all' && l.subject !== filterSubject) return false
    if (filterStatus === 'active' && !l.isActive) return false
    if (filterStatus === 'inactive' && l.isActive) return false
    if (search && !l.title.toLowerCase().includes(search.toLowerCase()) &&
        !(l.fileName ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Agrupar por materia
  const lessonsBySubject = SUBJECTS.map(subject => ({
    subject,
    lessons: filtered.filter(l => l.subject === subject)
  })).filter(group => group.lessons.length > 0)

  const doneCount    = jobs.filter(j => j.status === 'done').length
  const skippedCount = jobs.filter(j => j.status === 'skipped').length
  const errorCount   = jobs.filter(j => j.status === 'error').length

  return (
    <div>
      <div className="section-topbar">
        <h2>Biblioteca ({lessons.length} materiales)</h2>
      </div>

      {/* Upload zone — unified */}
      <div className="library-upload-zone">
        <div className="lup-option">
          <div className="lup-icon">📦</div>
          <div className="lup-text">
            <strong>Subir ZIP de PDFs</strong>
            <span>Extraemos todos los PDFs automáticamente</span>
          </div>
          <button className="btn-primary" onClick={() => zipRef.current?.click()} disabled={uploading}>
            {uploading ? <><Loader2 size={14} className="spin"/> Subiendo...</> : <><Upload size={14}/> Elegir ZIP</>}
          </button>
          <input ref={zipRef} type="file" accept=".zip" style={{display:'none'}} onChange={handleZip}/>
        </div>
        <div className="lup-divider">o</div>
        <div className="lup-option">
          <div className="lup-icon"><FileText size={24}/></div>
          <div className="lup-text">
            <strong>Subir PDF individual + Imágenes</strong>
            <span>Selecciona un PDF y opcionalmente un ZIP de imágenes</span>
          </div>
          <button className="btn-outline" onClick={() => pdfRef.current?.click()} disabled={uploading}>
            <Upload size={14}/> Elegir PDF
          </button>
          <input ref={pdfRef} type="file" accept=".pdf" style={{display:'none'}} onChange={handlePdf}/>
        </div>
      </div>

      {/* Single PDF — full form modal with images upload */}
      {pendingFile && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPendingFile(null)}>
          <div className="modal-card" style={{maxWidth:550}}>
            <div className="modal-header">
              <div>
                <h3>Agregar material educativo</h3>
                <p className="modal-subtitle" style={{padding:0,marginTop:4}}>
                  📄 {pendingFile.name}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setPendingFile(null)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="field full">
                  <label>Título del material *</label>
                  <input
                    value={pendingTitle}
                    onChange={e => setPendingTitle(e.target.value)}
                    placeholder="Ej: Bachillerato · Práctica 2023.1"
                  />
                </div>
                <div className="field">
                  <label>Grado *</label>
                  <select value={pendingGrade} onChange={e => setPendingGrade(e.target.value as Grade)}>
                    {GRADES.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Materia *</label>
                  <select value={pendingSubject} onChange={e => setPendingSubject(e.target.value as Subject)}>
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field full">
                  <label>Descripción (opcional)</label>
                  <textarea
                    rows={2}
                    value={pendingDesc}
                    onChange={e => setPendingDesc(e.target.value)}
                    placeholder="Ej: Convocatoria 01 — Geometría y Trigonometría"
                  />
                </div>
                
                {/* ── SECCIÓN PARA IMÁGENES ── */}
                <div className="field full" style={{borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.5rem'}}>
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
                    Las imágenes se asociarán automáticamente por número de pregunta (ej: 1.png, 2.jpg, etc.)
                  </small>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => {
                setPendingFile(null)
                setPendingImagesZip(null)
              }}>Cancelar</button>
              <button className="btn-primary" onClick={confirmSinglePdf} disabled={uploading}>
                {uploading ? <><Loader2 size={14} className="spin"/> Subiendo...</> : <><Upload size={14}/> Subir {pendingImagesZip ? 'PDF + imágenes' : 'solo PDF'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {jobs.length > 0 && (
        <div className="upload-progress-card">
          <div className="upc-header">
            <span className="upc-title">
              {uploading ? '⏳ Subiendo archivos...' : uploadDone ? '✅ Carga completada' : 'Archivos detectados'}
            </span>
            {uploadDone && (
              <span className="upc-summary">
                {doneCount > 0 && <span className="badge-success">{doneCount} subidos</span>}
                {skippedCount > 0 && <span className="badge-warn">{skippedCount} ya existían</span>}
                {errorCount > 0 && <span className="badge-error">{errorCount} errores</span>}
              </span>
            )}
          </div>
          <div className="upc-list">
            {jobs.map((j, i) => (
              <div key={i} className={`upc-item upc-${j.status}`}>
                <span className="upc-status-icon">
                  {j.status === 'pending'   && '⬜'}
                  {j.status === 'uploading' && <Loader2 size={13} className="spin"/>}
                  {j.status === 'done'      && <CheckCircle size={13}/>}
                  {j.status === 'skipped'   && '⏭'}
                  {j.status === 'error'     && <AlertTriangle size={13}/>}
                </span>
                <span className="upc-name">{j.name}</span>
                <span className="upc-meta">{j.grade} · {j.subject}</span>
                {j.error && <span className="upc-error">{j.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="library-filters">
        <div className="filter-group">
          <Search size={14} className="filter-icon"/>
          <input className="filter-input" placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div className="filter-group">
          <Filter size={14} className="filter-icon"/>
          <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
            <option value="all">Todos los grados</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
            <option value="all">Todas las materias</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Materials grid grouped by subject */}
      {filtered.length === 0
        ? (
          <div className="empty-state">
            <FolderOpen size={40}/>
            <p>{lessons.length === 0 ? 'No hay materiales. Subí un ZIP o PDF para empezar.' : 'No hay materiales con ese filtro.'}</p>
          </div>
        )
        : (
          <div className="subjects-container">
            {lessonsBySubject.map(({ subject, lessons: subjectLessons }) => (
              <SubjectSection
                key={subject}
                subject={subject}
                lessons={subjectLessons}
                students={students}
                onAssign={setAssignTarget}
                onToggleActive={toggleActive}
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
      {/* Assign modal */}
      {assignTarget && (
        <AssignModal lesson={assignTarget} students={students} onClose={() => setAssignTarget(null)} onSave={saveAssign}/>
      )}
    </div>
  )
}