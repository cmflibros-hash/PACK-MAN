import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import logoPackmanNegro from '../assets/Logo-Packman-Negro.svg'
import { api } from '../api'

const clp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0
})

const emptyItem = () => ({
  tipo: 'manual',
  inventario_id: '',
  descripcion: '',
  cantidad: 1,
  precio_unitario: 0,
  descuento_pct: 0
})

const createInitialForm = () => ({
  fecha: new Date().toISOString().slice(0, 10),
  cliente_id: '',
  atencion_a: '',
  validez_dias: 15,
  condiciones: '',
  observaciones: '',
  items: [emptyItem()]
})

const toNum = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const lineTotal = (item) => {
  const qty = Math.max(1, toNum(item.cantidad, 1))
  const unit = Math.max(0, toNum(item.precio_unitario, 0))
  const pct = Math.min(100, Math.max(0, toNum(item.descuento_pct, 0)))
  const base = qty * unit
  return Math.max(0, base * (1 - pct / 100))
}

const normalizeItem = (item) => ({
  tipo: item.tipo === 'inventario' ? 'inventario' : 'manual',
  inventario_id: item.tipo === 'inventario' && item.inventario_id ? Number(item.inventario_id) : null,
  descripcion: String(item.descripcion || '').trim(),
  cantidad: Math.max(1, toNum(item.cantidad, 1)),
  precio_unitario: Math.max(0, toNum(item.precio_unitario, 0)),
  descuento_pct: Math.min(100, Math.max(0, toNum(item.descuento_pct, 0)))
})

const imageUrlToDataUrl = (url) => new Promise((resolve, reject) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    resolve(canvas.toDataURL('image/png'))
  }
  img.onerror = reject
  img.src = url
})

const ESTADOS = [
  { key: 'emitida', label: 'Emitida', bg: 'bg-blue-100', text: 'text-blue-700' },
  { key: 'aprobada', label: 'Aprobada', bg: 'bg-green-100', text: 'text-green-700' },
  { key: 'rechazada', label: 'Rechazada', bg: 'bg-red-100', text: 'text-red-700' },
  { key: 'vencida', label: 'Vencida', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  { key: 'facturada', label: 'Facturada', bg: 'bg-purple-100', text: 'text-purple-700' }
]

const estadoInfo = (key) => ESTADOS.find((e) => e.key === key) || ESTADOS[0]

const formatDate = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

export default function Cotizaciones() {
  const { showToast } = useToast()
  const { ask } = useConfirm()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [printingId, setPrintingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  const [clientes, setClientes] = useState([])
  const [inventario, setInventario] = useState([])
  const [cotizaciones, setCotizaciones] = useState([])
  const [form, setForm] = useState(createInitialForm)

  const [filterEstado, setFilterEstado] = useState('')
  const [filterFechaInicio, setFilterFechaInicio] = useState('')
  const [filterFechaFin, setFilterFechaFin] = useState('')

  const invById = useMemo(() => {
    const map = new Map()
    for (const row of inventario) map.set(String(row.id), row)
    return map
  }, [inventario])

  const totals = useMemo(() => {
    const normalized = form.items.map(normalizeItem)
    const subtotal = normalized.reduce((acc, item) => acc + lineTotal(item), 0)
    const iva = subtotal * 0.19
    return { subtotal, iva, total: subtotal + iva }
  }, [form.items])

  const filteredCotizaciones = useMemo(() => {
    let result = cotizaciones

    if (filterEstado) {
      result = result.filter((c) => (c.estado || 'emitida') === filterEstado)
    }

    if (filterFechaInicio) {
      result = result.filter((c) => c.fecha && c.fecha.slice(0, 10) >= filterFechaInicio)
    }

    if (filterFechaFin) {
      result = result.filter((c) => c.fecha && c.fecha.slice(0, 10) <= filterFechaFin)
    }

    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter((c) => {
        const hay = `${c.id || ''} ${c.cliente_nombre || ''} ${c.atencion_a || ''} ${c.fecha || ''}`.toLowerCase()
        return hay.includes(q)
      })
    }

    return result
  }, [cotizaciones, search, filterEstado, filterFechaInicio, filterFechaFin])

  const loadAll = async () => {
    try {
      setLoading(true)
      const [rCotizaciones, rClientes, rInventario] = await Promise.all([
        api('/api/cotizaciones'),
        api('/api/clientes'),
        api('/api/inventario')
      ])

      if (!rCotizaciones.ok) throw new Error(`Cotizaciones: HTTP ${rCotizaciones.status}`)
      if (!rClientes.ok) throw new Error(`Clientes: HTTP ${rClientes.status}`)
      if (!rInventario.ok) throw new Error(`Inventario: HTTP ${rInventario.status}`)

      const [jCotizaciones, jClientes, jInventario] = await Promise.all([
        rCotizaciones.json(),
        rClientes.json(),
        rInventario.json()
      ])

      setCotizaciones(Array.isArray(jCotizaciones) ? jCotizaciones : [])
      setClientes(Array.isArray(jClientes) ? jClientes : [])
      setInventario(Array.isArray(jInventario) ? jInventario : [])
    } catch (err) {
      showToast(err.message || 'No se pudieron cargar las cotizaciones', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }))
  }

  const removeItem = (idx) => {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev
      return { ...prev, items: prev.items.filter((_, i) => i !== idx) }
    })
  }

  const updateItem = (idx, patch) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    }))
  }

  const handleTipoChange = (idx, tipo) => {
    if (tipo === 'manual') {
      updateItem(idx, { tipo, inventario_id: '', descripcion: '', precio_unitario: 0 })
      return
    }

    const firstInv = inventario[0]
    if (!firstInv) {
      showToast('No hay items de inventario para seleccionar', 'error')
      return
    }

    updateItem(idx, {
      tipo,
      inventario_id: firstInv.id,
      descripcion: `${firstInv.codigo || ''} - ${firstInv.nombre || 'Item inventario'}`.trim(),
      precio_unitario: toNum(firstInv.precio, 0)
    })
  }

  const handleInventarioChange = (idx, inventarioId) => {
    const selected = invById.get(String(inventarioId))
    if (!selected) return
    updateItem(idx, {
      inventario_id: selected.id,
      descripcion: `${selected.codigo || ''} - ${selected.nombre || 'Item inventario'}`.trim(),
      precio_unitario: toNum(selected.precio, 0)
    })
  }

  const openNew = () => {
    setForm(createInitialForm())
    setShowForm(true)
  }

  const closeNew = () => {
    setShowForm(false)
    setForm(createInitialForm())
  }

  const handleSave = async (e) => {
    e.preventDefault()

    if (!form.cliente_id) return showToast('Selecciona un cliente', 'error')

    const items = form.items.map(normalizeItem)
    if (items.some((it) => !it.descripcion)) {
      return showToast('Todos los items deben tener descripcion', 'error')
    }

    try {
      setSaving(true)
      const res = await api('/api/cotizaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: form.fecha,
          cliente_id: Number(form.cliente_id),
          atencion_a: form.atencion_a,
          validez_dias: Number(form.validez_dias) || 15,
          condiciones: form.condiciones,
          observaciones: form.observaciones,
          items
        })
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'No se pudo crear la cotizacion')

      showToast('Cotizacion creada correctamente')
      closeNew()
      await loadAll()
      await handlePrint(payload.id)
    } catch (err) {
      showToast(err.message || 'Error al crear cotizacion', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await ask({
      title: 'Eliminar cotizacion',
      message: 'Esta accion no se puede deshacer. Deseas continuar?',
      confirmText: 'Eliminar'
    })
    if (!ok) return

    try {
      const res = await api(`/api/cotizaciones/${id}`, { method: 'DELETE' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'No se pudo eliminar')
      showToast('Cotizacion eliminada')
      loadAll()
    } catch (err) {
      showToast(err.message || 'Error al eliminar', 'error')
    }
  }

  const handleEstadoChange = async (id, estado) => {
    try {
      const res = await api(`/api/cotizaciones/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado })
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'No se pudo actualizar estado')
      setCotizaciones((prev) => prev.map((c) => c.id === id ? { ...c, estado } : c))
    } catch (err) {
      showToast(err.message || 'Error al cambiar estado', 'error')
    }
  }

  const handlePrint = async (id) => {
    try {
      setPrintingId(id)
      const [res, logoDataUrl, jsPdfModule] = await Promise.all([
        api(`/api/cotizaciones/${id}`),
        imageUrlToDataUrl(logoPackmanNegro).catch(() => null),
        import('jspdf')
      ])

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'No se pudo obtener la cotizacion')

      const { cotizacion, items } = payload
      const { jsPDF } = jsPdfModule
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })

      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const margin = 12
      let y = 16

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', margin, y - 4, 35, 12)
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text('COTIZACION', pageW - margin, y, { align: 'right' })
      y += 6

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`N ${cotizacion.id}`, pageW - margin, y, { align: 'right' })
      y += 6

      const leftW = (pageW - margin * 2 - 4) / 2
      const drawBox = (x, top, title, lines) => {
        const h = 23
        doc.setDrawColor(210, 214, 220)
        doc.setFillColor(250, 251, 252)
        doc.roundedRect(x, top, leftW, h, 1.2, 1.2, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text(title, x + 2, top + 4)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        let ly = top + 8.5
        for (const line of lines) {
          doc.text(String(line || '-'), x + 2, ly)
          ly += 4.3
        }
      }

      drawBox(margin, y, 'Cliente', [
        cotizacion.cliente_nombre || '-',
        cotizacion.cliente_rut || '-',
        [cotizacion.cliente_direccion || '-', cotizacion.cliente_ciudad || ''].filter(Boolean).join(', ')
      ])

      drawBox(margin + leftW + 4, y, 'Documento', [
        `Fecha: ${formatDate(cotizacion.fecha)}`,
        `Atencion a: ${cotizacion.atencion_a || '-'}`,
        `Validez: ${cotizacion.validez_dias || 15} dias`
      ])
      y += 28

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Detalle', margin, y)
      y += 2

      const colQty = 14
      const colUnit = 24
      const colDisc = 14
      const colTotal = 24
      const colDesc = pageW - margin * 2 - colQty - colUnit - colDisc - colTotal

      const drawHeader = (top) => {
        doc.setFillColor(0, 134, 58)
        doc.setTextColor(255, 255, 255)
        doc.rect(margin, top, pageW - margin * 2, 7, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text('Descripcion', margin + 2, top + 4.8)
        doc.text('Cant.', margin + colDesc + colQty - 2, top + 4.8, { align: 'right' })
        doc.text('P. Unit', margin + colDesc + colQty + colUnit - 2, top + 4.8, { align: 'right' })
        doc.text('Desc%', margin + colDesc + colQty + colUnit + colDisc - 2, top + 4.8, { align: 'right' })
        doc.text('Total', margin + colDesc + colQty + colUnit + colDisc + colTotal - 2, top + 4.8, { align: 'right' })
        doc.setTextColor(20, 24, 32)
      }

      drawHeader(y)
      y += 7

      const safeItems = Array.isArray(items) ? items : []
      for (const item of safeItems) {
        const desc = String(item.descripcion || '-')
        const descLines = doc.splitTextToSize(desc, colDesc - 3)
        const rowH = Math.max(7, descLines.length * 4.3 + 2)

        if (y + rowH + 32 > pageH) {
          doc.addPage()
          y = margin
          drawHeader(y)
          y += 7
        }

        doc.setDrawColor(226, 232, 240)
        doc.rect(margin, y, colDesc, rowH)
        doc.rect(margin + colDesc, y, colQty, rowH)
        doc.rect(margin + colDesc + colQty, y, colUnit, rowH)
        doc.rect(margin + colDesc + colQty + colUnit, y, colDisc, rowH)
        doc.rect(margin + colDesc + colQty + colUnit + colDisc, y, colTotal, rowH)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.text(descLines, margin + 2, y + 4.7)
        doc.text(String(item.cantidad || 1), margin + colDesc + colQty - 2, y + 4.7, { align: 'right' })
        doc.text(clp.format(toNum(item.precio_unitario, 0)), margin + colDesc + colQty + colUnit - 2, y + 4.7, { align: 'right' })
        doc.text(String(toNum(item.descuento_pct, 0)), margin + colDesc + colQty + colUnit + colDisc - 2, y + 4.7, { align: 'right' })
        doc.text(clp.format(toNum(item.total_linea, 0)), margin + colDesc + colQty + colUnit + colDisc + colTotal - 2, y + 4.7, { align: 'right' })

        y += rowH
      }

      const drawTotals = () => {
        const boxW = 70
        const x = pageW - margin - boxW
        const h = 19
        doc.setFillColor(249, 250, 251)
        doc.setDrawColor(203, 213, 225)
        doc.roundedRect(x, y + 3, boxW, h, 1.2, 1.2, 'FD')

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text('Subtotal', x + 3, y + 8)
        doc.text(clp.format(toNum(cotizacion.subtotal, 0)), x + boxW - 3, y + 8, { align: 'right' })
        doc.text('IVA (19%)', x + 3, y + 12.5)
        doc.text(clp.format(toNum(cotizacion.iva, 0)), x + boxW - 3, y + 12.5, { align: 'right' })
        doc.setFont('helvetica', 'bold')
        doc.text('Total', x + 3, y + 17)
        doc.text(clp.format(toNum(cotizacion.total, 0)), x + boxW - 3, y + 17, { align: 'right' })
      }

      if (y + 48 > pageH) {
        doc.addPage()
        y = margin
      }

      drawTotals()
      y += 27

      const note = [
        cotizacion.condiciones ? `Condiciones: ${cotizacion.condiciones}` : '',
        cotizacion.observaciones ? `Observaciones: ${cotizacion.observaciones}` : ''
      ].filter(Boolean).join('   |   ')

      if (note) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        const lines = doc.splitTextToSize(note, pageW - margin * 2)
        doc.text(lines, margin, y)
        y += lines.length * 4.3 + 4
      }

      // ── Bloque aceptación cliente ──
      const acceptW = pageW - margin * 2
      const rowH = 7
      const dataRows = 4
      const dataH = rowH * dataRows
      const sigH = dataH
      const totalAcceptH = 7 + dataH + sigH // título + datos + firma
      const labelW = 45

      if (y + totalAcceptH + 12 > pageH) {
        doc.addPage()
        y = margin
      }

      y += 4

      // Título
      doc.setFillColor(0, 134, 58)
      doc.setTextColor(255, 255, 255)
      doc.rect(margin, y, acceptW, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.text('Datos de facturacion', margin + 2, y + 4.8)
      doc.setTextColor(20, 24, 32)
      y += 7

      // Filas de datos
      const dataFields = ['Nombre', 'RUT', 'Giro', '']
      doc.setDrawColor(210, 214, 220)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)

      for (let i = 0; i < dataFields.length; i++) {
        const ry = y + i * rowH
        // celda label
        doc.setFillColor(249, 250, 251)
        doc.rect(margin, ry, labelW, rowH, 'FD')
        // celda valor
        doc.setFillColor(255, 255, 255)
        doc.rect(margin + labelW, ry, acceptW - labelW, rowH, 'FD')

        if (dataFields[i]) {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          doc.text(dataFields[i], margin + 2, ry + 4.8)
          doc.setFont('helvetica', 'normal')
        }
      }
      y += dataH

      // Area firma y timbre
      doc.setFillColor(232, 245, 237) // verde muy tenue
      doc.setDrawColor(200, 220, 208)
      doc.rect(margin, y, acceptW, sigH, 'FD')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 108)
      doc.text('Firma y timbre', margin + acceptW / 2, y + sigH / 2 + 1, { align: 'center' })
      doc.setTextColor(20, 24, 32)
      y += sigH + 4

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`Generado el ${new Date().toLocaleString('es-CL')}`, pageW - margin, pageH - 8, { align: 'right' })

      doc.save(`Cotizacion-${cotizacion.id}.pdf`)
    } catch (err) {
      showToast(err.message || 'No se pudo imprimir la cotizacion', 'error')
    } finally {
      setPrintingId(null)
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>

  return (
    <>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-gray-800" style={{ fontFamily: 'Poppins,sans-serif' }}>Cotizaciones</h1>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-[#00863a] hover:bg-[#006d2e] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nueva Cotizacion
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm items-end">
          <div>
            <label className="block text-gray-500 mb-1">Estado</label>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none"
            >
              <option value="">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e.key} value={e.key}>{e.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={filterFechaInicio}
              onChange={(e) => setFilterFechaInicio(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={filterFechaFin}
              onChange={(e) => setFilterFechaFin(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-500 mb-1">Buscar</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="N, cliente o fecha"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3">N</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Atencion</th>
              <th className="px-4 py-3 text-center">Items</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredCotizaciones.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-[#00863a]">#{c.id}</td>
                <td className="px-4 py-3 text-gray-700">{formatDate(c.fecha)}</td>
                <td className="px-4 py-3 text-gray-800">{c.cliente_nombre}</td>
                <td className="px-4 py-3 text-gray-700">{c.atencion_a || '-'}</td>
                <td className="px-4 py-3 text-center text-gray-700">{c.total_items || 0}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">{clp.format(toNum(c.total, 0))}</td>
                <td className="px-4 py-3 text-center">
                  <select
                    value={c.estado || 'emitida'}
                    onChange={(e) => handleEstadoChange(c.id, e.target.value)}
                    className={`text-xs font-medium rounded-full px-2 py-1 border-0 outline-none cursor-pointer ${estadoInfo(c.estado || 'emitida').bg} ${estadoInfo(c.estado || 'emitida').text}`}
                  >
                    {ESTADOS.map((e) => (
                      <option key={e.key} value={e.key}>{e.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePrint(c.id)}
                      disabled={printingId === c.id}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[#e6f4ec] text-[#00863a] hover:bg-[#d6ecdf] disabled:opacity-50"
                      title="Imprimir PDF"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[#e6f4ec] text-[#00863a] hover:bg-[#d6ecdf]"
                      title="Eliminar"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredCotizaciones.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No hay cotizaciones registradas</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeNew}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800" style={{ fontFamily: 'Poppins,sans-serif' }}>Nueva Cotizacion</h2>
              <button type="button" onClick={closeNew} className="text-gray-400 hover:text-gray-600 text-xl leading-none">x</button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setField('fecha', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                  <select
                    value={form.cliente_id}
                    onChange={(e) => setField('cliente_id', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none"
                    required
                  >
                    <option value="">Seleccionar cliente</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Validez (dias)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.validez_dias}
                    onChange={(e) => setField('validez_dias', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Atencion a</label>
                  <input
                    type="text"
                    value={form.atencion_a}
                    onChange={(e) => setField('atencion_a', e.target.value)}
                    placeholder="Nombre de contacto"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condiciones</label>
                  <input
                    type="text"
                    value={form.condiciones}
                    onChange={(e) => setField('condiciones', e.target.value)}
                    placeholder="Plazo, forma de pago, etc."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">Items</h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="inline-flex items-center gap-1 text-sm bg-[#00863a] text-white px-3 py-1.5 rounded-md hover:bg-[#006d2e]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar item
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                      <tr>
                        <th className="px-3 py-2 text-left">Tipo</th>
                        <th className="px-3 py-2 text-left">Inventario</th>
                        <th className="px-3 py-2 text-left">Descripcion</th>
                        <th className="px-3 py-2 text-right">Cant.</th>
                        <th className="px-3 py-2 text-right">P. Unit</th>
                        <th className="px-3 py-2 text-right">Desc%</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {form.items.map((row, idx) => {
                        const isInv = row.tipo === 'inventario'
                        const rowTotal = lineTotal(row)
                        return (
                          <tr key={`row-${idx}`} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <select
                                value={row.tipo}
                                onChange={(e) => handleTipoChange(idx, e.target.value)}
                                className="w-28 border border-gray-300 rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#00863a]"
                              >
                                <option value="manual">Manual</option>
                                <option value="inventario">Inventario</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={row.inventario_id || ''}
                                onChange={(e) => handleInventarioChange(idx, e.target.value)}
                                disabled={!isInv}
                                className="w-52 border border-gray-300 rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#00863a] disabled:bg-gray-100"
                              >
                                <option value="">Seleccionar</option>
                                {inventario.map((inv) => (
                                  <option key={inv.id} value={inv.id}>{inv.codigo} - {inv.nombre}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.descripcion}
                                onChange={(e) => updateItem(idx, { descripcion: e.target.value })}
                                placeholder={isInv ? 'Descripcion del item inventario' : 'Servicio o item libre'}
                                className="w-full min-w-[240px] border border-gray-300 rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#00863a]"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                value={row.cantidad}
                                onChange={(e) => updateItem(idx, { cantidad: e.target.value })}
                                className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm text-right outline-none focus:ring-2 focus:ring-[#00863a]"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                value={row.precio_unitario}
                                onChange={(e) => updateItem(idx, { precio_unitario: e.target.value })}
                                className="w-28 border border-gray-300 rounded-md px-2 py-1 text-sm text-right outline-none focus:ring-2 focus:ring-[#00863a]"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={row.descuento_pct}
                                onChange={(e) => updateItem(idx, { descuento_pct: e.target.value })}
                                className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm text-right outline-none focus:ring-2 focus:ring-[#00863a]"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-800">{clp.format(rowTotal)}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                                title="Quitar"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea
                  rows={3}
                  value={form.observaciones}
                  onChange={(e) => setField('observaciones', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00863a] focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-start-3 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
                  <div className="flex justify-between text-gray-700 mb-1">
                    <span>Subtotal</span>
                    <span>{clp.format(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700 mb-1">
                    <span>IVA (19%)</span>
                    <span>{clp.format(totals.iva)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-gray-800 border-t pt-1 mt-1">
                    <span>Total</span>
                    <span>{clp.format(totals.total)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeNew} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Cancelar</button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#00863a] hover:bg-[#006d2e] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Guardar e imprimir PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
