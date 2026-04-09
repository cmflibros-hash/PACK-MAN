import { useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import logo from './assets/Logo-Packman-Blanco.svg'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Maquinas from './pages/Maquinas'
import Modelos from './pages/Modelos'
import Inventario from './pages/Inventario'
import Reportes from './pages/Reportes'
import Informes from './pages/Informes'
import Cubicacion from './pages/Cubicacion'
import Temporadas from './pages/Temporadas'
import Cotizaciones from './pages/Cotizaciones'

const menu = [
  { section: 'General', items: [
    { name: 'Dashboard', path: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  ]},
  { section: 'Gestión', items: [
    { name: 'Clientes', path: '/clientes', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { name: 'Máquinas', path: '/maquinas', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    { name: 'Modelos', path: '/modelos', icon: 'M4 7l8-4 8 4m-8 13V9m-8-2v10l8 4 8-4V7' },
  ]},
  { section: 'Bodega', items: [
    { name: 'Inventario', path: '/inventario', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  ]},
  { section: 'Operaciones', items: [
    { name: 'Reportes', path: '/reportes', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { name: 'Informes', path: '/informes', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { name: 'Cubicación', path: '/cubicacion', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { name: 'Cotizaciones', path: '/cotizaciones', icon: 'M9 14l2 2 4-4m5-2V7a2 2 0 00-2-2h-2M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h5m4 0h2a2 2 0 002-2v-5m-7-7a2 2 0 012-2h2a2 2 0 012 2m-4 0h4' },
  ]},
  { section: 'Planificación', items: [
    { name: 'Temporadas', path: '/temporadas', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  ]},
]

function App() {
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebar-expanded')
    return saved !== null ? JSON.parse(saved) : true
  })
  const toggleExpanded = () => setExpanded(prev => { const next = !prev; localStorage.setItem('sidebar-expanded', JSON.stringify(next)); return next })
  const location = useLocation()
  const isActive = (p) => p === '/' ? location.pathname === '/' : location.pathname.startsWith(p)

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-[#00863a] flex items-center justify-between px-4 h-12 shadow-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={toggleExpanded} className="flex flex-col justify-center items-center gap-[4px] w-8 h-8 focus:outline-none" aria-label="Menu">
            <span className={`block w-5 h-[2px] bg-white rounded transition-transform duration-300 ${!expanded ? 'translate-y-[3px] rotate-45' : ''}`}></span>
            <span className={`block w-5 h-[2px] bg-white rounded transition-opacity duration-300 ${!expanded ? 'opacity-0' : ''}`}></span>
            <span className={`block w-5 h-[2px] bg-white rounded transition-transform duration-300 ${!expanded ? '-translate-y-[3px] -rotate-45' : ''}`}></span>
          </button>
          <Link to="/"><img src={logo} alt="Packman" className="h-6" /></Link>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-white hover:text-white/80 focus:outline-none" aria-label="Configuración">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button className="text-white hover:text-white/80 focus:outline-none" aria-label="Cerrar sesión">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-48px)]">
        {/* Sidebar */}
        <aside
          className={`bg-white border-r border-gray-200 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${expanded ? 'w-60' : 'w-[60px]'}`}
        >
          <nav className="py-3 overflow-y-auto h-full">
            {menu.map(s => (
              <div key={s.section} className="mb-1">
                <p className={`px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap transition-opacity duration-300 ${expanded ? 'opacity-100' : 'opacity-0 h-0 py-0 overflow-hidden'}`}>{s.section}</p>
                {s.items.map(item => (
                  <Link key={item.path} to={item.path} title={!expanded ? item.name : undefined}
                    className={`flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${isActive(item.path) ? 'bg-[#00863a] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    <span className={`transition-opacity duration-300 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>{item.name}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/maquinas" element={<Maquinas />} />
            <Route path="/modelos" element={<Modelos />} />
            <Route path="/inventario" element={<Inventario />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/informes" element={<Informes />} />
            <Route path="/cubicacion" element={<Cubicacion />} />
            <Route path="/cotizaciones" element={<Cotizaciones />} />
            <Route path="/temporadas" element={<Temporadas />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
