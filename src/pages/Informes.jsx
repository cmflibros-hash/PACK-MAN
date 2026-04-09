import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import logoPackmanNegro from '../assets/Logo-Packman-Negro.svg'
import { useToast } from '../context/ToastContext'
import { api } from '../api'

const clean = (v) => (v === null || v === undefined ? '-' : String(v).trim() || '-')

const imgToDataUrl = (url) => new Promise((resolve, reject) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext('2d').drawImage(img, 0, 0)
    resolve(c.toDataURL('image/png'))
  }
  img.onerror = reject
  img.src = url
})

const initialForm = () => ({
  cliente_id: '',
  maquina_id: '',
  tecnico_id: '',
  temporada_id: '',
  fecha_revision: new Date().toISOString().slice(0, 10),
  titulo: '',
  resumen: '',
  observaciones_generales: ''
})

const parseEvidenceList = (raw) => {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw !== 'string') return []
  const trimmed = raw.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      return Array.isArray(parsed) ? parsed.filter(Boolean) : []
    } catch {
      return []
    }
  }
  return [trimmed]
}

export default function Informes() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)

  const [informes, setInformes] = useState([])
  const [clientes, setClientes] = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [temporadas, setTemporadas] = useState([])

  const [maquinas, setMaquinas] = useState([])
  const [equipos, setEquipos] = useState([])
  const [componentesByEquipo, setComponentesByEquipo] = useState({})
  const [componentReviews, setComponentReviews] = useState({})
  const [equipOrder, setEquipOrder] = useState({})

  const [detail, setDetail] = useState(null)
  const [loadingPdfId, setLoadingPdfId] = useState(null)
  const [search, setSearch] = useState('')

  const loadAll = async () => {
    try {
      setLoading(true)
      const [i, c, t, te] = await Promise.all([
        api('/api/informes'), api('/api/clientes'), api('/api/tecnicos'), api('/api/temporadas')
      ])
      setInformes(await i.json())
      setClientes(await c.json())
      setTecnicos(await t.json())
      setTemporadas(await te.json())
    } catch {
      showToast('No se pudo cargar Informes', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const [form, setForm] = useState(initialForm)

  const filteredInformes = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return informes
    return informes.filter((inf) => `${inf.titulo || ''} ${inf.cliente_nombre || ''} ${inf.maquina_nombre || ''} ${inf.modelo_nombre || ''} ${inf.tecnico_nombre || ''}`.toLowerCase().includes(q))
  }, [informes, search])

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const onClienteChange = async (clienteId) => {
    setField('cliente_id', clienteId)
    setField('maquina_id', '')
    setEquipos([])
    setComponentesByEquipo({})
    setComponentReviews({})
    if (!clienteId) return setMaquinas([])
    const res = await api(`/api/maquinas?cliente_id=${clienteId}`)
    const m = await res.json()
    setMaquinas(Array.isArray(m) ? m : [])
  }

  const onMaquinaChange = async (maquinaId) => {
    setField('maquina_id', maquinaId)
    setEquipos([])
    setComponentesByEquipo({})
    setComponentReviews({})
    setEquipOrder({})
    const maq = maquinas.find((m) => String(m.id) === String(maquinaId))
    if (!maq?.modelo_id) return

    const rEq = await api(`/api/modelos/${maq.modelo_id}/equipos`)
    const eqs = await rEq.json()
    setEquipos(eqs)

    const orderObj = {}
    eqs.forEach((e, i) => { orderObj[e.id] = Number(e.orden_revision ?? i + 1) })
    setEquipOrder(orderObj)

    const entries = await Promise.all(eqs.map(async (e) => {
      const rComp = await api(`/api/equipos/${e.id}/componentes`)
      const comps = await rComp.json()
      return [e.id, comps]
    }))

    const compMap = Object.fromEntries(entries)
    const reviews = {}
    for (const list of Object.values(compMap)) {
      for (const c of list) {
        reviews[c.id] = {
          equipo_id: c.equipo_id,
          componente_id: c.id,
          revisado: false,
          detalle_revision: '',
          evidencia_fotos: [],
          necesita_cambio_repuesto: false
        }
      }
    }
    setComponentesByEquipo(compMap)
    setComponentReviews(reviews)

    if (!form.titulo) {
      const suggested = `Informe ${maq.cliente_nombre || ''} - ${maq.modelo_nombre || maq.modelo || 'Modelo'}`.trim()
      setField('titulo', suggested)
    }
  }

  const updateReview = (componentId, key, value) => {
    setComponentReviews((prev) => ({
      ...prev,
      [componentId]: { ...(prev[componentId] || {}), [key]: value }
    }))
  }

  const uploadEvidence = (componentId, files) => {
    const list = Array.from(files || [])
    if (!list.length) return
    list.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        setComponentReviews((prev) => {
          const current = prev[componentId] || {}
          const evidence = Array.isArray(current.evidencia_fotos) ? current.evidencia_fotos : []
          return {
            ...prev,
            [componentId]: {
              ...current,
              evidencia_fotos: [...evidence, reader.result]
            }
          }
        })
      }
      reader.readAsDataURL(file)
    })
  }

  const removeEvidence = (componentId, idx) => {
    setComponentReviews((prev) => {
      const current = prev[componentId] || {}
      const evidence = Array.isArray(current.evidencia_fotos) ? current.evidencia_fotos : []
      return {
        ...prev,
        [componentId]: {
          ...current,
          evidencia_fotos: evidence.filter((_, i) => i !== idx)
        }
      }
    })
  }

  const saveOrder = async () => {
    const maq = maquinas.find((m) => String(m.id) === String(form.maquina_id))
    if (!maq?.modelo_id) return
    const ordenes = Object.entries(equipOrder).map(([equipo_id, orden]) => ({ equipo_id: Number(equipo_id), orden: Number(orden) || 999 }))
    const res = await api(`/api/modelos/${maq.modelo_id}/equipos/orden`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ordenes })
    })
    if (!res.ok) return showToast('No se pudo guardar orden de equipos', 'error')
    showToast('Orden de equipos guardado')
    onMaquinaChange(form.maquina_id)
  }

  const submitInforme = async (e) => {
    e.preventDefault()
    if (!form.cliente_id || !form.maquina_id || !form.tecnico_id || !form.titulo.trim()) {
      return showToast('Completa cliente, maquina, tecnico y titulo', 'error')
    }

    try {
      setSaving(true)
      const payload = {
        ...form,
        componentes: Object.values(componentReviews)
      }
      const res = await api('/api/informes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'No se pudo crear informe')
      showToast('Informe y cubicacion generados')
      setForm(initialForm())
      setMaquinas([])
      setEquipos([])
      setComponentesByEquipo({})
      setComponentReviews({})
      setShowFormModal(false)
      loadAll()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (id, syncUrl = true) => {
    const res = await api(`/api/informes/${id}`)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(body.error || 'No se pudo abrir detalle', 'error')
    setDetail(body)
    if (syncUrl) {
      const next = new URLSearchParams(searchParams)
      next.set('id', String(id))
      setSearchParams(next)
    }
  }

  const closeDetail = () => {
    setDetail(null)
    const next = new URLSearchParams(searchParams)
    next.delete('id')
    setSearchParams(next)
  }

  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return
    if (detail?.informe?.id && String(detail.informe.id) === String(id)) return
    openDetail(id, false)
  }, [searchParams])

  const goToCubicacion = (cubicacionId) => {
    if (!cubicacionId) return
    navigate(`/cubicacion?id=${cubicacionId}`)
  }

  const generatePdf = async (informeId) => {
    try {
      setLoadingPdfId(informeId)
      const [res, logoData, jsPdfModule] = await Promise.all([
        api(`/api/informes/${informeId}`),
        imgToDataUrl(logoPackmanNegro).catch(() => null),
        import('jspdf')
      ])
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo generar PDF')
      const { jsPDF } = jsPdfModule
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
      const w = doc.internal.pageSize.getWidth()
      const h = doc.internal.pageSize.getHeight()
      const m = 12
      const contentW = w - m * 2
      let y = 16
      const ensure = (need = 10) => {
        if (y + need > h - 12) { doc.addPage(); y = 16 }
      }
      const section = (title) => {
        ensure(9)
        doc.setFillColor(240, 246, 242)
        doc.roundedRect(m, y, contentW, 7, 1, 1, 'F')
        doc.setTextColor(0, 95, 46)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(title, m + 2, y + 4.6)
        y += 9
      }
      const textLine = (label, value) => {
        doc.setTextColor(90, 90, 90)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        const lineTop = y + 3.6
        doc.text(label, m, lineTop)
        doc.setTextColor(25, 25, 25)
        doc.setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(clean(value), contentW - 28)
        doc.text(lines, m + 28, lineTop)
        y += Math.max(7, lines.length * 4.2 + 2.2)
      }
      const drawFittedImage = (imgData, boxX, boxY, boxW, boxH) => {
        const format = imgData?.startsWith('data:image/png') ? 'PNG' : 'JPEG'
        try {
          const props = doc.getImageProperties(imgData)
          const iw = props.width || boxW
          const ih = props.height || boxH
          const scale = Math.min(boxW / iw, boxH / ih)
          const rw = iw * scale
          const rh = ih * scale
          const ox = boxX + (boxW - rw) / 2
          const oy = boxY + (boxH - rh) / 2
          doc.addImage(imgData, format, ox, oy, rw, rh)
        } catch {
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(8)
          doc.setTextColor(130, 130, 130)
          doc.text('No se pudo renderizar imagen', boxX + 2, boxY + boxH / 2)
        }
      }

      if (logoData) doc.addImage(logoData, 'PNG', m, 10, 44, 10)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('INFORME TECNICO DE REVISION', w - m, 15, { align: 'right' })
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`N° ${data.informe.id} - ${clean(data.informe.fecha_revision || data.informe.fecha_emision)}`, w - m, 20, { align: 'right' })
      y = 28

      section('Resumen del Informe')
      textLine('Titulo:', data.informe.titulo)
      textLine('Cliente:', data.informe.cliente_nombre)
      textLine('Maquina:', `${clean(data.informe.maquina_nombre)} / ${clean(data.informe.modelo_nombre)}`)
      textLine('Tecnico:', data.informe.tecnico_nombre)
      textLine('Resumen:', data.informe.resumen)
      y += 2

      section('Revision por Equipos y Componentes')

      const byEquipo = {}
      for (const c of data.componentes || []) {
        const key = `${c.equipo_id}::${c.equipo_nombre}`
        if (!byEquipo[key]) byEquipo[key] = []
        byEquipo[key].push(c)
      }

      for (const [key, list] of Object.entries(byEquipo)) {
        const equipo = key.split('::')[1]
        ensure(8)
        doc.setFillColor(244, 248, 246)
        doc.rect(m, y, contentW, 7, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(equipo, m + 2, y + 4.6)
        y += 8

        for (const comp of list) {
          const compTitle = `${comp.revisado ? '[X]' : '[ ]'} ${clean(comp.componente_nombre)}`
          const titleLines = doc.splitTextToSize(compTitle, contentW - 8)
          const detailLines = doc.splitTextToSize(clean(comp.detalle_revision), contentW - 8)
          const statusLine = `Cambio repuesto: ${comp.necesita_cambio_repuesto ? 'SI' : 'NO'}`
          const rowH = Math.max(14, (titleLines.length * 4.1) + (detailLines.length * 3.8) + 8)
          ensure(rowH + 2)
          doc.setDrawColor(225, 225, 225)
          doc.rect(m, y, contentW, rowH)

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          doc.setTextColor(30, 30, 30)
          doc.text(titleLines, m + 2, y + 4.8)

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(50, 50, 50)
          doc.text(detailLines, m + 2, y + 4.8 + (titleLines.length * 4.1))

          doc.setFont('helvetica', 'bold')
          doc.setTextColor(comp.necesita_cambio_repuesto ? 170 : 40, comp.necesita_cambio_repuesto ? 30 : 120, 40)
          doc.text(statusLine, m + 2, y + rowH - 2.5)

          y += rowH + 1
        }

        const evidenciasEquipo = []
        list.forEach((c) => {
          const fotos = Array.isArray(c.evidencia_fotos) && c.evidencia_fotos.length
            ? c.evidencia_fotos.filter(Boolean)
            : parseEvidenceList(c.evidencia_foto)
          fotos.forEach((img, i) => {
            evidenciasEquipo.push({
              componente: `${clean(c.componente_nombre)}${fotos.length > 1 ? ` (${i + 1})` : ''}`,
              image: img
            })
          })
        })

        if (evidenciasEquipo.length) {
          y += 1
          section(`Evidencia fotografica - ${equipo}`)

          const gap = 4
          const colW = (contentW - gap) / 2
          const cardH = 58
          const imageH = 46

          for (let i = 0; i < evidenciasEquipo.length; i += 2) {
            ensure(cardH + 2)
            const row = [evidenciasEquipo[i] || null, evidenciasEquipo[i + 1] || null]

            row.forEach((ev, colIndex) => {
              const x = m + (colIndex * (colW + gap))
              const y0 = y

              doc.setDrawColor(215, 215, 215)
              doc.setFillColor(252, 252, 252)
              doc.roundedRect(x, y0, colW, cardH, 1.2, 1.2, 'FD')

              doc.setFillColor(245, 248, 246)
              doc.rect(x, y0, colW, 9, 'F')
              if (ev) {
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(7.5)
                doc.setTextColor(55, 55, 55)
                const title = doc.splitTextToSize(ev.componente, colW - 4)
                doc.text(title.slice(0, 2), x + 2, y0 + 4)

                doc.setDrawColor(230, 230, 230)
                doc.rect(x + 2, y0 + 10, colW - 4, imageH)
                drawFittedImage(ev.image, x + 2.5, y0 + 10.5, colW - 5, imageH - 1)
              } else {
                doc.setFont('helvetica', 'italic')
                doc.setFontSize(8)
                doc.setTextColor(150, 150, 150)
                doc.text('Sin evidencia', x + 2, y0 + 14)
              }
            })

            y += cardH + 3
          }
        }
      }

      section('Observaciones Generales')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(35, 35, 35)
      const obs = doc.splitTextToSize(clean(data.informe.observaciones_generales), contentW)
      ensure(obs.length * 4.2 + 2)
      doc.text(obs, m, y + 3)
      y += obs.length * 4.2 + 3

      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 180000)
    } catch (err) {
      showToast(err.message || 'Error creando PDF', 'error')
    } finally {
      setLoadingPdfId(null)
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>

  return (
    <main className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-800" style={{ fontFamily: 'Poppins,sans-serif' }}>Informes Técnicos</h1>
        <button onClick={() => setShowFormModal(true)} className="bg-[#00863a] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#006d2e]">+ Nuevo Informe</button>
      </div>

      <section className="bg-white rounded-lg shadow p-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título, cliente, máquina, modelo o técnico"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      </section>

      <section className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Titulo</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Modelo</th>
              <th className="px-4 py-3">Tecnico</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredInformes.map((inf) => (
              <tr key={inf.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{clean(inf.fecha_revision || inf.fecha_emision)}</td>
                <td className="px-4 py-3">{clean(inf.titulo)}</td>
                <td className="px-4 py-3">{clean(inf.cliente_nombre)}</td>
                <td className="px-4 py-3">{clean(inf.modelo_nombre)}</td>
                <td className="px-4 py-3">{clean(inf.tecnico_nombre)}</td>
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex items-center gap-2">
                    <button onClick={() => openDetail(inf.id)} className="h-8 w-8 rounded-full border border-gray-200 hover:border-[#00863a] hover:text-[#00863a] text-gray-600 inline-flex items-center justify-center" title="Ver detalle">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    {inf.cubicacion_id && (
                      <button onClick={() => goToCubicacion(inf.cubicacion_id)} className="h-8 w-8 rounded-full border border-gray-200 hover:border-blue-600 hover:text-blue-700 text-gray-600 inline-flex items-center justify-center" title="Ver cubicación asociada">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M9 7h6M9 11h6M9 15h3"/></svg>
                      </button>
                    )}
                    <button onClick={() => generatePdf(inf.id)} disabled={loadingPdfId === inf.id} className="h-8 w-8 rounded-full border border-gray-200 hover:border-gray-800 hover:text-gray-900 text-gray-600 inline-flex items-center justify-center disabled:opacity-50" title="PDF">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6"/><path d="M9 19h6"/><path d="M10 11h4"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredInformes.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">No hay informes para mostrar.</td></tr>}
          </tbody>
        </table>
      </section>

      {showFormModal && (
        <div className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-800">Nuevo Informe Técnico</h2>
              <button type="button" onClick={() => setShowFormModal(false)} className="text-gray-400 hover:text-gray-700 text-xl">x</button>
            </div>

            <form onSubmit={submitInforme} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cliente</label>
                  <select value={form.cliente_id} onChange={(e) => onClienteChange(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" required>
                    <option value="">Seleccionar...</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Máquina del cliente</label>
                  <select value={form.maquina_id} onChange={(e) => onMaquinaChange(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" required>
                    <option value="">Seleccionar...</option>
                    {maquinas.map((m) => <option key={m.id} value={m.id}>{m.nombre} · {m.modelo_nombre || m.modelo}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Técnico</label>
                  <select value={form.tecnico_id} onChange={(e) => setField('tecnico_id', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" required>
                    <option value="">Seleccionar...</option>
                    {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Temporada (opcional)</label>
                  <select value={form.temporada_id} onChange={(e) => setField('temporada_id', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                    <option value="">Sin temporada</option>
                    {temporadas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha revisión</label>
                  <input type="date" value={form.fecha_revision} onChange={(e) => setField('fecha_revision', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Título</label>
                  <input value={form.titulo} onChange={(e) => setField('titulo', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Resumen</label>
                  <textarea rows={3} value={form.resumen} onChange={(e) => setField('resumen', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Observaciones generales</label>
                  <textarea rows={3} value={form.observaciones_generales} onChange={(e) => setField('observaciones_generales', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
              </div>

              {equipos.length > 0 && (
                <section className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">Orden lógico de equipos del modelo</h3>
                    <button type="button" onClick={saveOrder} className="bg-gray-800 text-white px-3 py-1.5 rounded text-xs hover:bg-black">Guardar orden</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {equipos.map((e) => (
                      <div key={e.id} className="flex items-center gap-2 border rounded p-2">
                        <input type="number" min="1" value={equipOrder[e.id] ?? ''} onChange={(ev) => setEquipOrder((p) => ({ ...p, [e.id]: ev.target.value }))} className="w-20 border border-gray-300 rounded px-2 py-1 text-sm" />
                        <span className="text-sm text-gray-700">{e.nombre}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">Revisión por equipos y componentes</div>
                <div className="divide-y">
                  {equipos.map((e) => (
                    <div key={e.id} className="p-3 space-y-2">
                      <h4 className="font-semibold text-gray-800">{e.nombre}</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                            <tr>
                              <th className="px-2 py-2 text-left w-28">Revisado</th>
                              <th className="px-2 py-2 text-left">Componente</th>
                              <th className="px-2 py-2 text-left">Detalle de revisión</th>
                              <th className="px-2 py-2 text-left">Evidencia</th>
                              <th className="px-2 py-2 text-left w-40">Necesita cambio</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {(componentesByEquipo[e.id] || []).map((c) => {
                              const r = componentReviews[c.id] || {}
                              return (
                                <tr key={c.id}>
                                  <td className="px-2 py-2"><input type="checkbox" checked={!!r.revisado} onChange={(ev) => updateReview(c.id, 'revisado', ev.target.checked)} className="h-4 w-4" /></td>
                                  <td className="px-2 py-2 text-gray-700">{c.nombre}</td>
                                  <td className="px-2 py-2"><textarea rows={2} value={r.detalle_revision || ''} onChange={(ev) => updateReview(c.id, 'detalle_revision', ev.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-xs" /></td>
                                  <td className="px-2 py-2 space-y-1">
                                    <input type="file" accept="image/*" multiple onChange={(ev) => uploadEvidence(c.id, ev.target.files)} className="text-xs" />
                                    {(r.evidencia_fotos || []).length > 0 && (
                                      <div className="grid grid-cols-2 gap-1">
                                        {(r.evidencia_fotos || []).map((img, idx) => (
                                          <div key={idx} className="relative border rounded overflow-hidden">
                                            <img src={img} alt={`evidencia-${idx + 1}`} className="h-14 w-full object-cover" />
                                            <button type="button" onClick={() => removeEvidence(c.id, idx)} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded px-1 text-[10px]">x</button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-2 py-2"><input type="checkbox" checked={!!r.necesita_cambio_repuesto} onChange={(ev) => updateReview(c.id, 'necesita_cambio_repuesto', ev.target.checked)} className="h-4 w-4" /></td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                  {equipos.length === 0 && <p className="p-4 text-sm text-gray-500">Selecciona cliente y máquina para cargar equipos/componentes.</p>}
                </div>
              </section>

              <div className="flex gap-2">
                <button type="button" onClick={() => setShowFormModal(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-300">Cancelar</button>
                <button type="submit" disabled={saving} className="bg-[#00863a] text-white px-4 py-2 rounded text-sm hover:bg-[#006d2e] disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar Informe y Cubicación'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeDetail}>
          <div className="bg-white rounded-lg w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">{clean(detail.informe.titulo)}</h3>
              <button onClick={closeDetail} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <p><span className="text-gray-500">Cliente:</span> {clean(detail.informe.cliente_nombre)} · <span className="text-gray-500">Máquina:</span> {clean(detail.informe.maquina_nombre)} · <span className="text-gray-500">Modelo:</span> {clean(detail.informe.modelo_nombre)}</p>
              <p><span className="text-gray-500">Resumen:</span> {clean(detail.informe.resumen)}</p>
              <div className="border rounded-lg p-3">
                <p className="font-medium text-gray-700 mb-2">Revisión componentes</p>
                <div className="space-y-2">
                  {(detail.componentes || []).map((c) => (
                    <div key={c.id} className="border rounded p-2">
                      <p className="font-medium">{c.equipo_nombre} · {c.componente_nombre}</p>
                      <p className="text-xs text-gray-600">Revisado: {c.revisado ? 'Sí' : 'No'} · Cambio repuesto: {c.necesita_cambio_repuesto ? 'Sí' : 'No'}</p>
                      <p className="text-xs text-gray-700 mt-1">{clean(c.detalle_revision)}</p>
                    </div>
                  ))}
                </div>
              </div>
              {detail.cubicacion && (
                <div className="flex items-center gap-3">
                  <p className="text-xs text-gray-500">Cubicación asociada: #{detail.cubicacion.id} ({detail.cubicacion_items?.length || 0} filas)</p>
                  <button onClick={() => goToCubicacion(detail.cubicacion.id)} className="px-2.5 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700">Abrir cubicación</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
