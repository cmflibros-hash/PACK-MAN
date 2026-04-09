import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { api } from '../api'

const empty = { nombre: '', rut: '', direccion: '', ciudad: '', telefono: '', email: '', contacto_principal: '' }

export default function Clientes() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...empty })
  const [editId, setEditId] = useState(null)
  const [showTrace, setShowTrace] = useState(false)
  const [traceLoading, setTraceLoading] = useState(false)
  const [traceClient, setTraceClient] = useState(null)
  const [traceData, setTraceData] = useState({ hes: [], informes: [], cubicaciones: [] })
  const { showToast } = useToast()
  const { ask } = useConfirm()

  const load = () => api('/api/clientes').then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const method = editId ? 'PUT' : 'POST'
    const url = editId ? `/api/clientes/${editId}` : '/api/clientes'
    api(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      .then(async (r) => {
        const payload = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(payload.error || 'No se pudo guardar el cliente')
        setShowForm(false)
        setForm({ ...empty })
        setEditId(null)
        load()
        showToast(editId ? 'Cliente actualizado correctamente' : 'Cliente creado correctamente')
      })
      .catch((err) => showToast(err.message, 'error'))
  }

  const handleEdit = (c) => { setForm(c); setEditId(c.id); setShowForm(true) }
  const openTrace = async (client) => {
    try {
      setTraceClient(client)
      setTraceData({ hes: [], informes: [], cubicaciones: [] })
      setShowTrace(true)
      setTraceLoading(true)
      const res = await api(`/api/clientes/${client.id}/trazabilidad`)
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'No se pudo cargar trazabilidad')
      setTraceData({
        hes: Array.isArray(payload.hes) ? payload.hes : [],
        informes: Array.isArray(payload.informes) ? payload.informes : [],
        cubicaciones: Array.isArray(payload.cubicaciones) ? payload.cubicaciones : []
      })
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setTraceLoading(false)
    }
  }

  const closeTrace = () => {
    setShowTrace(false)
    setTraceClient(null)
    setTraceData({ hes: [], informes: [], cubicaciones: [] })
  }

  const handleDelete = async (id) => {
    const ok = await ask({
      title: 'Eliminar cliente',
      message: '¿Seguro que deseas eliminar este cliente?',
      confirmText: 'Eliminar'
    })
    if (!ok) return

    api(`/api/clientes/${id}`, { method: 'DELETE' })
      .then(async (r) => {
        const payload = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(payload.error || 'No se pudo eliminar el cliente')
        load()
        showToast('Cliente eliminado correctamente')
      })
      .catch((err) => showToast(err.message, 'error'))
  }

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>

  return (
    <main className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800" style={{fontFamily:'Poppins,sans-serif'}}>Clientes</h1>
        <button onClick={() => { setForm({ ...empty }); setEditId(null); setShowForm(true) }}
          className="bg-[#00863a] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#006d2e] flex items-center gap-2">
          <span className="text-lg leading-none">+</span> Nuevo Cliente
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3">Nombre</th><th className="px-4 py-3">RUT</th>
              <th className="px-4 py-3">Ciudad</th><th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Teléfono</th><th className="px-4 py-3 text-center">Máquinas</th>
              <th className="px-4 py-3 text-center">Trazabilidad</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{c.nombre}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.rut}</td>
                <td className="px-4 py-3 text-gray-600">{c.ciudad}</td>
                <td className="px-4 py-3 text-gray-600">{c.contacto_principal}</td>
                <td className="px-4 py-3 text-gray-600">{c.telefono}</td>
                <td className="px-4 py-3 text-center">
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-medium">{c.totalMaquinas}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => openTrace(c)}
                    className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    Ver trazabilidad
                  </button>
                </td>
                <td className="px-4 py-3 text-center space-x-2">
                  <button onClick={() => handleEdit(c)} className="text-blue-600 hover:text-blue-800 text-xs">Editar</button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-800 text-xs">Eliminar</button>
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
              <h2 className="font-semibold text-gray-800">{editId ? 'Editar' : 'Nuevo'} Cliente</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-3">
              <Input label="Nombre" value={form.nombre} onChange={v => setForm({...form, nombre: v})} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="RUT" value={form.rut} onChange={v => setForm({...form, rut: v})} />
                <Input label="Ciudad" value={form.ciudad} onChange={v => setForm({...form, ciudad: v})} />
              </div>
              <Input label="Dirección" value={form.direccion} onChange={v => setForm({...form, direccion: v})} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Teléfono" value={form.telefono} onChange={v => setForm({...form, telefono: v})} />
                <Input label="Email" value={form.email} onChange={v => setForm({...form, email: v})} />
              </div>
              <Input label="Contacto Principal" value={form.contacto_principal} onChange={v => setForm({...form, contacto_principal: v})} />
              <div className="flex gap-2 pt-3">
                <button type="submit" className="bg-[#00863a] text-white px-4 py-2 rounded text-sm hover:bg-[#006d2e]">Guardar</button>
                <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-300">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTrace && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeTrace}>
          <div className="bg-white rounded-lg w-full max-w-6xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-white">
              <div>
                <h2 className="font-semibold text-gray-800">Trazabilidad del Cliente</h2>
                <p className="text-xs text-gray-500 mt-1">{traceClient?.nombre || '-'} · RUT: {traceClient?.rut || '-'}</p>
              </div>
              <button onClick={closeTrace} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="p-6 space-y-5">
              {traceLoading ? (
                <p className="text-sm text-gray-500">Cargando trazabilidad...</p>
              ) : (
                <>
                  <section className="border rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700">HES</h3>
                      <span className="text-xs text-gray-500">{traceData.hes.length} registros</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left">ID</th>
                            <th className="px-3 py-2 text-left">Fecha</th>
                            <th className="px-3 py-2 text-left">Motivo</th>
                            <th className="px-3 py-2 text-left">Máquina</th>
                            <th className="px-3 py-2 text-left">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {traceData.hes.map((r) => (
                            <tr key={r.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">#{r.id}</td>
                              <td className="px-3 py-2">{r.fecha || '-'}</td>
                              <td className="px-3 py-2">{r.motivo || '-'}</td>
                              <td className="px-3 py-2">{r.maquina_nombre || '-'}</td>
                              <td className="px-3 py-2">{r.estado || '-'}</td>
                            </tr>
                          ))}
                          {traceData.hes.length === 0 && (
                            <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">Sin HES para este cliente.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="border rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700">Informes</h3>
                      <span className="text-xs text-gray-500">{traceData.informes.length} registros</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left">ID</th>
                            <th className="px-3 py-2 text-left">Fecha</th>
                            <th className="px-3 py-2 text-left">Título</th>
                            <th className="px-3 py-2 text-left">Máquina / Modelo</th>
                            <th className="px-3 py-2 text-left">Cubicación</th>
                            <th className="px-3 py-2 text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {traceData.informes.map((r) => (
                            <tr key={r.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">#{r.id}</td>
                              <td className="px-3 py-2">{r.fecha_revision || r.fecha_emision || '-'}</td>
                              <td className="px-3 py-2">{r.titulo || '-'}</td>
                              <td className="px-3 py-2">{r.maquina_nombre || '-'} / {r.modelo_nombre || '-'}</td>
                              <td className="px-3 py-2">{r.cubicacion_id ? `#${r.cubicacion_id}` : '-'}</td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => navigate(`/informes?id=${r.id}`)}
                                  className="text-xs px-2.5 py-1 rounded bg-[#00863a] text-white hover:bg-[#006d2e]"
                                >
                                  Abrir informe
                                </button>
                              </td>
                            </tr>
                          ))}
                          {traceData.informes.length === 0 && (
                            <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500">Sin informes para este cliente.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="border rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700">Cubicaciones</h3>
                      <span className="text-xs text-gray-500">{traceData.cubicaciones.length} registros</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left">ID</th>
                            <th className="px-3 py-2 text-left">Fecha</th>
                            <th className="px-3 py-2 text-left">Título</th>
                            <th className="px-3 py-2 text-left">Informe</th>
                            <th className="px-3 py-2 text-left">Máquina / Modelo</th>
                            <th className="px-3 py-2 text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {traceData.cubicaciones.map((r) => (
                            <tr key={r.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">#{r.id}</td>
                              <td className="px-3 py-2">{r.fecha || '-'}</td>
                              <td className="px-3 py-2">{r.titulo || '-'}</td>
                              <td className="px-3 py-2">#{r.informe_id} · {r.informe_titulo || '-'}</td>
                              <td className="px-3 py-2">{r.maquina_nombre || '-'} / {r.modelo_nombre || '-'}</td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => navigate(`/cubicacion?id=${r.id}`)}
                                  className="text-xs px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                                >
                                  Abrir cubicación
                                </button>
                              </td>
                            </tr>
                          ))}
                          {traceData.cubicaciones.length === 0 && (
                            <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500">Sin cubicaciones para este cliente.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function Input({ label, value, onChange, required }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input value={value || ''} onChange={e => onChange(e.target.value)} required={required}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00863a]" />
    </div>
  )
}
