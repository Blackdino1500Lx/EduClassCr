import { useState, useRef } from 'react'
import JSZip from 'jszip'
import { extractPdfPages } from '../lib/pdfExtract'
import type { Lesson, Student, Subject, Grade } from '../lib/data'
import { db, qImages } from '../lib/data'
import CreatePracticeModal from './CreatePracticeModal'
import {
  Upload, FileText, Search, Eye, EyeOff, Users, X, AlertTriangle,
  Loader2, CheckCircle, FolderOpen, Filter, Sparkles
} from 'lucide-react'

interface Props { lessons: Lesson[]; students: Student[]; reload: () => void }

const SUBJECTS: Subject[] = ['Matemáticas', 'Español', 'Ciencias', 'Estudios Sociales', 'Inglés']
const GRADES: Grade[]     = ['7° Grado', '8° Grado', '9° Grado', '10° Grado', '11° Grado', 'Universitario', 'Adulto']

// ── Detecta grado desde path/nombre de carpeta ───────────────────
function detectGrade(path: string): Grade {
  if (/mep\s*7|grado\s*7|7[°o]/i.test(path)) return '7° Grado'
  if (/mep\s*8|grado\s*8|8[°o]/i.test(path)) return '8° Grado'
  if (/mep\s*9|grado\s*9|9[°o]/i.test(path)) return '9° Grado'
  if (/mep\s*10|grado\s*10|10[°o]/i.test(path)) return '10° Grado'
  if (/bachillerato|bachi|11[°o]/i.test(path)) return '11° Grado'
  if (/univers/i.test(path)) return 'Universitario'
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
  const imgZipRef = useRef<HTMLInputElement>(null)
  const [imgJobs, setImgJobs] = useState<{name:string; status:'pending'|'uploading'|'done'|'error'|'skipped'; examKey?:string}[]>([])
  const [imgUploading, setImgUploading] = useState(false)
  const zipRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  // ── Process Image ZIP ─────────────────────────────────────────
  const handleImgZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const zip  = await JSZip.loadAsync(file)
    const jobs: {name:string; status:'pending'|'uploading'|'done'|'error'|'skipped'; examKey?:string}[] = []

    zip.forEach((relativePath, entry) => {
      if (entry.dir) return
      const ext = relativePath.toLowerCase()
      if (!ext.endsWith('.png') && !ext.endsWith('.jpg') && !ext.endsWith('.jpeg')) return
      if (relativePath.includes('__MACOSX')) return
      jobs.push({ name: relativePath, status: 'pending' })
    })

    setImgJobs(jobs); setImgUploading(true)
    const updated = [...jobs]

    for (let i = 0; i < updated.length; i++) {
      const j = updated[i]
      const parts     = j.name.split('/')
      const folderName = parts.length > 1 ? parts[parts.length - 2] : ''
      const fileName   = parts[parts.length - 1].replace(/\.[^.]+$/, '') // no extension
      const examKey    = qImages.buildExamKey(folderName)
      const range      = qImages.parseRange(fileName)

      updated[i] = { ...j, status: 'uploading', examKey }
      setImgJobs([...updated])

      try {
        const blob    = await zip.file(j.name)!.async('blob')
        const imgFile = new File([blob], parts[parts.length - 1], { type: 'image/png' })
        const { url } = await db.storage.uploadFile(imgFile)

        await qImages.add({
          examKey,
          fromQ:     range?.from ?? 0,
          toQ:       range?.to ?? 0,
          imageUrl:  url,
          imageName: fileName,
        })
        updated[i] = { ...j, status: 'done', examKey }
      } catch (err) {
        updated[i] = { ...j, status: 'error', examKey }
      }
      setImgJobs([...updated])
      await new Promise(r => setTimeout(r, 200))
    }

    setImgUploading(false)
    e.target.value = ''
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

    // Auto-start upload
    await runUpload(newJobs, zip)
  }

  // ── Process single PDF ─────────────────────────────────────────
  const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const job: UploadJob = {
      name: file.name, path: file.name,
      grade: detectGrade(file.name), subject: detectSubject(file.name),
      status: 'pending',
    }
    setJobs([job]); setUploadDone(false)
    e.target.value = ''
    await runUploadFiles([{ job, file }])
  }

  // ── Upload from ZIP ────────────────────────────────────────────
  const runUpload = async (jobList: UploadJob[], zip: JSZip) => {
    setUploading(true)
    const updated = [...jobList]

    for (let i = 0; i < updated.length; i++) {
      const j = updated[i]
      // Check duplicate
      const exists = lessons.some(l => l.fileName === j.name)
      if (exists) { updated[i] = { ...j, status: 'skipped' }; setJobs([...updated]); continue }

      updated[i] = { ...j, status: 'uploading' }; setJobs([...updated])
      try {
        const blob    = await zip.file(j.path)!.async('blob')
        const file    = new File([blob], j.name, { type: 'application/pdf' })
        const { url } = await db.storage.uploadFile(file)
        // Extract pages as images
        let pageImages: string[] = []
        try {
          const pages = await extractPdfPages(file, 20)
          for (const { page, blob: imgBlob } of pages) {
            const imgFile = new File([imgBlob], `${j.name}_p${page}.jpg`, { type: 'image/jpeg' })
            const { url: imgUrl } = await db.storage.uploadFile(imgFile)
            pageImages.push(imgUrl)
          }
        } catch (_e) { console.warn('No se pudieron extraer páginas:', _e) }
        await db.lessons.add({
          title:      friendlyTitle(j.path),
          subject:    j.subject,
          content:    `Examen MEP — ${j.grade}. Descargá el PDF para verlo completo.`,
          fileUrl:    url,
          fileName:   j.name,
          pageImages,
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

  const runUploadFiles = async (pairs: { job: UploadJob; file: File }[]) => {
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
          title:      friendlyTitle(job.path),
          subject:    job.subject,
          content:    `Material — ${job.grade}.`,
          fileUrl:    url,
          fileName:   job.name,
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

  const doneCount    = jobs.filter(j => j.status === 'done').length
  const skippedCount = jobs.filter(j => j.status === 'skipped').length
  const errorCount   = jobs.filter(j => j.status === 'error').length

  return (
    <div>
      <div className="section-topbar">
        <h2>Biblioteca ({lessons.length} materiales)</h2>
      </div>

      {/* Upload zone */}
      <div className="library-upload-zone">
        <div className="lup-option">
          <div className="lup-icon">📦</div>
          <div className="lup-text">
            <strong>Subir ZIP</strong>
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
            <strong>Subir PDF individual</strong>
            <span>Un documento a la vez</span>
          </div>
          <button className="btn-outline" onClick={() => pdfRef.current?.click()} disabled={uploading}>
            <Upload size={14}/> Elegir PDF
          </button>
          <input ref={pdfRef} type="file" accept=".pdf" style={{display:'none'}} onChange={handlePdf}/>
        </div>
      </div>

      {/* Image ZIP upload zone */}
      <div className="library-upload-zone" style={{marginTop:12, background:'#f0f9ff', borderColor:'#bfdbfe'}}>
        <div className="lup-option">
          <div className="lup-icon">🖼️</div>
          <div className="lup-text">
            <strong>Subir ZIP de imágenes</strong>
            <span>Imágenes de figuras y gráficas — se asocian automáticamente a cada examen por nombre de carpeta</span>
          </div>
          <button className="btn-outline" onClick={() => imgZipRef.current?.click()} disabled={imgUploading}>
            {imgUploading ? <><Loader2 size={14} className="spin"/> Subiendo...</> : <><Upload size={14}/> Elegir ZIP de imágenes</>}
          </button>
          <input ref={imgZipRef} type="file" accept=".zip" style={{display:'none'}} onChange={handleImgZip}/>
        </div>
      </div>

      {/* Image upload progress */}
      {imgJobs.length > 0 && (
        <div className="upload-progress-card" style={{marginTop:12}}>
          <div className="upc-header">
            <span className="upc-title">{imgUploading ? '⏳ Subiendo imágenes...' : '✅ Imágenes cargadas'}</span>
            <span className="upc-summary">
              <span className="badge-success">{imgJobs.filter(j=>j.status==='done').length} subidas</span>
              {imgJobs.filter(j=>j.status==='error').length > 0 && <span className="badge-error">{imgJobs.filter(j=>j.status==='error').length} errores</span>}
            </span>
          </div>
          <div className="upc-list">
            {imgJobs.map((j,i) => (
              <div key={i} className={`upc-item upc-${j.status}`}>
                <span className="upc-status-icon">
                  {j.status==='done' && <CheckCircle size={13}/>}
                  {j.status==='uploading' && <Loader2 size={13} className="spin"/>}
                  {j.status==='error' && <AlertTriangle size={13}/>}
                  {j.status==='pending' && '⬜'}
                </span>
                <span className="upc-name">{j.name.split('/').pop()}</span>
                {j.examKey && <span className="upc-meta">→ {j.examKey}</span>}
              </div>
            ))}
          </div>
          <p className="hint-text" style={{marginTop:8}}>Las imágenes quedan asociadas al examen. Al crear una práctica, se adjuntan automáticamente según el número de pregunta.</p>
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

      {/* Materials grid */}
      {filtered.length === 0
        ? (
          <div className="empty-state">
            <FolderOpen size={40}/>
            <p>{lessons.length === 0 ? 'No hay materiales. Subí un ZIP o PDF para empezar.' : 'No hay materiales con ese filtro.'}</p>
          </div>
        )
        : (
          <div className="library-grid">
            {filtered.map(l => (
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
                  <button className="btn-outline sm" onClick={() => setAssignTarget(l)}>
                    <Users size={13}/> Asignar
                  </button>
                  <button className={`btn-outline sm ${l.isActive ? 'btn-danger-outline' : ''}`} onClick={() => toggleActive(l)}>
                    {l.isActive ? <><EyeOff size={13}/> Desactivar</> : <><Eye size={13}/> Activar</>}
                  </button>
                  <button className="btn-primary sm" onClick={() => setCreateTarget(l)}>
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
