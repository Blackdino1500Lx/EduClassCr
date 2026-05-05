import type { AppView } from '../App'
import { BookOpen, Users, BarChart2, CheckCircle, Brain, Shield } from 'lucide-react'

interface Props { setView: (v: AppView) => void }

export default function Landing({ setView }: Props) {
  return (
    <div className="landing-root">
      <nav className="landing-nav">
        <div className="nav-inner">
          <div className="nav-logo"><BookOpen size={22}/><span>EduClass</span></div>
          <div className="nav-links">
            <a href="#features">Servicios</a>
            <a href="#about">Acerca</a>
            <button className="btn-outline" onClick={() => setView('student')}>Soy Alumno</button>
            <button className="btn-primary" onClick={() => setView('teacher')}>Portal Docente</button>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-bg-shapes">
          <div className="shape s1"/><div className="shape s2"/><div className="shape s3"/>
        </div>
        <div className="hero-inner">
          <div className="hero-content">
            <span className="hero-badge">Clases particulares · Jóvenes y adultos</span>
            <h1>Aprende a tu<br/><em>ritmo</em>, con apoyo<br/>personalizado.</h1>
            <p>Clases de matemáticas, español, ciencias y más — con prácticas interactivas, seguimiento real y retroalimentación directa de tu tutora.</p>
            <div className="hero-ctas">
              <button className="btn-hero-primary" onClick={() => setView('student')}>Acceder como alumno</button>
              <button className="btn-hero-outline" onClick={() => setView('teacher')}>Área docente</button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-card hc1"><CheckCircle size={15} className="hc-icon"/><span>Práctica entregada ✓</span></div>
            <div className="hero-card hc2"><Brain size={15} className="hc-icon"/><span>Matemáticas · Intermedio</span></div>
            <div className="hero-card hc3"><BarChart2 size={15} className="hc-icon"/><span>Progreso del alumno</span></div>
            <div className="ill-circle"/>
            <div className="ill-dots">{Array.from({length:9}).map((_,i)=><div key={i} className="dot"/>)}</div>
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="features-inner">
          <div className="section-label">¿Qué ofrecemos?</div>
          <h2>Todo lo que necesitás<br/>en un solo lugar</h2>
          <div className="feat-grid">
            {[
              {icon:<Users size={22}/>, title:'Gestión de alumnos', desc:'Registrá cada estudiante con su grado y nivel. Asignales prácticas específicas según su avance.'},
              {icon:<BookOpen size={22}/>, title:'Prácticas por materia', desc:'Crea ejercicios de desarrollo para matemáticas y opción múltiple para el resto de materias.'},
              {icon:<Shield size={22}/>, title:'Anti-copiado en desarrollo', desc:'Las preguntas abiertas detectan pegado masivo de texto para garantizar respuestas propias.'},
              {icon:<BarChart2 size={22}/>, title:'Revisión y calificación', desc:'Revisá cada entrega, asignale puntaje y dejá una nota personalizada para el alumno.'},
              {icon:<Brain size={22}/>, title:'Niveles personalizados', desc:'Básico, intermedio o avanzado — el contenido se adapta al perfil de cada estudiante.'},
              {icon:<CheckCircle size={22}/>, title:'Acceso con PIN', desc:'Cada alumno entra con un PIN de 4 dígitos. Simple, seguro y sin necesidad de crear cuentas.'},
            ].map((f,i)=>(
              <div className="feat-card" key={i}>
                <div className="feat-icon">{f.icon}</div>
                <h3>{f.title}</h3><p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about" id="about">
        <div className="about-inner">
          <div className="about-text">
            <div className="section-label">Acerca de</div>
            <h2>Enseñanza personalizada,<br/>resultados reales.</h2>
            <p>Soy tutora particular especializada en clases individuales y grupos pequeños para jóvenes y adultos. Mi enfoque está en entender cómo aprende cada persona y adaptar el método a sus necesidades.</p>
            <p>Con este sistema puedo asignarte prácticas, revisar tu trabajo y darte retroalimentación directa — todo organizado y accesible desde cualquier dispositivo.</p>
            <button className="btn-primary" onClick={() => setView('student')}>Comenzar ahora</button>
          </div>
          <div className="about-stats">
            {[
              {n:'5+', label:'Materias disponibles'},
              {n:'3', label:'Niveles de dificultad'},
              {n:'100%', label:'Revisión personalizada'},
            ].map((s,i)=>(
              <div className="stat-card" key={i}>
                <span className="stat-n">{s.n}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="nav-logo"><BookOpen size={18}/><span>EduClass</span></div>
          <span>© 2026 EduClass <a href="https://edevcr.netlify.app/">powered by E+Dev</a> Todos los derechos reservados</span>
        </div>
      </footer>
    </div>
  )
}
