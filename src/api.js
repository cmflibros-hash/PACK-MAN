const API_BASE = import.meta.env.VITE_API_URL || ''
export const api = (path, opts) => fetch(API_BASE + path, opts)
