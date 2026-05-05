import { supabase } from './supabase'

export type Subject = 'Matemáticas' | 'Español' | 'Ciencias' | 'Estudios Sociales' | 'Inglés'
export type Grade   = '7° Grado' | '8° Grado' | '9° Grado' | '10° Grado' | '11° Grado' | 'Universitario' | 'Adulto'
export type Level   = 'Básico' | 'Intermedio' | 'Avanzado'

export interface Student {
  id: string; firstName: string; lastName: string
  grade: Grade; level: Level; pin: string; createdAt: string
}
export interface Question {
  id: string; text: string; type: 'open' | 'multiple'
  options?: string[]; correctOption?: number; points: number
  imageUrl?: string  // imagen adjunta (para gráficas de matemáticas)
}
export interface Lesson {
  id: string; title: string; subject: Subject
  content?: string       // texto enriquecido
  fileUrl?: string       // URL del PDF en Storage
  fileName?: string
  youtubeUrl?: string    // link de YouTube
  pageImages?: string[]  // URLs de páginas extraídas como imágenes
  assignedTo: string[]
  isActive: boolean
  createdAt: string
}
export interface Practice {
  id: string; title: string; subject: Subject; description: string
  questions: Question[]; assignedTo: string[]; dueDate?: string
  createdAt: string; isActive: boolean
  lessonId?: string      // lección asociada opcional
}
export interface Answer { questionId: string; value: string | number }
export interface Submission {
  id: string; practiceId: string; studentId: string; answers: Answer[]
  submittedAt: string; score?: number; reviewed: boolean
  teacherNote?: string; antiCheatFlags: string[]
}

// ── Mappers ──────────────────────────────────────────────────────
const toStudent  = (r: any): Student  => ({ id: r.id, firstName: r.first_name, lastName: r.last_name, grade: r.grade, level: r.level, pin: r.pin, createdAt: r.created_at })
const toPractice = (r: any): Practice => ({ id: r.id, title: r.title, subject: r.subject, description: r.description ?? '', questions: r.questions ?? [], assignedTo: r.assigned_to ?? [], dueDate: r.due_date ?? undefined, createdAt: r.created_at, isActive: r.is_active, lessonId: r.lesson_id ?? undefined })
const toLesson   = (r: any): Lesson   => ({ id: r.id, title: r.title, subject: r.subject, content: r.content ?? undefined, fileUrl: r.file_url ?? undefined, fileName: r.file_name ?? undefined, youtubeUrl: r.youtube_url ?? undefined, pageImages: r.page_images ?? undefined, assignedTo: r.assigned_to ?? [], isActive: r.is_active, createdAt: r.created_at })
const toSub      = (r: any): Submission => ({ id: r.id, practiceId: r.practice_id, studentId: r.student_id, answers: r.answers ?? [], submittedAt: r.submitted_at, score: r.score ?? undefined, reviewed: r.reviewed, teacherNote: r.teacher_note ?? undefined, antiCheatFlags: r.anti_cheat_flags ?? [] })

// ── DB ───────────────────────────────────────────────────────────
export const db = {
  students: {
    async getAll(): Promise<Student[]> {
      const { data, error } = await supabase.from('students').select('*').order('created_at')
      if (error) throw error; return (data ?? []).map(toStudent)
    },
    async add(s: Omit<Student, 'id'|'createdAt'>): Promise<Student> {
      const { data, error } = await supabase.from('students')
        .insert({ first_name: s.firstName, last_name: s.lastName, grade: s.grade, level: s.level, pin: s.pin })
        .select().single()
      if (error) throw error; return toStudent(data)
    },
    async delete(id: string) { const { error } = await supabase.from('students').delete().eq('id', id); if (error) throw error },
    async findByPin(pin: string): Promise<Student | null> {
      const { data, error } = await supabase.from('students').select('*').eq('pin', pin).maybeSingle()
      if (error) throw error; return data ? toStudent(data) : null
    },
    async isPinTaken(pin: string, excludeId?: string): Promise<boolean> {
      let q = supabase.from('students').select('id').eq('pin', pin)
      if (excludeId) q = q.neq('id', excludeId)
      const { data } = await q; return (data?.length ?? 0) > 0
    },
  },

  lessons: {
    async getAll(): Promise<Lesson[]> {
      const { data, error } = await supabase.from('lessons').select('*').order('created_at', { ascending: false })
      if (error) throw error; return (data ?? []).map(toLesson)
    },
    async add(l: Omit<Lesson, 'id'|'createdAt'>): Promise<Lesson> {
      const { data, error } = await supabase.from('lessons')
        .insert({ title: l.title, subject: l.subject, content: l.content ?? null, file_url: l.fileUrl ?? null, file_name: l.fileName ?? null, youtube_url: l.youtubeUrl ?? null, page_images: l.pageImages ?? null, assigned_to: l.assignedTo, is_active: l.isActive })
        .select().single()
      if (error) throw error; return toLesson(data)
    },
    async update(l: Lesson): Promise<void> {
      const { error } = await supabase.from('lessons')
        .update({ title: l.title, subject: l.subject, content: l.content ?? null, file_url: l.fileUrl ?? null, file_name: l.fileName ?? null, youtube_url: l.youtubeUrl ?? null, page_images: l.pageImages ?? null, assigned_to: l.assignedTo, is_active: l.isActive })
        .eq('id', l.id)
      if (error) throw error
    },
    async delete(id: string) { const { error } = await supabase.from('lessons').delete().eq('id', id); if (error) throw error },
    async forStudent(studentId: string): Promise<Lesson[]> {
      const { data, error } = await supabase.from('lessons').select('*').eq('is_active', true)
      if (error) throw error
      return (data ?? []).map(toLesson).filter(l => l.assignedTo.includes(studentId))
    },
  },

  practices: {
    async getAll(): Promise<Practice[]> {
      const { data, error } = await supabase.from('practices').select('*').order('created_at', { ascending: false })
      if (error) throw error; return (data ?? []).map(toPractice)
    },
    async add(p: Omit<Practice, 'id'|'createdAt'>): Promise<Practice> {
      const { data, error } = await supabase.from('practices')
        .insert({ title: p.title, subject: p.subject, description: p.description, questions: p.questions, assigned_to: p.assignedTo, due_date: p.dueDate || null, is_active: p.isActive, lesson_id: p.lessonId || null })
        .select().single()
      if (error) throw error; return toPractice(data)
    },
    async delete(id: string) { const { error } = await supabase.from('practices').delete().eq('id', id); if (error) throw error },
    async forStudent(studentId: string): Promise<Practice[]> {
      const { data, error } = await supabase.from('practices').select('*').eq('is_active', true)
      if (error) throw error
      return (data ?? []).map(toPractice).filter(p => p.assignedTo.includes(studentId))
    },
  },

  submissions: {
    async getAll(): Promise<Submission[]> {
      const { data, error } = await supabase.from('submissions').select('*').order('submitted_at', { ascending: false })
      if (error) throw error; return (data ?? []).map(toSub)
    },
    async add(s: Omit<Submission, 'id'|'submittedAt'>): Promise<Submission> {
      const { data, error } = await supabase.from('submissions')
        .insert({ practice_id: s.practiceId, student_id: s.studentId, answers: s.answers, score: s.score ?? null, reviewed: s.reviewed, teacher_note: s.teacherNote ?? null, anti_cheat_flags: s.antiCheatFlags })
        .select().single()
      if (error) throw error; return toSub(data)
    },
    async update(s: Submission) {
      const { error } = await supabase.from('submissions').update({ score: s.score ?? null, reviewed: s.reviewed, teacher_note: s.teacherNote ?? null }).eq('id', s.id)
      if (error) throw error
    },
    async exists(studentId: string, practiceId: string): Promise<boolean> {
      const { data } = await supabase.from('submissions').select('id').eq('student_id', studentId).eq('practice_id', practiceId).maybeSingle()
      return !!data
    },
  },

  storage: {
    async uploadFile(file: File): Promise<{ url: string; name: string }> {
      const ext  = file.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('materials').upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from('materials').getPublicUrl(path)
      return { url: data.publicUrl, name: file.name }
    },
  },
}

// ── Auth ─────────────────────────────────────────────────────────
export const auth = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error; return data.session
  },
  async signOut() { await supabase.auth.signOut() },
  async getSession() { const { data } = await supabase.auth.getSession(); return data.session },
  onAuthChange(cb: (session: any) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => cb(s))
    return () => subscription.unsubscribe()
  },
}
