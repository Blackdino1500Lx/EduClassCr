import { useState, useRef, useCallback } from 'react'
import type { AppView } from '../App'
import type { Student, Practice } from '../lib/data'
import { db } from '../lib/data'
import { ArrowLeft, BookOpen, Lock, AlertTriangle, CheckCircle, Clock, Send, ChevronRight, Loader2 } from 'lucide-react'

interface Props { setView: (v: AppView) => void }
type Screen = 'login' | 'home' | 'practice'

function SecureTextarea({ value, onChange, isMath, placeholder, flagsRef }: {
  value: string; onChange: (v: string) => void
  isMath: boolean; placeholder?: string; flagsRef: React.MutableRefObject<string[]>
}) {
  const lastLen = useRef(0)

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!isMath) return
    const text = e.clipboardData.getData('text')
    if (text.length > 20) {
      e.preventDefault()
      if (!flagsRef.current.includes('paste_blocked')) flagsRef.current.push('paste_blocked')
      alert('⚠️ El pegado de texto no está permitido en preguntas de desarrollo de Matemáticas.')
    }
  }, [isMath, flagsRef])

  return (
    <div className="relative">
      <textarea className="secure-textarea" value={value} placeholder={placeholder} rows={5}
        onPaste={handlePaste}
        onContextMenu={isMath ? e => e.preventDefault() : undefined}
        onChange={e => {
          if (isMath) {
            const diff = e.target.value.length - lastLen.current
            if (diff > 30 && !flagsRef.current.includes('paste_detected'))
              flagsRef.current.push('paste_detected')
            lastLen.current = e.target.value.length
          }
          onChange(e.target.value)
        }}/>
      {isMath && (
        <div className="anti-cheat-badge"><Lock size={11}/><span>Modo seguro activo</span></div>
      )}
    </div>
  )
}

export default function StudentPortal({ setView }: Props) {
  const [screen, setScreen]             = useState<Screen>('login')
  const [pin, setPin]                   = useState('')
  const [student, setStudent]           = useState<Student | null>(null)
  const [practices, setPractices]       = useState<Practice[]>([])
  const [activePractice, setActive]     = useState<Practice | null>(null)
  const [answers, setAnswers]           = useState<Record<string, string | number>>({})
  const [loginErr, setLoginErr]         = useState('')
  const [submitted, setSubmitted]       = useState(false)
  const [loggingIn, setLoggingIn]       = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())
  const flagsRef = useRef<string[]>([])

  const handleLogin = async () => {
    if (pin.length !== 4) { setLoginErr('El PIN debe ser de 4 dígitos'); return }
    setLoggingIn(true); setLoginErr('')
    try {
      const found = await db.students.findByPin(pin)
      if (!found) { setLoginErr('PIN incorrecto. Consultá con tu tutora.'); return }
      const assigned = await db.practices.forStudent(found.id)
      const allSubs  = await db.submissions.getAll()
      const doneSet  = new Set(allSubs.filter(s => s.studentId === found.id).map(s => s.practiceId))
      setStudent(found); setPractices(assigned); setSubmittedIds(doneSet); setScreen('home')
    } catch (_e) { setLoginErr('Error de conexión. Intentá de nuevo.') }
    finally { setLoggingIn(false) }
  }

  const startPractice = (p: Practice) => {
    setActive(p); setAnswers({}); setSubmitted(false); flagsRef.current = []; setScreen('practice')
  }

  const setAnswer = (qId: string, val: string | number) =>
    setAnswers(prev => ({ ...prev, [qId]: val }))

  const handleSubmit = async () => {
    if (!activePractice || !student) return
    const unanswered = activePractice.questions.filter(q => answers[q.id] === undefined || answers[q.id] === '')
    if (unanswered.length > 0) { alert(`Faltan ${unanswered.length} pregunta(s) por responder.`); return }

    const isMath = activePractice.subject === 'Matemáticas'
    let autoScore: number | undefined = undefined
    if (!isMath) {
      autoScore = 0
      activePractice.questions.forEach(q => {
        if (q.type === 'multiple' && answers[q.id] === q.correctOption) autoScore! += q.points
      })
    }

    setSubmitting(true)
    try {
      await db.submissions.add({
        practiceId:     activePractice.id,
        studentId:      student.id,
        answers:        activePractice.questions.map(q => ({ questionId: q.id, value: answers[q.id] ?? '' })),
        score:          autoScore,
        reviewed:       !isMath,
        antiCheatFlags: flagsRef.current,
        teacherNote:    undefined,
      })
      setSubmittedIds(prev => new Set([...prev, activePractice.id]))
      setSubmitted(true)
    } catch (_e) { alert('Error al entregar. Intentá de nuevo.') }
    finally { setSubmitting(false) }
  }

  if (screen === 'login') return (
    <div className="portal-root">
      <div className="portal-header">
        <button className="back-btn" onClick={() => setView('landing')}><ArrowLeft size={16}/> Volver al inicio</button>
      </div>
      <div className="login-card">
        <div className="login-icon"><BookOpen size={32}/></div>
        <h2>Portal del Alumno</h2>
        <p>Ingresá el PIN de 4 dígitos que te dio tu tutora</p>
        <div className="pin-inputs">
          {[0,1,2,3].map(i => (
            <input key={i} type="text" inputMode="numeric" maxLength={1} className="pin-box"
              value={pin[i] || ''}
              onChange={e => {
                const val = e.target.value.replace(/\D/,'')
                const arr = pin.split('')
                arr[i] = val
                const np = arr.join('').slice(0,4)
                setPin(np)
                if (val && i < 3) document.querySelectorAll<HTMLInputElement>('.pin-box')[i+1]?.focus()
              }}
              onKeyDown={e => {
                if (e.key === 'Backspace' && !pin[i] && i > 0)
                  document.querySelectorAll<HTMLInputElement>('.pin-box')[i-1]?.focus()
              }}/>
          ))}
        </div>
        {loginErr && <div className="error-msg"><AlertTriangle size={14}/> {loginErr}</div>}
        <button className="btn-primary w-full" onClick={handleLogin} disabled={loggingIn || pin.length < 4}>
          {loggingIn ? <><Loader2 size={15} className="spin"/> Verificando...</> : <>Ingresar <ChevronRight size={16}/></>}
        </button>
      </div>
    </div>
  )

  if (screen === 'home' && student) return (
    <div className="portal-root">
      <div className="portal-header">
        <button className="back-btn" onClick={() => setView('landing')}><ArrowLeft size={16}/> Inicio</button>
        <div className="student-chip">{student.firstName} {student.lastName} · {student.grade} · {student.level}</div>
      </div>
      <div className="portal-content">
        <h2>Mis Prácticas</h2>
        {practices.length === 0
          ? <div className="empty-state"><BookOpen size={40}/><p>No tenés prácticas asignadas aún.</p></div>
          : (
            <div className="practice-list">
              {practices.map(p => {
                const done = submittedIds.has(p.id)
                return (
                  <div className={`practice-card ${done ? 'done' : ''}`} key={p.id}>
                    <div className="pc-top">
                      <span className={`subject-badge sb-${p.subject.split(' ')[0].toLowerCase()}`}>{p.subject}</span>
                      {done && <span className="done-badge"><CheckCircle size={13}/> Entregada</span>}
                    </div>
                    <h3>{p.title}</h3>
                    <p>{p.description}</p>
                    <div className="pc-meta">
                      <span><Clock size={13}/> {p.questions.length} pregunta{p.questions.length !== 1 ? 's' : ''}</span>
                      {p.dueDate && <span>Vence: {new Date(p.dueDate + 'T12:00:00').toLocaleDateString('es-CR')}</span>}
                    </div>
                    <button className={done ? 'btn-outline' : 'btn-primary'} disabled={done} onClick={() => !done && startPractice(p)}>
                      {done ? 'Ya entregada' : 'Comenzar práctica'}
                    </button>
                  </div>
                )
              })}
            </div>
          )
        }
      </div>
    </div>
  )

  if (screen === 'practice' && activePractice && student) {
    const isMath = activePractice.subject === 'Matemáticas'

    if (submitted) return (
      <div className="portal-root">
        <div className="portal-header">
          <button className="back-btn" onClick={() => setScreen('home')}><ArrowLeft size={16}/> Mis prácticas</button>
        </div>
        <div className="submit-success">
          <CheckCircle size={56} className="success-icon"/>
          <h2>¡Práctica entregada!</h2>
          <p>Tu tutora revisará tu trabajo y te dará retroalimentación pronto.</p>
          <button className="btn-primary" onClick={() => setScreen('home')}>Volver a mis prácticas</button>
        </div>
      </div>
    )

    return (
      <div className="portal-root">
        <div className="portal-header">
          <button className="back-btn" onClick={() => setScreen('home')}><ArrowLeft size={16}/> Mis prácticas</button>
          <div className="student-chip">{activePractice.subject}</div>
        </div>
        <div className="portal-content">
          <div className="practice-header">
            <h2>{activePractice.title}</h2>
            <p>{activePractice.description}</p>
            {isMath && (
              <div className="math-warning">
                <Lock size={15}/>
                <span>Esta práctica es de <strong>desarrollo</strong>. El pegado de texto está desactivado.</span>
              </div>
            )}
          </div>
          <div className="questions-list">
            {activePractice.questions.map((q, idx) => (
              <div className="question-card" key={q.id}>
                <div className="q-header">
                  <span className="q-num">Pregunta {idx + 1}</span>
                  <span className="q-pts">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                </div>
                <p className="q-text">{q.text}</p>
                {q.type === 'open' ? (
                  <SecureTextarea isMath={isMath} flagsRef={flagsRef}
                    value={String(answers[q.id] ?? '')}
                    onChange={v => setAnswer(q.id, v)}
                    placeholder="Escribí tu respuesta aquí..."/>
                ) : (
                  <div className="options-list">
                    {q.options?.map((opt, oi) => (
                      <label key={oi} className={`option-label ${answers[q.id] === oi ? 'selected' : ''}`}>
                        <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === oi} onChange={() => setAnswer(q.id, oi)}/>
                        <span className="opt-letter">{String.fromCharCode(65+oi)}</span>
                        {opt}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="submit-row">
            <span className="answered-count">{Object.keys(answers).length} / {activePractice.questions.length} respondidas</span>
            <button className="btn-submit" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <><Loader2 size={15} className="spin"/> Entregando...</> : <><Send size={16}/> Entregar práctica</>}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
