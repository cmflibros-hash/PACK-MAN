import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { api } from '../api'

const emptyModelo = { nombre: '', marca: '', descripcion: '' }
const emptyEquipo = { nombre: '', modelo: '', descripcion: '' }
const emptyComponente = { nombre: '', descripcion: '' }
const emptyItem = { repuesto_id: '', cantidad: 1 }

export default function Modelos() {
  const [loading, setLoading] = useState(true)
  const [modelos, setModelos] = useState([])
  const [equipos, setEquipos] = useState([])
  const [componentes, setComponentes] = useState([])
  const [componenteItems, setComponenteItems] = useState([])
  const [resumenRepuestos, setResumenRepuestos] = useState([])
  const [inventarioItems, setInventarioItems] = useState([])

  const [selectedModeloId, setSelectedModeloId] = useState(null)
  const [selectedEquipoId, setSelectedEquipoId] = useState(null)
  const [selectedComponenteId, setSelectedComponenteId] = useState(null)

  const [showModeloModal, setShowModeloModal] = useState(false)
  const [showEquipoModal, setShowEquipoModal] = useState(false)
  const [showComponenteModal, setShowComponenteModal] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)

  const [modeloEditId, setModeloEditId] = useState(null)
  const [equipoEditId, setEquipoEditId] = useState(null)
  const [componenteEditId, setComponenteEditId] = useState(null)

  const [modeloForm, setModeloForm] = useState(emptyModelo)
  const [equipoForm, setEquipoForm] = useState(emptyEquipo)
  const [componenteForm, setComponenteForm] = useState(emptyComponente)
  const [itemForm, setItemForm] = useState(emptyItem)

  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { ask } = useConfirm()

  const apiJson = async (url, options) => {
    const res = await fetch(url, options)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Error en la operación')
    return data
  }

  const loadBase = async () => {
    setLoading(true)
    try {
      const [m, inv] = await Promise.all([
        api('/api/modelos').then(r => r.json()),
        api('/api/inventario').then(r => r.json())
      ])
      setModelos(m)
      setInventarioItems(inv)
      if (!selectedModeloId && m.length) setSelectedModeloId(m[0].id)
    } finally {
      setLoading(false)
    }
  }

  const loadModeloData = async (modeloId) => {
    if (!modeloId) return
    const [eq, rep] = await Promise.all([
      api(`/api/modelos/${modeloId}/equipos`).then(r => r.json()),
      api(`/api/modelos/${modeloId}/repuestos`).then(r => r.json())
    ])
    setEquipos(eq)
    setResumenRepuestos(rep)
    if (!eq.find(e => e.id === selectedEquipoId)) {
      setSelectedEquipoId(eq[0]?.id || null)
      setSelectedComponenteId(null)
      setComponentes([])
      setComponenteItems([])
    }
  }

  const loadEquipoData = async (equipoId) => {
    if (!equipoId) return
    const comps = await api(`/api/equipos/${equipoId}/componentes`).then(r => r.json())
    setComponentes(comps)
    if (!comps.find(c => c.id === selectedComponenteId)) {
      setSelectedComponenteId(comps[0]?.id || null)
      setComponenteItems([])
    }
  }

  const loadComponenteItems = async (componenteId) => {
    if (!componenteId) return
    const items = await api(`/api/componentes/${componenteId}/items`).then(r => r.json())
    setComponenteItems(items)
  }

  useEffect(() => { loadBase() }, [])
  useEffect(() => { if (selectedModeloId) loadModeloData(selectedModeloId) }, [selectedModeloId])
  useEffect(() => { if (selectedEquipoId) loadEquipoData(selectedEquipoId) }, [selectedEquipoId])
  useEffect(() => { if (selectedComponenteId) loadComponenteItems(selectedComponenteId) }, [selectedComponenteId])

  const selectedModelo = useMemo(() => modelos.find(m => m.id === selectedModeloId), [modelos, selectedModeloId])

  const availableInvItems = useMemo(() => {
    const used = new Set(componenteItems.map(i => i.repuesto_id))
    return inventarioItems.filter(i => !used.has(i.repuesto_id))
  }, [inventarioItems, componenteItems])

  const openNewModelo = () => { setModeloEditId(null); setModeloForm(emptyModelo); setShowModeloModal(true) }
  const openEditModelo = (m) => { setModeloEditId(m.id); setModeloForm({ nombre: m.nombre || '', marca: m.marca || '', descripcion: m.descripcion || '' }); setShowModeloModal(true) }

  const saveModelo = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      await apiJson(modeloEditId ? `/api/modelos/${modeloEditId}` : '/api/modelos', {
        method: modeloEditId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modeloForm)
      })
      setShowModeloModal(false)
      await loadBase()
      showToast(modeloEditId ? 'Modelo actualizado' : 'Modelo creado')
    } catch (err) { showToast(err.message, 'error') } finally { setSaving(false) }
  }

  const removeModelo = async (id) => {
    const ok = await ask({ title: 'Eliminar modelo', message: 'Se eliminarán sus equipos/componentes asociados. ¿Continuar?' })
    if (!ok) return
    try {
      setSaving(true)
      await apiJson(`/api/modelos/${id}`, { method: 'DELETE' })
      if (selectedModeloId === id) {
        setSelectedModeloId(null)
        setSelectedEquipoId(null)
        setSelectedComponenteId(null)
      }
      await loadBase()
      showToast('Modelo eliminado')
    } catch (err) { showToast(err.message, 'error') } finally { setSaving(false) }
  }

  const openNewEquipo = () => { setEquipoEditId(null); setEquipoForm(emptyEquipo); setShowEquipoModal(true) }
  const openEditEquipo = (e) => { setEquipoEditId(e.id); setEquipoForm({ nombre: e.nombre || '', modelo: e.modelo || '', descripcion: e.descripcion || '' }); setShowEquipoModal(true) }

  const saveEquipo = async (e) => {
    e.preventDefault()
    if (!selectedModeloId) return
    try {
      setSaving(true)
      await apiJson(equipoEditId ? `/api/equipos/${equipoEditId}` : `/api/modelos/${selectedModeloId}/equipos`, {
        method: equipoEditId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(equipoForm)
      })
      setShowEquipoModal(false)
      await loadModeloData(selectedModeloId)
      showToast(equipoEditId ? 'Equipo actualizado' : 'Equipo agregado al modelo')
    } catch (err) { showToast(err.message, 'error') } finally { setSaving(false) }
  }

  const removeEquipo = async (id) => {
    const ok = await ask({ title: 'Eliminar equipo', message: 'Se eliminarán sus componentes e items vinculados. ¿Continuar?' })
    if (!ok) return
    try {
      setSaving(true)
      await apiJson(`/api/equipos/${id}`, { method: 'DELETE' })
      if (selectedEquipoId === id) {
        setSelectedEquipoId(null)
        setSelectedComponenteId(null)
      }
      await loadModeloData(selectedModeloId)
      showToast('Equipo eliminado')
    } catch (err) { showToast(err.message, 'error') } finally { setSaving(false) }
  }

  const openNewComponente = () => { setComponenteEditId(null); setComponenteForm(emptyComponente); setShowComponenteModal(true) }
  const openEditComponente = (c) => { setComponenteEditId(c.id); setComponenteForm({ nombre: c.nombre || '', descripcion: c.descripcion || '' }); setShowComponenteModal(true) }

  const saveComponente = async (e) => {
    e.preventDefault()
    if (!selectedEquipoId) return
    try {
      setSaving(true)
      await apiJson(componenteEditId ? `/api/componentes/${componenteEditId}` : `/api/equipos/${selectedEquipoId}/componentes`, {
        method: componenteEditId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(componenteForm)
      })
      setShowComponenteModal(false)
      await loadEquipoData(selectedEquipoId)
      showToast(componenteEditId ? 'Componente actualizado' : 'Componente agregado')
    } catch (err) { showToast(err.message, 'error') } finally { setSaving(false) }
  }

  const removeComponente = async (id) => {
    const ok = await ask({ title: 'Eliminar componente', message: 'Se eliminarán sus items vinculados. ¿Continuar?' })
    if (!ok) return
    try {
      setSaving(true)
      await apiJson(`/api/componentes/${id}`, { method: 'DELETE' })
      if (selectedComponenteId === id) setSelectedComponenteId(null)
      await loadEquipoData(selectedEquipoId)
      showToast('Componente eliminado')
    } catch (err) { showToast(err.message, 'error') } finally { setSaving(false) }
  }

  const saveComponenteItem = async (e) => {
    e.preventDefault()
    if (!selectedComponenteId) return
    try {
      setSaving(true)
      await apiJson(`/api/componentes/${selectedComponenteId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repuesto_id: Number(itemForm.repuesto_id), cantidad: Number(itemForm.cantidad) || 1 })
      })
      setShowItemModal(false)
      setItemForm(emptyItem)
      await loadComponenteItems(selectedComponenteId)
      await loadModeloData(selectedModeloId)
      showToast('Item de inventario agregado al componente')
    } catch (err) { showToast(err.message, 'error') } finally { setSaving(false) }
  }

  const changeCantidadItem = async (id, cantidad) => {
    try {
      setSaving(true)
      await apiJson(`/api/componente-items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cantidad: Number(cantidad) || 1 })
      })
      await loadComponenteItems(selectedComponenteId)
      await loadModeloData(selectedModeloId)
      showToast('Cantidad actualizada')
    } catch (err) { showToast(err.message, 'error') } finally { setSaving(false) }
  }

  const removeComponenteItem = async (id) => {
    const ok = await ask({ title: 'Eliminar item del componente', message: '¿Quitar este item de la lista de repuestos requeridos?' })
    if (!ok) return
    try {
      setSaving(true)
      await apiJson(`/api/componente-items/${id}`, { method: 'DELETE' })
      await loadComponenteItems(selectedComponenteId)
      await loadModeloData(selectedModeloId)
      showToast('Item removido del componente')
    } catch (err) { showToast(err.message, 'error') } finally { setSaving(false) }
  }

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800" style={{ fontFamily: 'Poppins,sans-serif' }}>Modelos</h1>
        <button onClick={openNewModelo} className="rounded-lg bg-[#00863a] px-4 py-2 text-sm font-medium text-white hover:bg-[#006d2e]">+ Nuevo Modelo</button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-lg bg-white p-4 shadow">
          <div className="mb-3 text-sm font-semibold text-gray-700">Modelos de Máquina</div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {modelos.map(m => (
              <button key={m.id} onClick={() => setSelectedModeloId(m.id)} className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selectedModeloId === m.id ? 'border-[#00863a] bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <p className="font-medium text-gray-800">{m.nombre}</p>
                <p className="text-xs text-gray-500">{m.marca || 'Sin marca'} | Equipos: {m.totalEquipos}</p>
                <div className="mt-2 flex gap-2">
                  <span onClick={(e) => { e.stopPropagation(); openEditModelo(m) }} className="text-xs text-blue-600 hover:text-blue-800">Editar</span>
                  <span onClick={(e) => { e.stopPropagation(); removeModelo(m.id) }} className="text-xs text-red-600 hover:text-red-800">Eliminar</span>
                </div>
              </button>
            ))}
            {!modelos.length && <p className="text-sm text-gray-400">No hay modelos aún</p>}
          </div>
        </section>

        <section className="rounded-lg bg-white p-4 shadow">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-700">Equipos del Modelo</div>
            <button disabled={!selectedModeloId} onClick={openNewEquipo} className="text-xs text-[#00863a] hover:text-[#006d2e] disabled:opacity-40">+ Equipo</button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {equipos.map(e => (
              <button key={e.id} onClick={() => setSelectedEquipoId(e.id)} className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selectedEquipoId === e.id ? 'border-[#00863a] bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <p className="font-medium text-gray-800">{e.nombre}</p>
                <p className="text-xs text-gray-500">{e.modelo || 'Sin código de equipo'}</p>
                <div className="mt-2 flex gap-2">
                  <span onClick={(ev) => { ev.stopPropagation(); openEditEquipo(e) }} className="text-xs text-blue-600 hover:text-blue-800">Editar</span>
                  <span onClick={(ev) => { ev.stopPropagation(); removeEquipo(e.id) }} className="text-xs text-red-600 hover:text-red-800">Eliminar</span>
                </div>
              </button>
            ))}
            {!equipos.length && <p className="text-sm text-gray-400">Selecciona un modelo para ver equipos</p>}
          </div>
        </section>

        <section className="rounded-lg bg-white p-4 shadow">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-700">Componentes del Equipo</div>
            <button disabled={!selectedEquipoId} onClick={openNewComponente} className="text-xs text-[#00863a] hover:text-[#006d2e] disabled:opacity-40">+ Componente</button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {componentes.map(c => (
              <button key={c.id} onClick={() => setSelectedComponenteId(c.id)} className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selectedComponenteId === c.id ? 'border-[#00863a] bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <p className="font-medium text-gray-800">{c.nombre}</p>
                <p className="text-xs text-gray-500">{c.descripcion || 'Sin descripción'}</p>
                <div className="mt-2 flex gap-2">
                  <span onClick={(ev) => { ev.stopPropagation(); openEditComponente(c) }} className="text-xs text-blue-600 hover:text-blue-800">Editar</span>
                  <span onClick={(ev) => { ev.stopPropagation(); removeComponente(c.id) }} className="text-xs text-red-600 hover:text-red-800">Eliminar</span>
                </div>
              </button>
            ))}
            {!componentes.length && <p className="text-sm text-gray-400">Selecciona un equipo para ver componentes</p>}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg bg-white p-4 shadow">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-700">Items del Componente</div>
            <button disabled={!selectedComponenteId} onClick={() => setShowItemModal(true)} className="text-xs text-[#00863a] hover:text-[#006d2e] disabled:opacity-40">+ Vincular item</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500">
                <tr>
                  <th className="py-2">Código</th>
                  <th className="py-2">Item</th>
                  <th className="py-2 text-center">Cantidad</th>
                  <th className="py-2 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {componenteItems.map(i => (
                  <tr key={i.id}>
                    <td className="py-2 font-mono text-xs text-[#00863a]">{i.codigo}</td>
                    <td className="py-2 text-gray-700">{i.nombre}</td>
                    <td className="py-2 text-center">
                      <input type="number" min="1" value={i.cantidad} onChange={e => changeCantidadItem(i.id, e.target.value)} className="w-16 rounded border px-2 py-1 text-center text-xs" />
                    </td>
                    <td className="py-2 text-center">
                      <button onClick={() => removeComponenteItem(i.id)} className="text-xs text-red-600 hover:text-red-800">Quitar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!componenteItems.length && <p className="py-3 text-sm text-gray-400">Selecciona un componente para ver sus items</p>}
          </div>
        </section>

        <section className="rounded-lg bg-white p-4 shadow">
          <div className="mb-3 text-sm font-semibold text-gray-700">Repuestos Requeridos por Modelo</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500">
                <tr>
                  <th className="py-2">Código</th>
                  <th className="py-2">Item</th>
                  <th className="py-2 text-center">Necesita</th>
                  <th className="py-2 text-center">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {resumenRepuestos.map(r => (
                  <tr key={r.id}>
                    <td className="py-2 font-mono text-xs text-[#00863a]">{r.codigo}</td>
                    <td className="py-2 text-gray-700">{r.nombre}</td>
                    <td className="py-2 text-center font-semibold text-gray-700">{r.cantidad_total}</td>
                    <td className={`py-2 text-center font-semibold ${Number(r.stock_actual) < Number(r.cantidad_total) ? 'text-red-600' : 'text-green-600'}`}>{r.stock_actual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!resumenRepuestos.length && <p className="py-3 text-sm text-gray-400">Selecciona un modelo y agrega componentes con items</p>}
          </div>
        </section>
      </div>

      {showModeloModal && (
        <Modal title={modeloEditId ? 'Editar Modelo' : 'Nuevo Modelo'} onClose={() => setShowModeloModal(false)}>
          <form onSubmit={saveModelo} className="space-y-3">
            <Input label="Nombre" value={modeloForm.nombre} onChange={(v) => setModeloForm({ ...modeloForm, nombre: v })} required />
            <Input label="Marca" value={modeloForm.marca} onChange={(v) => setModeloForm({ ...modeloForm, marca: v })} />
            <TextArea label="Descripción" value={modeloForm.descripcion} onChange={(v) => setModeloForm({ ...modeloForm, descripcion: v })} />
            <Actions saving={saving} onCancel={() => setShowModeloModal(false)} />
          </form>
        </Modal>
      )}

      {showEquipoModal && (
        <Modal title={equipoEditId ? 'Editar Equipo' : 'Nuevo Equipo'} onClose={() => setShowEquipoModal(false)}>
          <form onSubmit={saveEquipo} className="space-y-3">
            <Input label="Nombre" value={equipoForm.nombre} onChange={(v) => setEquipoForm({ ...equipoForm, nombre: v })} required />
            <Input label="Código/Modelo de Equipo" value={equipoForm.modelo} onChange={(v) => setEquipoForm({ ...equipoForm, modelo: v })} />
            <TextArea label="Descripción" value={equipoForm.descripcion} onChange={(v) => setEquipoForm({ ...equipoForm, descripcion: v })} />
            <Actions saving={saving} onCancel={() => setShowEquipoModal(false)} />
          </form>
        </Modal>
      )}

      {showComponenteModal && (
        <Modal title={componenteEditId ? 'Editar Componente' : 'Nuevo Componente'} onClose={() => setShowComponenteModal(false)}>
          <form onSubmit={saveComponente} className="space-y-3">
            <Input label="Nombre" value={componenteForm.nombre} onChange={(v) => setComponenteForm({ ...componenteForm, nombre: v })} required />
            <TextArea label="Descripción" value={componenteForm.descripcion} onChange={(v) => setComponenteForm({ ...componenteForm, descripcion: v })} />
            <Actions saving={saving} onCancel={() => setShowComponenteModal(false)} />
          </form>
        </Modal>
      )}

      {showItemModal && (
        <Modal title="Vincular Item de Inventario" onClose={() => setShowItemModal(false)}>
          <form onSubmit={saveComponenteItem} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Item</label>
              <select value={itemForm.repuesto_id} onChange={(e) => setItemForm({ ...itemForm, repuesto_id: e.target.value })} required className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00863a]">
                <option value="">Seleccionar item...</option>
                {availableInvItems.map(i => (
                  <option key={i.repuesto_id} value={i.repuesto_id}>{i.codigo} - {i.nombre}</option>
                ))}
              </select>
            </div>
            <Input label="Cantidad" type="number" value={itemForm.cantidad} onChange={(v) => setItemForm({ ...itemForm, cantidad: v })} required min={1} />
            <Actions saving={saving} onCancel={() => setShowItemModal(false)} />
          </form>
        </Modal>
      )}
    </main>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button type="button" onClick={onClose} className="text-xl leading-none text-gray-400 hover:text-gray-600">x</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function Input({ label, value, onChange, required, type = 'text', min }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-500">{label}</label>
      <input
        type={type}
        min={min}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00863a]"
      />
    </div>
  )
}

function TextArea({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-500">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00863a]" />
    </div>
  )
}

function Actions({ saving, onCancel }) {
  return (
    <div className="flex gap-2 pt-2">
      <button disabled={saving} type="submit" className="rounded bg-[#00863a] px-4 py-2 text-sm text-white hover:bg-[#006d2e] disabled:opacity-50">Guardar</button>
      <button type="button" onClick={onCancel} className="rounded bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300">Cancelar</button>
    </div>
  )
}
