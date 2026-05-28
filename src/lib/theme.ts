// src/lib/theme.ts
// Aplica colores personalizados si el add-on 'branding' está activo

export function applyTheme(
  primary?: string | null,
  secondary?: string | null,
  branded = false
) {
  if (!branded || !primary) return
  const root = document.documentElement
  root.style.setProperty('--coral', primary)
  if (secondary) root.style.setProperty('--teal', secondary)
}
