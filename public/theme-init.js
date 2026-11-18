// The preference key is shared with the hydrated appearance control.
try {
  const saved = JSON.parse(localStorage.getItem('docrag.mono-glass.v1'))
  if (saved) {
    const root = document.documentElement
    if (saved.theme === 'light' || saved.theme === 'dark') root.dataset.theme = saved.theme
    if (saved.reduceMotion === true) root.dataset.motion = 'reduce'
    if (Number.isFinite(saved.intensity)) {
      const level = Math.min(100, Math.max(0, saved.intensity))
      root.style.setProperty('--glass-level', String(level / 100))
      root.dataset.glass = level < 25 ? 'low' : level > 75 ? 'high' : 'balanced'
    }
  }
} catch { /* The CSS system palette also works with storage disabled. */ }
