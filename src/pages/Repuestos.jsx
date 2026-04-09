import { useState, useEffect } from 'react'
import { api } from '../api'

const fmt = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

export default function Repuestos() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')

  const load = () => api('/api/repuestos').then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const filtered = data.filter(r =>
    r.codigo?.toLowerCase().includes(buscar.toLowerCase()) ||
    r.nombre?.toLowerCase().includes(buscar.toLowerCase()) ||
    r.categoria?.toLowerCase().includes(buscar.toLowerCase())
  )

  const categorias = [...new Set(data.map(r => r.categoria).filter(Boolean))]

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>

  return (
    <main className="p-6">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-gray-800" style={{fontFamily:'Poppins,sans-serif'}}>Catálogo de Repuestos</h1>
        <div className="flex items-center gap-3">
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por código, nombre o categoría..."
            className="border border-gray-300 rounded px-3 py-2 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-[#00863a]" />
        </div>
      </div>

      {/* Resumen por categoría */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {categorias.map(cat => (
          <div key={cat} className="bg-white rounded-lg shadow p-3 text-center cursor-pointer hover:ring-2 hover:ring-[#00863a]"
            onClick={() => setBuscar(cat)}>
            <p className="text-lg font-bold text-gray-800">{data.filter(r => r.categoria === cat).length}</p>
            <p className="text-xs text-gray-500">{cat}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3">Código</th><th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Categoría</th><th className="px-4 py-3">Equipo</th>
              <th className="px-4 py-3">Máquina</th><th className="px-4 py-3 text-right">Precio</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-medium text-[#00863a]">{r.codigo}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{r.nombre}</p>
                  <p className="text-xs text-gray-400">{r.descripcion}</p>
                </td>
                <td className="px-4 py-3"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{r.categoria}</span></td>
                <td className="px-4 py-3 text-gray-600 text-xs">{r.equipo || '-'}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{r.maquina || '-'}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(r.precio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-3">{filtered.length} repuestos encontrados</p>
    </main>
  )
}
