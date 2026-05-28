// src/pages/AdminPanel.tsx
// Ruta /admin — solo accesible con el email de administrador
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = 'salgueragonzaleze4@gmail.com'

const ADDONS = [
  { id: 'branding',       label: '🎨 Branding' },
  { id: 'extra_students', label: '👥 +10 alumnos' },
  { id: 'reports',        label: '📄 Reportes' },
]

interface Teacher {
  id: string
  email: string
  full_name: string | null
  school_name: string | null
  plan: string
  add_ons: string[]
  students_limit: number
  created_at: string
}

interface Stats {
  total: number
  active: number
  free: number
  students: number
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function AdminPanel() {
  const [authed,   setAuthed]   = useState<boolean | null>(null) // null = loading
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [counts,   setCounts]   = useState<Record<string, number>>({})
  const [stats,    setStats]    = useState<Stats>({ total: 0, active: 0, free: 0, students: 0 })
  const [saves,    setSaves]    = useState<Record<string, SaveState>>({})

  // — Auth check ——————————————————————————————————————
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email === ADMIN_EMAIL) {
        setAuthed(true)
        loadData()
      } else {
        setAuthed(false)
      }
    })
  }, [])

  // — Data loading ————————————————————————————————————
  async function loadData() {
    const [{ data: tList }, { data: sList }] = await Promise.all([
      supabase.from('teachers').select('*').order('created_at', { ascending: false }),
      supabase.from('students').select('teacher_id'),
    ])
    const ts = (tList ?? []) as Teacher[]
    const ss = sList ?? []

    const cmap: Record<string, number> = {}
    for (const s of ss) cmap[s.teacher_id] = (cmap[s.teacher_id] ?? 0) + 1

    setTeachers(ts)
    setCounts(cmap)
    setStats({
      total:    ts.length,
      active:   ts.filter(t => t.plan === 'basic').length,
      free:     ts.filter(t => t.plan !== 'basic').length,
      students: ss.length,
    })
  }

  // — Plan change ————————————————————————————————————
  async function setPlan(teacherId: string, plan: string) {
    setSaveState(teacherId, 'saving')
    const { error } = await supabase.from('teachers').update({ plan }).eq('id', teacherId)
    setSaveState(teacherId, error ? 'error' : 'saved')
    if (!error) setTeachers(prev => prev.map(t => t.id === teacherId ? { ...t, plan } : t))
  }

  // — Add-on toggle ————————————————————————————————————
  async function toggleAddon(teacherId: string, addonId: string, isOn: boolean) {
    setSaveState(teacherId, 'saving')
    const teacher = teachers.find(t => t.id === teacherId)
    if (!teacher) return
    let addOns = [...(teacher.add_ons ?? [])]
    let studentsLimit = teacher.students_limit ?? 30
    if (isOn) {
      addOns = addOns.filter(a => a !== addonId)
      if (addonId === 'extra_students') studentsLimit = Math.max(30, studentsLimit - 10)
    } else {
      addOns = [...new Set([...addOns, addonId])]
      if (addonId === 'extra_students') studentsLimit += 10
    }
    const { error } = await supabase
      .from('teachers')
      .update({ add_ons: addOns, students_limit: studentsLimit })
      .eq('id', teacherId)
    setSaveState(teacherId, error ? 'error' : 'saved')
    if (!error) {
      setTeachers(prev =>
        prev.map(t => t.id === teacherId ? { ...t, add_ons: addOns, students_limit: studentsLimit } : t)
      )
    }
  }

  function setSaveState(id: string, state: SaveState) {
    setSaves(prev => ({ ...prev, [id]: state }))
    if (state === 'saved') setTimeout(() => setSaves(prev => ({ ...prev, [id]: 'idle' })), 2000)
  }

  // — Render states ————————————————————————————————————
  if (authed === null) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <div className="spinner"/>
    </div>
  )

  if (!authed) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', flexDirection:'column', gap:'1rem' }}>
      <div style={{ fontSize:'2rem' }}>🔒</div>
      <p style={{ color:'#6B7280', fontSize:'.95rem' }}>Acceso restringido</p>
      <a href="/" style={{ color:'#E8533A', fontSize:'.85rem' }}>← Volver al inicio</a>
    </div>
  )

  return (
    <div className="admin-root">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-left">
          <span className="admin-logo">🛡️</span>
          <div>
            <h1>TeachNest Admin</h1>
            <span>{ADMIN_EMAIL}</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:'.75rem' }}>
          <button className="btn btn-sm btn-outline" onClick={loadData}>↻ Actualizar</button>
          <a href="/" className="btn btn-sm btn-outline">← Salir</a>
        </div>
      </header>

      <div className="admin-body">
        {/* Stats */}
        <div className="admin-stats">
          <div className="admin-stat">
            <div className="admin-stat-n">{stats.total}</div>
            <div className="admin-stat-l">Academias totales</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-n" style={{ color:'#E8533A' }}>{stats.active}</div>
            <div className="admin-stat-l">Planes activos</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-n">{stats.free}</div>
            <div className="admin-stat-l">Pendientes de pago</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-n">{stats.students}</div>
            <div className="admin-stat-l">Alumnos totales</div>
          </div>
        </div>

        {/* Table */}
        <h2 className="admin-section-title">Academias registradas</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre / Email</th>
                <th>Institución</th>
                <th>Plan</th>
                <th>Add-ons</th>
                <th>Alumnos</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map(t => {
                const addOns = t.add_ons ?? []
                const stuCnt = counts[t.id] ?? 0
                const saveState = saves[t.id] ?? 'idle'
                return (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.full_name ?? '—'}</strong>
                      <br/>
                      <span className="admin-muted">{t.email}</span>
                    </td>
                    <td>{t.school_name ?? '—'}</td>
                    <td>
                      <select
                        className="admin-plan-sel"
                        value={t.plan}
                        onChange={e => setPlan(t.id, e.target.value)}
                      >
                        <option value="free">🔒 Free</option>
                        <option value="basic">✅ Basic</option>
                      </select>
                    </td>
                    <td>
                      <div className="admin-addons">
                        {ADDONS.map(a => {
                          const on = addOns.includes(a.id)
                          return (
                            <button
                              key={a.id}
                              className={`admin-addon-btn ${on ? 'addon-on' : 'addon-off'}`}
                              onClick={() => toggleAddon(t.id, a.id, on)}
                              title={on ? 'Click para desactivar' : 'Click para activar'}
                            >
                              {a.label}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                    <td className="admin-count">{stuCnt} / {t.students_limit ?? 30}</td>
                    <td>
                      {saveState === 'saving' && <span className="admin-saving">Guardando…</span>}
                      {saveState === 'saved'  && <span className="admin-saved">✓ Guardado</span>}
                      {saveState === 'error'  && <span className="admin-error">⚠ Error</span>}
                    </td>
                  </tr>
                )
              })}
              {teachers.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign:'center', color:'#6B7280', padding:'2rem' }}>Sin academias registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
