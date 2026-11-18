// Apply the saved palette before first paint. System mode falls back to CSS.
try {
  const preference = JSON.parse(localStorage.getItem('docrag.mono-glass.v1'))?.theme
  if (preference === 'light' || preference === 'dark') {
    document.documentElement.dataset.theme = preference
  }
} catch { /* Storage can be disabled or contain an older invalid value. */ }
