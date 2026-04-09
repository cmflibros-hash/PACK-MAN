import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { api } from '../api'

const empty = {
  nombre: '',
  fecha_inicio: '',
  fecha_fin: '',
  estado: 'planificada',
  descripcion: ''
}

const Badge = ({ value }) => {
  const c = { planificada: 'bg-blue-100 text-blue-800', 'en curso': 'bg-green-100 text-green-800', finalizada: 'bg-gray-100 text-gray-600' }
  return <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${c[value] || 'bg-gray-100 text-gray-600'}`}>{value || '-'}</span>
}

const fmtDate = (d) => (d ? String(d).slice(0, 10) : '-')

export default function Temporadas() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ ...empty })
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('todos')
  const [showResume, setShowResume] = useState(false)
  const [resumeLoading, setResumeLoading] = useState(false)
  const [resumeData, setResumeData] = useState(null)
  const { showToast } = useToast()
  const { ask } = useConfirm()

  const load = () => api('/api/temporadas').then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const summary = useMemo(() => {
    const total = data.length
    const enCurso = data.filter((t) => t.estado === 'en curso').length
    const planificadas = data.filter((t) => t.estado === 'planificada').length
    const finalizadas = data.filter((t) => t.estado === 'finalizada').length
    return { total, enCurso, planificadas, finalizadas }
  }, [data])

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.filter((t) => {
      const matchesEstado = estadoFilter === 'todos' ? true : String(t.estado) === estadoFilter
      const matchesText = !q
        ? true
        : `${t.nombre || ''} ${t.descripcion || ''}`.toLowerCase().includes(q)
      return matchesEstado && matchesText
    })
  }, [data, search, estadoFilter])

  const openCreate = () => {
    setEditId(null)
    setForm({ ...empty })
    setShowForm(true)
  }

  const openEdit = (t) => {
    setEditId(t.id)
    setForm({
      nombre: t.nombre || '',
      fecha_inicio: fmtDate(t.fecha_inicio),
      fecha_fin: fmtDate(t.fecha_fin),
      estado: t.estado || 'planificada',
      descripcion: t.descripcion || ''
    })
    setShowForm(true)
  }

  const openResume = async (t) => {
    try {
      setShowResume(true)
      setResumeLoading(true)
      setResumeData({ temporada: t, resumen: { totalReportes: t.totalReportes || 0, totalInformes: t.totalInformes || 0, totalCubicaciones: t.totalCubicaciones || 0 }, reportes: [], informes: [], cubicaciones: [] })
      const res = await api(`/api/temporadas/${t.id}/resumen`)
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'No se pudo cargar el resumen de temporada')
      setResumeData(payload)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setResumeLoading(false)
    }
  }

  const closeResume = () => {
    setShowResume(false)
    setResumeData(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim() || !form.fecha_inicio || !form.fecha_fin) return showToast('Completa nombre, inicio y fin', 'error')
    if (new Date(form.fecha_inicio).getTime() > new Date(form.fecha_fin).getTime()) return showToast('La fecha de inicio no puede ser mayor al fin', 'error')

    const url = editId ? `/api/temporadas/${editId}` : '/api/temporadas'
    const method = editId ? 'PUT' : 'POST'
    try {
      const res = await api(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'No se pudo guardar la temporada')
      setShowForm(false)
      setForm({ ...empty })
      setEditId(null)
      load()
      showToast(editId ? 'Temporada actualizada correctamente' : 'Temporada creada correctamente')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const remove = async (id) => {
    const ok = await ask({
      title: 'Eliminar temporada',
      message: '¿Seguro que deseas eliminar esta temporada?',
      confirmText: 'Eliminar'
    })
    if (!ok) return

    try {
      const res = await api(`/api/temporadas/${id}`, { method: 'DELETE' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'No se pudo eliminar la temporada')
      load()
      showToast('Temporada eliminada correctamente')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>

  return (
    <main className="p-6 space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-800" style={{ fontFamily: 'Poppins,sans-serif' }}>Temporadas</h1>
        <button onClick={openCreate} className="bg-[#00863a] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#006d2e]">+ Nueva Temporada</button>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="En curso" value={summary.enCurso} tone="green" />
        <SummaryCard label="Planificadas" value={summary.planificadas} tone="blue" />
        <SummaryCard label="Finalizadas" value={summary.finalizadas} tone="gray" />
      </section>

      <section className="bg-white rounded-xl shadow border border-gray-100 p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Buscar temporada</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre o descripción"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00863a]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Filtrar por estado</label>
            <select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="planificada">Planificada</option>
              <option value="en curso">En curso</option>
              <option value="finalizada">Finalizada</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-xs text-gray-500">
            Mostrando <strong className="text-gray-700">{filteredData.length}</strong> de <strong className="text-gray-700">{data.length}</strong> temporadas
          </p>
          <button
            type="button"
            onClick={() => { setSearch(''); setEstadoFilter('todos') }}
            className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Temporada</th>
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3">Fin</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Reportes</th>
              <th className="px-4 py-3 text-right">Informes</th>
              <th className="px-4 py-3 text-right">Cubicaciones</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredData.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openResume(t)}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{t.nombre}</p>
                  <p className="text-xs text-gray-500 mt-0.5 max-w-[280px] truncate">{t.descripcion || '-'}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(t.fecha_inicio)}</td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(t.fecha_fin)}</td>
                <td className="px-4 py-3"><Badge value={t.estado} /></td>
                <td className="px-4 py-3 text-right font-medium text-gray-700">{t.totalReportes || 0}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-700">{t.totalInformes || 0}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-700">{t.totalCubicaciones || 0}</td>
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(t) }} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100">Editar</button>
                    <button onClick={(e) => { e.stopPropagation(); remove(t.id) }} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">No hay resultados para el filtro aplicado</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-lg w-full max-w-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">{editId ? 'Editar' : 'Nueva'} Temporada</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-3">
              <Input label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Fecha inicio" type="date" value={form.fecha_inicio} onChange={(v) => setForm({ ...form, fecha_inicio: v })} required />
                <Input label="Fecha fin" type="date" value={form.fecha_fin} onChange={(v) => setForm({ ...form, fecha_fin: v })} required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Estado</label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="planificada">Planificada</option>
                  <option value="en curso">En curso</option>
                  <option value="finalizada">Finalizada</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="bg-[#00863a] text-white px-4 py-2 rounded text-sm hover:bg-[#006d2e]">Guardar</button>
                <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-300">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResume && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeResume}>
          <div className="bg-white rounded-lg w-full max-w-6xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="font-semibold text-gray-800">Resumen de Temporada</h2>
                <p className="text-xs text-gray-500 mt-1">{resumeData?.temporada?.nombre || '-'} · {fmtDate(resumeData?.temporada?.fecha_inicio)} a {fmtDate(resumeData?.temporada?.fecha_fin)}</p>
              </div>
              <button onClick={closeResume} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <SummaryCard label="Estado" value={resumeData?.temporada?.estado || '-'} tone="gray" />
                <SummaryCard label="HES" value={resumeData?.resumen?.totalReportes || 0} />
                <SummaryCard label="Informes" value={resumeData?.resumen?.totalInformes || 0} tone="blue" />
                <SummaryCard label="Cubicaciones" value={resumeData?.resumen?.totalCubicaciones || 0} tone="green" />
              </div>

              {resumeLoading ? (
                <p className="text-sm text-gray-500">Cargando datos de la temporada...</p>
              ) : (
                <>
                  <section className="border rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700">HES</h3>
                      <span className="text-xs text-gray-500">{resumeData?.reportes?.length || 0} registros</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left">ID</th>
                            <th className="px-3 py-2 text-left">Fecha</th>
                            <th className="px-3 py-2 text-left">Cliente</th>
                            <th className="px-3 py-2 text-left">Motivo</th>
                            <th className="px-3 py-2 text-left">Estado</th>
                            <th className="px-3 py-2 text-center">Acceso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(resumeData?.reportes || []).map((r) => (
                            <tr key={r.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">#{r.id}</td>
                              <td className="px-3 py-2">{fmtDate(r.fecha)}</td>
                              <td className="px-3 py-2">{r.cliente_nombre || '-'}</td>
                              <td className="px-3 py-2">{r.motivo || '-'}</td>
                              <td className="px-3 py-2"><Badge value={r.estado} /></td>
                              <td className="px-3 py-2 text-center">
                                <button onClick={() => navigate(`/reportes?id=${r.id}`)} className="text-xs px-2.5 py-1 rounded bg-[#00863a] text-white hover:bg-[#006d2e]">Abrir</button>
                              </td>
                            </tr>
                          ))}
                          {(resumeData?.reportes || []).length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500">Sin HES en esta temporada.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="border rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700">Informes</h3>
                      <span className="text-xs text-gray-500">{resumeData?.informes?.length || 0} registros</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left">ID</th>
                            <th className="px-3 py-2 text-left">Fecha</th>
                            <th className="px-3 py-2 text-left">Título</th>
                            <th className="px-3 py-2 text-left">Cliente</th>
                            <th className="px-3 py-2 text-center">Acceso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(resumeData?.informes || []).map((r) => (
                            <tr key={r.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">#{r.id}</td>
                              <td className="px-3 py-2">{fmtDate(r.fecha)}</td>
                              <td className="px-3 py-2">{r.titulo || '-'}</td>
                              <td className="px-3 py-2">{r.cliente_nombre || '-'}</td>
                              <td className="px-3 py-2 text-center">
                                <button onClick={() => navigate(`/informes?id=${r.id}`)} className="text-xs px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Abrir</button>
                              </td>
                            </tr>
                          ))}
                          {(resumeData?.informes || []).length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">Sin informes en esta temporada.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="border rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700">Cubicaciones</h3>
                      <span className="text-xs text-gray-500">{resumeData?.cubicaciones?.length || 0} registros</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left">ID</th>
                            <th className="px-3 py-2 text-left">Fecha</th>
                            <th className="px-3 py-2 text-left">Título</th>
                            <th className="px-3 py-2 text-left">Informe</th>
                            <th className="px-3 py-2 text-left">Estado</th>
                            <th className="px-3 py-2 text-center">Acceso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(resumeData?.cubicaciones || []).map((r) => (
                            <tr key={r.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">#{r.id}</td>
                              <td className="px-3 py-2">{fmtDate(r.fecha)}</td>
                              <td className="px-3 py-2">{r.titulo || '-'}</td>
                              <td className="px-3 py-2">#{r.informe_id} · {r.informe_titulo || '-'}</td>
                              <td className="px-3 py-2"><Badge value={r.estado} /></td>
                              <td className="px-3 py-2 text-center">
                                <button onClick={() => navigate(`/cubicacion?id=${r.id}`)} className="text-xs px-2.5 py-1 rounded bg-gray-800 text-white hover:bg-black">Abrir</button>
                              </td>
                            </tr>
                          ))}
                          {(resumeData?.cubicaciones || []).length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500">Sin cubicaciones en esta temporada.</td></tr>}
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

function SummaryCard({ label, value, tone = 'default' }) {
  const toneClasses = {
    default: 'border-gray-200 text-gray-700',
    green: 'border-green-200 text-green-700',
    blue: 'border-blue-200 text-blue-700',
    gray: 'border-slate-200 text-slate-700'
  }

  const displayValue = typeof value === 'number' ? value : (value || '-')

  return (
    <article className={`bg-white rounded-lg border shadow-sm p-3 ${toneClasses[tone] || toneClasses.default}`}>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{displayValue}</p>
    </article>
  )
}

function Input({ label, value, onChange, required, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00863a]"
      />
    </div>
  )
}
