// src/pages/AuthPage.tsx
import { useState } from 'react'
import { auth } from '../lib/auth'

interface Props {
  onBack: () => void
  onSuccess: () => void
}

type Mode = 'login' | 'register'

export default function AuthPage({ onBack }: Props) {
  const [mode,       setMode]       = useState<Mode>('login')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [fullName,   setFullName]   = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await auth.signIn(email, password)
        // App.tsx onAuthChange se encarga del redirect
      } else {
        if (!fullName.trim())   throw new Error('Ingresá tu nombre completo.')
        if (!schoolName.trim()) throw new Error('Ingresá el nombre de tu institución.')
        await auth.signUp(email, password, fullName.trim(), schoolName.trim())
        setError('¡Listo! Revisá tu correo para confirmar tu cuenta.')
      }
    } catch (err: any) {
      setError(err.message ?? 'Ocurrió un error. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <button className="auth-back" onClick={onBack}>← Volver</button>
        <div className="auth-logo">🎓 TeachNest</div>

        <h2>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <div className="field">
                <label>Nombre completo</label>
                <input
                  type="text"
                  placeholder="María González"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Nombre de tu institución / aula</label>
                <input
                  type="text"
                  placeholder="Colegio San José"
                  value={schoolName}
                  onChange={e => setSchoolName(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className="field">
            <label>Correo electrónico</label>
            <input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className={`auth-error ${error.startsWith('¡Listo') ? 'auth-success' : ''}`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? 'Cargando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? (
            <>¿No tenés cuenta? <button onClick={() => { setMode('register'); setError('') }}>Registrarse</button></>
          ) : (
            <>¿Ya tenés cuenta? <button onClick={() => { setMode('login'); setError('') }}>Iniciar sesión</button></>
          )}
        </p>
      </div>
    </div>
  )
}
