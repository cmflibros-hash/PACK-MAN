import { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { api } from '../api'

const estados = ['operativa', 'en mantención', 'detenida']

const Badge = ({ estado }) => {
  const c = { operativa: 'bg-green-100 text-green-800', 'en mantención': 'bg-yellow-100 text-yellow-800', detenida: 'bg-red-100 text-red-800' }
  return <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${c[estado] || 'bg-gray-100 text-gray-600'}`}>{estado}</span>
}

export default function Maquinas() {
  const [data, setData] = useState([])
  const [clientes, setClientes] = useState([])
  const [modelos, setModelos] = useState([])
  const [filtro, setFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [inlineEstadoId, setInlineEstadoId] = useState(null)
  const [form, setForm] = useState({ cliente_id: '', modelo_id: '', serie: '', ubicacion: '', estado: 'operativa' })
  const { showToast } = useToast()
  const { ask } = useConfirm()

  const load = () => {
    const url = filtro ? `/api/maquinas?cliente_id=${filtro}` : '/api/maquinas'
    api(url).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [filtro])
  useEffect(() => { api('/api/clientes').then(r => r.json()).then(setClientes).catch(() => {}) }, [])
  useEffect(() => { api('/api/modelos').then(r => r.json()).then(setModelos).catch(() => {}) }, [])

  const openCreate = () => {
    setEditId(null)
    setForm({ cliente_id: '', modelo_id: '', serie: '', ubicacion: '', estado: 'operativa' })
    setShowForm(true)
  }

  const openEdit = (m) => {
    setEditId(m.id)
    setForm({
      cliente_id: m.cliente_id || '',
      modelo_id: m.modelo_id || '',
      serie: m.serie || '',
      ubicacion: m.ubicacion || '',
      estado: m.estado || 'operativa'
    })
    setShowForm(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const method = editId ? 'PUT' : 'POST'
    const url = editId ? `/api/maquinas/${editId}` : '/api/maquinas'
    api(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      .then(async (r) => {
        const payload = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(payload.error || 'No se pudo guardar la máquina')
        setShowForm(false)
        setEditId(null)
        load()
        showToast(editId ? 'Máquina actualizada correctamente' : 'Máquina creada correctamente')
      })
      .catch((err) => showToast(err.message, 'error'))
  }

  const updateEstadoInline = (id, estado) => {
    api(`/api/maquinas/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) })
      .then(async (r) => {
        const payload = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(payload.error || 'No se pudo actualizar el estado')
        setInlineEstadoId(null)
        load()
        showToast('Estado actualizado correctamente')
      })
      .catch((err) => showToast(err.message, 'error'))
  }

  const handleDelete = async (id) => {
    const ok = await ask({
      title: 'Eliminar máquina',
      message: '¿Seguro que deseas eliminar esta máquina?',
      confirmText: 'Eliminar'
    })
    if (!ok) return

    api(`/api/maquinas/${id}`, { method: 'DELETE' })
      .then(async (r) => {
        const payload = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(payload.error || 'No se pudo eliminar la máquina')
        load()
        showToast('Máquina eliminada correctamente')
      })
      .catch((err) => showToast(err.message, 'error'))
  }

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>

  return (
    <main className="p-6">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-gray-800" style={{fontFamily:'Poppins,sans-serif'}}>Máquinas</h1>
        <div className="flex items-center gap-3">
          <select value={filtro} onChange={e => setFiltro(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00863a]">
            <option value="">Todos los clientes</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <button onClick={openCreate}
            className="bg-[#00863a] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#006d2e] flex items-center gap-2">
            <span className="text-lg leading-none">+</span> Nuevo PIN
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3">Modelo</th><th className="px-4 py-3">N° Serie</th>
              <th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Ubicación</th>
              <th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map(m => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{m.modelo_nombre || m.modelo || 'Sin modelo'}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.serie}</td>
                <td className="px-4 py-3 text-gray-600">{m.cliente_nombre}</td>
                <td className="px-4 py-3 text-gray-600">{m.ubicacion}</td>
                <td className="px-4 py-3">
                  {inlineEstadoId === m.id ? (
                    <select
                      autoFocus
                      value={m.estado}
                      onBlur={() => setInlineEstadoId(null)}
                      onChange={e => updateEstadoInline(m.id, e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#00863a]"
                    >
                      {estados.map(es => <option key={es} value={es}>{es}</option>)}
                    </select>
                  ) : (
                    <button onClick={() => setInlineEstadoId(m.id)} className="cursor-pointer" title="Cambiar estado">
                      <Badge estado={m.estado} />
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex gap-2 justify-center">
                    <button type="button" onClick={() => openEdit(m)} className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[#e6f4ec] text-[#00863a] hover:bg-[#d6ecdf]" title="Editar">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button type="button" onClick={() => handleDelete(m.id)} className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[#e6f4ec] text-[#00863a] hover:bg-[#d6ecdf]" title="Eliminar">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">{editId ? 'Editar PIN' : 'Nuevo PIN'}</h2>
              <button onClick={() => { setShowForm(false); setEditId(null) }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cliente</label>
                <select value={form.cliente_id} onChange={e => setForm({...form, cliente_id: e.target.value})} required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00863a]">
                  <option value="">Seleccionar...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Modelo</label>
                <select value={form.modelo_id} onChange={e => setForm({...form, modelo_id: e.target.value})} required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00863a]">
                  <option value="">Seleccionar modelo...</option>
                  {modelos.map(m => <option key={m.id} value={m.id}>{m.nombre} {m.marca ? `- ${m.marca}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">N° Serie</label>
                <input value={form.serie} onChange={e => setForm({...form, serie: e.target.value})} required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00863a]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ubicación</label>
                <input value={form.ubicacion} onChange={e => setForm({...form, ubicacion: e.target.value})} required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00863a]" />
              </div>
              <div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Estado</label>
                  <select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00863a]">
                    <option value="operativa">Operativa</option><option value="en mantención">En mantención</option><option value="detenida">Detenida</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-3">
                <button type="submit" className="bg-[#00863a] text-white px-4 py-2 rounded text-sm hover:bg-[#006d2e]">Guardar</button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-300">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
