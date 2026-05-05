import { useState } from 'react'
import Landing from './pages/Landing'
import StudentPortal from './pages/StudentPortal'
import TeacherPortal from './pages/TeacherPortal'

export type AppView = 'landing' | 'student' | 'teacher'

export default function App() {
  const [view, setView] = useState<AppView>('landing')
  return (
    <div className="min-h-screen">
      {view === 'landing' && <Landing setView={setView}/>}
      {view === 'student' && <StudentPortal setView={setView}/>}
      {view === 'teacher' && <TeacherPortal setView={setView}/>}
    </div>
  )
}
