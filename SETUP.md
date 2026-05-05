# EduClass · Guía de Setup con Supabase

## Paso 1 — Crear proyecto en Supabase

1. Entrá a https://supabase.com y creá una cuenta (es gratis)
2. Click en **New Project**
3. Dale un nombre: `educlass`
4. Elegí una región: `South America (São Paulo)` es la más cercana
5. Poné una contraseña fuerte para la DB y guardala
6. Esperá ~2 minutos a que se aprovisione

---

## Paso 2 — Crear las tablas (SQL)

1. En el dashboard de tu proyecto, andá a **SQL Editor** (ícono de terminal)
2. Click en **New query**
3. Pegá TODO el contenido del archivo `schema.sql` que está junto a este README
4. Click en **Run** (o Ctrl+Enter)
5. Deberías ver "Success. No rows returned"

---

## Paso 3 — Obtener las credenciales

1. Andá a **Settings → API** (en el menú lateral)
2. Copiá:
   - **Project URL** → `https://xxxxxxxx.supabase.co`
   - **anon / public key** → empieza con `eyJ...`

---

## Paso 4 — Configurar el .env

Abrí el archivo `.env` en la carpeta del proyecto y llenalo:

```env
VITE_SUPABASE_URL=https://TU_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

---

## Paso 5 — Crear la cuenta de la profe

1. En Supabase, andá a **Authentication → Users**
2. Click en **Add user → Create new user**
3. Poné el email y contraseña que vas a usar para entrar al portal docente
4. ¡Listo! Con esas credenciales entrás al Portal Docente

---

## Paso 6 — Correr la app en desarrollo

```bash
# En la carpeta del proyecto
pnpm install
pnpm dev
```

Abrí http://localhost:5173

---

## Paso 7 — Build para producción

```bash
pnpm build
```

La carpeta `dist/` la podés subir a:
- **Netlify** (drag & drop de la carpeta `dist`)
- **Vercel** (conectar el repo de GitHub)
- **GitHub Pages**

En cualquiera de estas plataformas también tenés que configurar las variables de entorno
(`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).

---

## Estructura del proyecto

```
src/
  lib/
    supabase.ts    # Cliente de Supabase
    data.ts        # Todas las operaciones con la BD
  pages/
    Landing.tsx    # Página principal
    StudentPortal.tsx  # Portal del alumno (acceso por PIN)
    TeacherPortal.tsx  # Portal docente (login con email/password)
  App.tsx
  index.css
schema.sql         # SQL para crear las tablas en Supabase
.env               # Variables de entorno (NO subir a GitHub)
```

---

## Flujo de uso

### La profe:
1. Entra al Portal Docente con email/contraseña
2. Crea alumnos → el sistema genera un PIN único de 4 dígitos
3. Crea prácticas → elige materia, preguntas, y a qué alumnos asignarlas
4. Cuando los alumnos entregan, las ve en "Revisiones" y les pone nota

### El alumno:
1. Entra al Portal del Alumno con su PIN de 4 dígitos
2. Ve sus prácticas asignadas pendientes
3. Responde (en Matemáticas no puede pegar texto)
4. Entrega → queda registrado en Supabase

---

## Notas de seguridad

- El PIN de alumnos es solo para identificación, no para proteger datos sensibles
- La profe tiene acceso completo con Supabase Auth (email + contraseña)
- Row Level Security está activo: usuarios autenticados tienen acceso total,
  anónimos solo pueden leer y crear submissions
- Para mayor seguridad en producción, considera usar Supabase Edge Functions
  para validar el PIN server-side en lugar de cliente

---

## Soporte

Si algo no funciona, verificá:
- Que el `.env` tenga las credenciales correctas (sin espacios, sin comillas extra)
- Que el schema SQL se corrió sin errores
- Que la cuenta de la profe fue creada en Authentication → Users
