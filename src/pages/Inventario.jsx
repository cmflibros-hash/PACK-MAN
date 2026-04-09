import { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { api } from '../api'

const fmt = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
const emptyForm = { codigo: '', nombre: '', descripcion: '', precio: 0, categoria: '', stock: 0, stock_minimo: 5, ubicacion_bodega: '' }

export default function Inventario() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const { ask } = useConfirm()

  const apiJson = async (url, options) => {
    const res = await fetch(url, options)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Error en la operación')
    return data
  }

  const load = () => api('/api/inventario').then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openCreateModal = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEditModal = (item) => {
    setEditingId(item.id)
    setForm({
      codigo: item.codigo || '',
      nombre: item.nombre || '',
      descripcion: item.descripcion || '',
      precio: Number(item.precio) || 0,
      categoria: item.categoria || '',
      stock: Number(item.stock) || 0,
      stock_minimo: Number(item.stock_minimo) || 0,
      ubicacion_bodega: item.ubicacion_bodega || ''
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      await apiJson(editingId ? `/api/inventario/${editingId}` : '/api/inventario', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          precio: Number(form.precio) || 0,
          stock: Number(form.stock) || 0,
          stock_minimo: Number(form.stock_minimo) || 0
        })
      })
      closeModal()
      await load()
      showToast(editingId ? 'Item actualizado correctamente' : 'Item creado correctamente')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await ask({
      title: 'Eliminar item',
      message: '¿Seguro que deseas eliminar este item del inventario?',
      confirmText: 'Eliminar'
    })
    if (!ok) return

    try {
      setSaving(true)
      await apiJson(`/api/inventario/${id}`, { method: 'DELETE' })
      await load()
      showToast('Item eliminado correctamente')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const stockBajo = data.filter(i => i.stock <= i.stock_minimo).length
  const stockTotal = data.reduce((s, i) => s + i.stock, 0)
  const valorTotal = data.reduce((s, i) => s + i.stock * i.precio, 0)

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>

  return (
    <>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-gray-800" style={{fontFamily:'Poppins,sans-serif'}}>Inventario</h1>
        <button onClick={openCreateModal} className="flex items-center gap-2 bg-[#00863a] hover:bg-[#006d2e] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          Agregar Item
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Unidades</p>
          <p className="text-2xl font-bold text-gray-800">{stockTotal}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Valor Inventario</p>
          <p className="text-2xl font-bold text-gray-800">{fmt(valorTotal)}</p>
        </div>
        <div className={`rounded-lg shadow p-4 ${stockBajo > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <p className="text-sm text-gray-500">Items Stock Bajo</p>
          <p className={`text-2xl font-bold ${stockBajo > 0 ? 'text-red-600' : 'text-green-600'}`}>{stockBajo}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3">Código</th><th className="px-4 py-3">Repuesto</th>
              <th className="px-4 py-3">Categoría</th><th className="px-4 py-3 text-center">Stock</th>
              <th className="px-4 py-3 text-center">Mínimo</th><th className="px-4 py-3">Bodega</th>
              <th className="px-4 py-3 text-right">Precio Unit.</th><th className="px-4 py-3 text-right">Valor Stock</th>
              <th className="px-4 py-3">Último Ingreso</th><th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map(i => {
              const bajo = i.stock <= i.stock_minimo
              return (
                <tr key={i.id} className={bajo ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3 font-mono text-xs text-[#00863a]">{i.codigo}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{i.nombre}</td>
                  <td className="px-4 py-3"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{i.categoria}</span></td>
                  <td className="px-4 py-3 text-center"><span className={`font-bold ${bajo ? 'text-red-600' : 'text-gray-800'}`}>{i.stock}</span></td>
                  <td className="px-4 py-3 text-center text-gray-500">{i.stock_minimo}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{i.ubicacion_bodega}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmt(i.precio)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(i.stock * i.precio)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{i.ultimo_ingreso}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button type="button" disabled={saving} onClick={() => openEditModal(i)} className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[#e6f4ec] text-[#00863a] hover:bg-[#d6ecdf] disabled:opacity-50" title="Editar">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                      <button type="button" disabled={saving} onClick={() => handleDelete(i.id)} className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[#e6f4ec] text-[#00863a] hover:bg-[#d6ecdf] disabled:opacity-50" title="Eliminar">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Agregar Item */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg transform transition-all" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800" style={{fontFamily:'Poppins,sans-serif'}}>{editingId ? 'Editar Item de Inventario' : 'Agregar Item de Inventario'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                  <input type="text" required placeholder="Ej: ROD-SKF-6205" value={form.codigo} onChange={e => setForm({...form, codigo: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <input type="text" placeholder="Ej: Rodamientos" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" required placeholder="Nombre del repuesto" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input type="text" placeholder="Descripción breve (opcional)" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio Unit.</label>
                  <input type="number" min="0" required value={form.precio} onChange={e => setForm({...form, precio: +e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Inicial</label>
                  <input type="number" min="0" required value={form.stock} onChange={e => setForm({...form, stock: +e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mín.</label>
                  <input type="number" min="0" required value={form.stock_minimo} onChange={e => setForm({...form, stock_minimo: +e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación Bodega</label>
                <input type="text" placeholder="Ej: A-01-03" value={form.ubicacion_bodega} onChange={e => setForm({...form, ubicacion_bodega: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-[#00863a] hover:bg-[#006d2e] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
