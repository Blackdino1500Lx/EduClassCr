import { useState, useEffect } from 'react'
import type { AppView } from '../App'
import { db, auth } from '../lib/data'
import type { Student, Practice, Submission, Question, Subject, Grade, Level } from '../lib/data'
import {
  ArrowLeft, Users, BookOpen, ClipboardList, Plus, Trash2,
  Check, X, AlertTriangle, Lock, ChevronDown, ChevronUp, Star,
  LogOut, Loader2, Mail
} from 'lucide-react'

interface Props { setView: (v: AppView) => void }
type Tab = 'students' | 'practices' | 'reviews'

const SUBJECTS: Subject[] = ['Matemáticas', 'Español', 'Ciencias', 'Estudios Sociales', 'Inglés']
const GRADES: Grade[]     = ['7° Grado', '8° Grado', '9° Grado', '10° Grado', '11° Grado', 'Universitario', 'Adulto']
const LEVELS: Level[]     = ['Básico', 'Intermedio', 'Avanzado']

export default function TeacherPortal({ setView }: Props) {
  const [session, setSession]     = useState<any>(null)
  const [checking, setChecking]   = useState(true)
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loginErr, setLoginErr]   = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [tab, setTab]             = useState<Tab>('students')
  const [students, setStudents]   = useState<Student[]>([])
  const [practices, setPractices] = useState<Practice[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading]     = useState(false)

  // Check existing session on mount
  useEffect(() => {
    auth.getSession().then(s => { setSession(s); setChecking(false) })
    const unsub = auth.onAuthChange(s => setSession(s))
    return unsub
  }, [])

  useEffect(() => { if (session) reload() }, [session])

  const reload = async () => {
    setLoading(true)
    try {
      const [s, p, sub] = await Promise.all([db.students.getAll(), db.practices.getAll(), db.submissions.getAll()])
      setStudents(s); setPractices(p); setSubmissions(sub)
    } finally { setLoading(false) }
  }

  const handleLogin = async () => {
    if (!email || !password) { setLoginErr('Completá email y contraseña'); return }
    setLoggingIn(true); setLoginErr('')
    try { await auth.signIn(email, password) }
    catch (e: any) { setLoginErr('Credenciales incorrectas. Verificá tu email y contraseña.') }
    finally { setLoggingIn(false) }
  }

  const handleLogout = async () => { await auth.signOut() }

  // ─── Loading splash ─────────────────────────────────────────────
  if (checking) return (
    <div className="portal-root flex-center">
      <Loader2 size={32} className="spin" />
    </div>
  )

  // ─── Login ──────────────────────────────────────────────────────
  if (!session) return (
    <div className="portal-root">
      <div className="portal-header">
        <button className="back-btn" onClick={() => setView('landing')}><ArrowLeft size={16}/> Volver al inicio</button>
      </div>
      <div className="login-card">
        <div className="login-icon teacher-icon"><Lock size={32}/></div>
        <h2>Acceso Docente</h2>
        <p>Ingresá con tu cuenta de tutora</p>
        <div className="field w-full">
          <label>Email</label>
          <div className="input-icon-wrap">
            <Mail size={15} className="input-icon"/>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com" onKeyDown={e => e.key === 'Enter' && handleLogin()}/>
          </div>
        </div>
        <div className="field w-full">
          <label>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleLogin()}/>
        </div>
        {loginErr && <div className="error-msg"><AlertTriangle size={14}/> {loginErr}</div>}
        <button className="btn-primary w-full" onClick={handleLogin} disabled={loggingIn}>
          {loggingIn ? <><Loader2 size={15} className="spin"/> Ingresando...</> : 'Ingresar'}
        </button>
        <p className="hint-text">Creá tu cuenta en Supabase Dashboard → Authentication → Users</p>
      </div>
    </div>
  )

  // ─── Dashboard ──────────────────────────────────────────────────
  return (
    <div className="portal-root teacher-portal">
      <div className="portal-header">
        <button className="back-btn" onClick={() => setView('landing')}><ArrowLeft size={16}/> Inicio</button>
        <div className="teacher-tabs">
          {([
            { id: 'students',  icon: <Users size={15}/>,       label: 'Alumnos' },
            { id: 'practices', icon: <BookOpen size={15}/>,    label: 'Prácticas' },
            { id: 'reviews',   icon: <ClipboardList size={15}/>, label: 'Revisiones' },
          ] as const).map(t => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => { setTab(t.id); reload() }}>
              {t.icon}{t.label}
              {t.id === 'reviews' && submissions.filter(s => !s.reviewed).length > 0 && (
                <span className="tab-badge">{submissions.filter(s => !s.reviewed).length}</span>
              )}
            </button>
          ))}
        </div>
        <button className="back-btn ml-auto" onClick={handleLogout} title="Cerrar sesión">
          <LogOut size={15}/> Salir
        </button>
      </div>

      <div className="portal-content">
        {loading
          ? <div className="flex-center py-12"><Loader2 size={28} className="spin"/></div>
          : <>
              {tab === 'students'  && <StudentsTab  students={students}  reload={reload}/>}
              {tab === 'practices' && <PracticesTab practices={practices} students={students} reload={reload}/>}
              {tab === 'reviews'   && <ReviewsTab   submissions={submissions} practices={practices} students={students} reload={reload}/>}
            </>
        }
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// STUDENTS TAB
// ══════════════════════════════════════════════════════════════════
function StudentsTab({ students, reload }: { students: Student[], reload: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ firstName: '', lastName: '', grade: GRADES[0], level: LEVELS[0], pin: '' })
  const [err, setErr]           = useState('')
  const [saving, setSaving]     = useState(false)

  const genPin = async () => {
    let pin = ''
    let taken = true
    while (taken) {
      pin = String(Math.floor(1000 + Math.random() * 9000))
      taken = await db.students.isPinTaken(pin)
    }
    setForm(f => ({ ...f, pin }))
  }

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { setErr('Nombre y apellido requeridos'); return }
    if (form.pin.length !== 4) { setErr('PIN debe ser de 4 dígitos'); return }
    setSaving(true); setErr('')
    try {
      const taken = await db.students.isPinTaken(form.pin)
      if (taken) { setErr('Ese PIN ya está en uso, generá uno diferente'); return }
      await db.students.add(form)
      await reload()
      setShowForm(false)
      setForm({ firstName: '', lastName: '', grade: GRADES[0], level: LEVELS[0], pin: '' })
    } catch (e: any) { setErr(e.message ?? 'Error guardando alumno') }
    finally { setSaving(false) }
  }

  const remove = async (s: Student) => {
    if (!confirm(`¿Eliminar a ${s.firstName} ${s.lastName}? Esto borrará también sus entregas.`)) return
    await db.students.delete(s.id); reload()
  }

  return (
    <div>
      <div className="section-topbar">
        <h2>Alumnos ({students.length})</h2>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}><Plus size={15}/> Nuevo alumno</button>
      </div>

      {showForm && (
        <div className="form-card">
          <h3>Registrar alumno</h3>
          <div className="form-grid">
            <div className="field"><label>Nombre</label>
              <input value={form.firstName} onChange={e => setForm(f => ({...f, firstName: e.target.value}))} placeholder="María"/>
            </div>
            <div className="field"><label>Apellido</label>
              <input value={form.lastName} onChange={e => setForm(f => ({...f, lastName: e.target.value}))} placeholder="Rodríguez"/>
            </div>
            <div className="field"><label>Grado / Nivel educativo</label>
              <select value={form.grade} onChange={e => setForm(f => ({...f, grade: e.target.value as Grade}))}>
                {GRADES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="field"><label>Nivel de dificultad</label>
              <select value={form.level} onChange={e => setForm(f => ({...f, level: e.target.value as Level}))}>
                {LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="field pin-field">
              <label>PIN de acceso (4 dígitos)</label>
              <div className="pin-row">
                <input value={form.pin} maxLength={4} inputMode="numeric"
                  onChange={e => setForm(f => ({...f, pin: e.target.value.replace(/\D/g,'').slice(0,4)}))}
                  placeholder="0000"/>
                <button className="btn-outline sm" onClick={genPin} type="button">Generar</button>
              </div>
            </div>
          </div>
          {err && <div className="error-msg"><AlertTriangle size={13}/> {err}</div>}
          <div className="form-actions">
            <button className="btn-outline" onClick={() => { setShowForm(false); setErr('') }}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <><Loader2 size={14} className="spin"/> Guardando...</> : 'Guardar alumno'}
            </button>
          </div>
        </div>
      )}

      <div className="student-table">
        {students.length === 0
          ? <div className="empty-state"><Users size={36}/><p>No hay alumnos registrados aún.</p></div>
          : students.map(s => (
            <div className="student-row" key={s.id}>
              <div className="sr-avatar">{s.firstName[0]}{s.lastName[0]}</div>
              <div className="sr-info">
                <strong>{s.firstName} {s.lastName}</strong>
                <span>{s.grade} · {s.level}</span>
              </div>
              <div className="sr-pin"><Lock size={12}/> PIN: <strong>{s.pin}</strong></div>
              <button className="icon-btn danger" onClick={() => remove(s)}><Trash2 size={15}/></button>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// PRACTICES TAB
// ══════════════════════════════════════════════════════════════════
function PracticesTab({ practices, students, reload }: { practices: Practice[], students: Student[], reload: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')
  const [form, setForm]         = useState({
    title: '', subject: SUBJECTS[0] as Subject, description: '',
    dueDate: '', assignedTo: [] as string[], questions: [] as Question[]
  })

  const uid = () => Math.random().toString(36).slice(2, 10)

  const addQuestion = () => {
    const isMath = form.subject === 'Matemáticas'
    setForm(f => ({
      ...f,
      questions: [...f.questions, {
        id: uid(), text: '', points: 5,
        type: isMath ? 'open' : 'multiple',
        options: isMath ? undefined : ['', '', '', ''],
        correctOption: 0,
      }]
    }))
  }

  const updateQ = (id: string, patch: Partial<Question>) =>
    setForm(f => ({ ...f, questions: f.questions.map(q => q.id === id ? { ...q, ...patch } : q) }))

  const removeQ = (id: string) =>
    setForm(f => ({ ...f, questions: f.questions.filter(q => q.id !== id) }))

  const save = async () => {
    if (!form.title.trim())           { setErr('El título es requerido'); return }
    if (form.questions.length === 0)  { setErr('Agregá al menos una pregunta'); return }
    if (form.assignedTo.length === 0) { setErr('Asigná a al menos un alumno'); return }
    const bad = form.questions.find(q => !q.text.trim() || (q.type === 'multiple' && q.options?.some(o => !o.trim())))
    if (bad) { setErr('Completá todas las preguntas y opciones'); return }
    setSaving(true); setErr('')
    try {
      await db.practices.add({ ...form, isActive: true })
      await reload()
      setShowForm(false)
      setForm({ title: '', subject: SUBJECTS[0], description: '', dueDate: '', assignedTo: [], questions: [] })
    } catch (e: any) { setErr(e.message ?? 'Error guardando práctica') }
    finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar esta práctica? Se borrarán también las entregas asociadas.')) return
    await db.practices.delete(id); reload()
  }

  return (
    <div>
      <div className="section-topbar">
        <h2>Prácticas ({practices.length})</h2>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}><Plus size={15}/> Nueva práctica</button>
      </div>

      {showForm && (
        <div className="form-card">
          <h3>Crear práctica</h3>
          <div className="form-grid">
            <div className="field"><label>Título</label>
              <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="Fracciones – Práctica 1"/>
            </div>
            <div className="field"><label>Materia</label>
              <select value={form.subject} onChange={e => {
                const s = e.target.value as Subject
                setForm(f => ({ ...f, subject: s, questions: [] }))
              }}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field full"><label>Descripción / instrucciones</label>
              <textarea value={form.description} rows={2}
                onChange={e => setForm(f => ({...f, description: e.target.value}))}
                placeholder="Instrucciones para el alumno..."/>
            </div>
            <div className="field"><label>Fecha límite (opcional)</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({...f, dueDate: e.target.value}))}/>
            </div>
            <div className="field full"><label>Asignar a alumnos</label>
              <div className="assign-grid">
                {students.length === 0
                  ? <span className="hint-text">Registrá alumnos primero en la pestaña Alumnos.</span>
                  : students.map(s => (
                    <label key={s.id} className={`assign-chip ${form.assignedTo.includes(s.id) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={form.assignedTo.includes(s.id)}
                        onChange={e => setForm(f => ({
                          ...f,
                          assignedTo: e.target.checked
                            ? [...f.assignedTo, s.id]
                            : f.assignedTo.filter(x => x !== s.id)
                        }))}/>
                      {s.firstName} {s.lastName}
                    </label>
                  ))
                }
              </div>
            </div>
          </div>

          <div className="questions-section">
            <div className="qs-header">
              <h4>Preguntas</h4>
              <button className="btn-outline sm" onClick={addQuestion} type="button"><Plus size={13}/> Agregar</button>
            </div>
            {form.subject === 'Matemáticas' && (
              <div className="math-info"><AlertTriangle size={13}/> Matemáticas usa desarrollo abierto. El alumno no puede pegar texto.</div>
            )}
            {form.questions.map((q, idx) => (
              <div className="q-builder" key={q.id}>
                <div className="qb-header">
                  <span>Pregunta {idx + 1} · {q.type === 'open' ? 'Desarrollo' : 'Opción múltiple'}</span>
                  <div className="qb-actions">
                    <div className="field-inline"><label>Pts</label>
                      <input type="number" min={1} max={100} value={q.points} style={{width:60}}
                        onChange={e => updateQ(q.id, { points: +e.target.value })}/>
                    </div>
                    <button className="icon-btn danger sm" onClick={() => removeQ(q.id)}><Trash2 size={13}/></button>
                  </div>
                </div>
                <textarea rows={2} className="q-input" placeholder="Enunciado de la pregunta"
                  value={q.text} onChange={e => updateQ(q.id, { text: e.target.value })}/>
                {q.type === 'multiple' && q.options && (
                  <div className="options-builder">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="opt-row">
                        <input type="radio" name={`correct-${q.id}`} checked={q.correctOption === oi}
                          onChange={() => updateQ(q.id, { correctOption: oi })} title="Respuesta correcta"/>
                        <span className="opt-letter">{String.fromCharCode(65 + oi)}</span>
                        <input type="text" value={opt} placeholder={`Opción ${String.fromCharCode(65 + oi)}`}
                          onChange={e => {
                            const opts = [...(q.options ?? [])]
                            opts[oi] = e.target.value
                            updateQ(q.id, { options: opts })
                          }}/>
                      </div>
                    ))}
                    <p className="hint-text">El círculo marcado = respuesta correcta.</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {err && <div className="error-msg"><AlertTriangle size={13}/> {err}</div>}
          <div className="form-actions">
            <button className="btn-outline" onClick={() => { setShowForm(false); setErr('') }}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <><Loader2 size={14} className="spin"/> Guardando...</> : 'Guardar práctica'}
            </button>
          </div>
        </div>
      )}

      <div className="practice-list">
        {practices.length === 0
          ? <div className="empty-state"><BookOpen size={36}/><p>No hay prácticas creadas aún.</p></div>
          : practices.map(p => (
            <div className="practice-card" key={p.id}>
              <div className="pc-top">
                <span className={`subject-badge sb-${p.subject.split(' ')[0].toLowerCase()}`}>{p.subject}</span>
                <button className="icon-btn danger sm" onClick={() => remove(p.id)}><Trash2 size={14}/></button>
              </div>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <div className="pc-meta">
                <span>{p.questions.length} pregunta{p.questions.length !== 1 ? 's' : ''}</span>
                <span>{p.assignedTo.length} alumno{p.assignedTo.length !== 1 ? 's' : ''}</span>
                {p.dueDate && <span>Vence: {new Date(p.dueDate + 'T12:00:00').toLocaleDateString('es-CR')}</span>}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// REVIEWS TAB
// ══════════════════════════════════════════════════════════════════
function ReviewsTab({ submissions, practices, students, reload }: {
  submissions: Submission[], practices: Practice[], students: Student[], reload: () => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [scores, setScores]     = useState<Record<string, string>>({})
  const [notes, setNotes]       = useState<Record<string, string>>({})
  const [saving, setSaving]     = useState<string | null>(null)

  const getStudent  = (id: string) => students.find(s => s.id === id)
  const getPractice = (id: string) => practices.find(p => p.id === id)

  const saveReview = async (sub: Submission) => {
    const p = getPractice(sub.practiceId)
    const maxScore = p?.questions.reduce((a, q) => a + q.points, 0) ?? 100
    const score = parseInt(scores[sub.id] ?? '0')
    if (isNaN(score) || score < 0 || score > maxScore) { alert(`Puntaje debe ser 0–${maxScore}`); return }
    setSaving(sub.id)
    try {
      await db.submissions.update({ ...sub, reviewed: true, score, teacherNote: notes[sub.id] ?? '' })
      await reload()
    } finally { setSaving(null) }
  }

  const pending  = submissions.filter(s => !s.reviewed)
  const reviewed = submissions.filter(s => s.reviewed)

  if (submissions.length === 0) return (
    <div>
      <h2>Revisiones</h2>
      <div className="empty-state"><ClipboardList size={36}/><p>Ningún alumno ha entregado prácticas aún.</p></div>
    </div>
  )

  return (
    <div>
      <h2>Revisiones ({submissions.length})</h2>

      {pending.length > 0 && (
        <>
          <h3 className="review-section-title">⏳ Pendientes ({pending.length})</h3>
          {pending.map(sub => (
            <ReviewCard key={sub.id} sub={sub} expanded={expanded} setExpanded={setExpanded}
              scores={scores} setScores={setScores} notes={notes} setNotes={setNotes}
              getStudent={getStudent} getPractice={getPractice}
              saveReview={saveReview} saving={saving}/>
          ))}
        </>
      )}
      {reviewed.length > 0 && (
        <>
          <h3 className="review-section-title">✅ Revisadas ({reviewed.length})</h3>
          {reviewed.map(sub => (
            <ReviewCard key={sub.id} sub={sub} expanded={expanded} setExpanded={setExpanded}
              scores={scores} setScores={setScores} notes={notes} setNotes={setNotes}
              getStudent={getStudent} getPractice={getPractice}
              saveReview={saveReview} saving={saving}/>
          ))}
        </>
      )}
    </div>
  )
}

function ReviewCard({ sub, expanded, setExpanded, scores, setScores, notes, setNotes, getStudent, getPractice, saveReview, saving }: any) {
  const student  = getStudent(sub.studentId)
  const practice = getPractice(sub.practiceId)
  const isOpen   = expanded === sub.id
  const maxScore = practice?.questions.reduce((a: number, q: Question) => a + q.points, 0) ?? 100

  return (
    <div className={`review-card ${sub.reviewed ? 'reviewed' : 'pending'}`}>
      <div className="review-header" onClick={() => setExpanded(isOpen ? null : sub.id)}>
        <div className="rh-left">
          <div className="sr-avatar sm">{student?.firstName?.[0]}{student?.lastName?.[0]}</div>
          <div>
            <strong>{student?.firstName} {student?.lastName}</strong>
            <span className="rh-sub">{practice?.title} · {practice?.subject}</span>
          </div>
        </div>
        <div className="rh-right">
          {sub.reviewed
            ? <span className="score-badge">{sub.score}/{maxScore} pts</span>
            : <span className="pending-badge">Pendiente</span>}
          {sub.antiCheatFlags?.length > 0 && (
            <span className="flag-badge" title={sub.antiCheatFlags.join(', ')}>
              <AlertTriangle size={12}/> {sub.antiCheatFlags.length} alerta{sub.antiCheatFlags.length > 1 ? 's' : ''}
            </span>
          )}
          {isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </div>
      </div>

      {isOpen && (
        <div className="review-body">
          <p className="review-date">Entregada: {new Date(sub.submittedAt).toLocaleString('es-CR')}</p>
          {sub.antiCheatFlags?.length > 0 && (
            <div className="cheat-warning">
              <AlertTriangle size={14}/>
              <span>Alertas de integridad: <strong>{sub.antiCheatFlags.join(', ')}</strong></span>
            </div>
          )}
          <div className="review-questions">
            {practice?.questions.map((q: Question, idx: number) => {
              const ans = sub.answers.find((a: any) => a.questionId === q.id)
              const correct = q.type === 'multiple' && ans?.value === q.correctOption
              return (
                <div className="rq-card" key={q.id}>
                  <div className="rq-header">
                    <span>P{idx + 1}: {q.text}</span>
                    <span className="rq-pts">{q.points} pts</span>
                  </div>
                  {q.type === 'multiple' ? (
                    <div className={`rq-answer mc ${correct ? 'correct' : 'wrong'}`}>
                      {correct ? <Check size={14}/> : <X size={14}/>}
                      Respondió: <strong>{q.options?.[ans?.value as number] ?? '—'}</strong>
                      {!correct && <span> · Correcta: {q.options?.[q.correctOption!]}</span>}
                    </div>
                  ) : (
                    <div className="rq-answer open">
                      {ans?.value ? String(ans.value) : <em>Sin respuesta</em>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {!sub.reviewed && (
            <div className="review-actions">
              <div className="score-input-row">
                <label>Puntaje (máx {maxScore})</label>
                <input type="number" min={0} max={maxScore}
                  value={scores[sub.id] ?? ''}
                  onChange={e => setScores((s: any) => ({...s, [sub.id]: e.target.value}))}
                  placeholder="0"/>
              </div>
              <div className="field full">
                <label>Nota para el alumno</label>
                <textarea rows={3} value={notes[sub.id] ?? ''}
                  onChange={e => setNotes((n: any) => ({...n, [sub.id]: e.target.value}))}
                  placeholder="Retroalimentación personalizada..."/>
              </div>
              <button className="btn-primary" onClick={() => saveReview(sub)} disabled={saving === sub.id}>
                {saving === sub.id
                  ? <><Loader2 size={14} className="spin"/> Guardando...</>
                  : <><Check size={15}/> Guardar revisión</>}
              </button>
            </div>
          )}
          {sub.reviewed && sub.teacherNote && (
            <div className="teacher-note"><Star size={13}/> <em>{sub.teacherNote}</em></div>
          )}
        </div>
      )}
    </div>
  )
}
