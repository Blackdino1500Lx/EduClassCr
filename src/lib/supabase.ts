import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY en el .env')
}

// EduClass vive en su propio schema. Los genéricos <any, 'educlass'> evitan
// que TypeScript exija 'public' (el build usa `tsc -b`).
// Auth y Storage no se ven afectados: usan sus propios schemas internos.
export const supabase = createClient<any, 'educlass'>(supabaseUrl, supabaseAnon, {
  db: { schema: 'educlass' },
})