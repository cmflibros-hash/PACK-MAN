import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import logoPackmanNegro from '../assets/Logo-Packman-Negro.svg'
import { api } from '../api'

const emptyItem = () => ({ cantidad: 1, descripcion: '', marcado: false })

const createInitialForm = () => ({
  fecha: new Date().toISOString().slice(0, 10),
  motivo: '',
  cliente_id: '',
  direccion: '',
  hora_llegada: '',
  hora_salida: '',
  tecnico_id: '',
  observaciones: '',
  nombre_cliente_terreno: '',
  rut_cliente_terreno: '',
  cargo_cliente_terreno: '',
  firma_cliente_terreno: '',
  firma_cliente_imagen: '',
  nombre_tecnico_terreno: '',
  rut_tecnico_terreno: '',
  cargo_tecnico_terreno: '',
  firma_tecnico_terreno: '',
  firma_tecnico_imagen: '',
  items: [emptyItem()]
})

const formatDate = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

const formatTime = (value) => {
  if (!value) return '-'
  return String(value).slice(0, 5)
}

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

const normalizeDisplayText = (value) => {
  if (value === null || value === undefined) return '-'
  let text = String(value)
  const fixes = [
    ['Agr??cola', 'Agrícola'], ['Guti??rrez', 'Gutiérrez'], ['Mec??nica', 'Mecánica'],
    ['Automatizaci??n', 'Automatización'], ['Hidr??ulica', 'Hidráulica'], ['Andr??s', 'Andrés'],
    ['Mar??a', 'María'], ['Fern??ndez', 'Fernández'], ['r??gido', 'rígido'],
    ['transmisi??n', 'transmisión'], ['hidr??ulico', 'hidráulico'], ['centr??fugo', 'centrífugo'],
    ['ret??n', 'retén'], ['gu??a', 'guía'], ['inspecci??n', 'inspección'], ['Revisi??n', 'Revisión'],
    ['Mantenci??n', 'Mantención'], ['??ptica', 'óptica'], ['met??licas', 'metálicas'],
    ['v??lvula', 'válvula'], ['cr??tica', 'crítica'], ['buj??as', 'bujías'],
    ['multip�gina', 'multipágina'], ['validaci�n', 'validación']
  ]
  for (const [bad, good] of fixes) {
    text = text.split(bad).join(good)
  }
  text = text.replace(/\uFFFD/g, '')
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
  text = text.replace(/\s{2,}/g, ' ').trim()
  return text || '-'
}

export default function Reportes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const { ask } = useConfirm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [reportes, setReportes] = useState([])
  const [clientes, setClientes] = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [showFormModal, setShowFormModal] = useState(false)
  const [form, setForm] = useState(createInitialForm)
  const [detail, setDetail] = useState(null)
  const [loadingPdfId, setLoadingPdfId] = useState(null)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [signatureTarget, setSignatureTarget] = useState('cliente')
  const [searchText, setSearchText] = useState('')
  const [filterCliente, setFilterCliente] = useState('')
  const [filterTecnico, setFilterTecnico] = useState('')
  const [didSign, setDidSign] = useState(false)
  const signatureCanvasRef = useRef(null)
  const isDrawingRef = useRef(false)

  const clientesById = useMemo(() => {
    const m = new Map()
    for (const c of clientes) m.set(String(c.id), c)
    return m
  }, [clientes])

  const filteredReportes = useMemo(() => {
      const q = normalizeDisplayText(searchText).toLowerCase()
    return reportes.filter((r) => {
      const byCliente = !filterCliente || String(r.cliente_id || '') === String(filterCliente)
      const byTecnico = !filterTecnico || String(r.tecnico_id || '') === String(filterTecnico)
        const haystack = normalizeDisplayText(`${r.motivo || ''} ${r.descripcion || ''} ${r.cliente_nombre || ''} ${r.tecnico_nombre || ''} ${r.fecha || ''}`).toLowerCase()
      const byText = !q || haystack.includes(q)
      return byCliente && byTecnico && byText
    })
  }, [reportes, searchText, filterCliente, filterTecnico])

  const loadAll = async () => {
    try {
      setLoading(true)
      const [rReportes, rClientes, rTecnicos] = await Promise.all([
        api('/api/reportes'),
        api('/api/clientes'),
        api('/api/tecnicos')
      ])
      const [jReportes, jClientes, jTecnicos] = await Promise.all([
        rReportes.json(),
        rClientes.json(),
        rTecnicos.json()
      ])
      setReportes(Array.isArray(jReportes) ? jReportes : [])
      setClientes(Array.isArray(jClientes) ? jClientes : [])
      setTecnicos(Array.isArray(jTecnicos) ? jTecnicos : [])
    } catch {
      showToast('No se pudo cargar reportes', 'error')
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

  const handleClienteChange = (clienteId) => {
    const cliente = clientesById.get(String(clienteId))
    setForm((prev) => ({
      ...prev,
      cliente_id: clienteId,
      direccion: cliente?.direccion || ''
    }))
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

  const updateItem = (idx, key, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === idx ? { ...item, [key]: value } : item))
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.motivo.trim()) return showToast('El motivo es obligatorio', 'error')
    if (!form.cliente_id) return showToast('Selecciona un cliente', 'error')

    try {
      setSaving(true)
      const res = await api('/api/reportes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'No se pudo guardar el reporte HES')

      showToast('Reporte HES guardado')
      setForm(createInitialForm())
      setShowFormModal(false)
      loadAll()
    } catch (err) {
      showToast(err.message || 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (id, syncUrl = true) => {
    try {
      const res = await api(`/api/reportes/${id}`)
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'No se pudo obtener el detalle')
      setDetail(payload)
      if (syncUrl) {
        const next = new URLSearchParams(searchParams)
        next.set('id', String(id))
        setSearchParams(next)
      }
    } catch (err) {
      showToast(err.message || 'Error al cargar detalle', 'error')
    }
  }

  const closeDetail = () => {
    setDetail(null)
    const next = new URLSearchParams(searchParams)
    next.delete('id')
    setSearchParams(next)
  }

  const handleDeleteReporte = async (reporteId) => {
    const ok = await ask({
      title: 'Eliminar HES',
      message: '¿Seguro que deseas eliminar este HES de forma definitiva?',
      confirmText: 'Eliminar'
    })
    if (!ok) return

    try {
      setDeletingId(reporteId)
      const res = await api(`/api/reportes/${reporteId}`, { method: 'DELETE' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'No se pudo eliminar el HES')

      if (detail?.reporte?.id === reporteId) {
        closeDetail()
      }
      showToast('HES eliminado correctamente')
      loadAll()
    } catch (err) {
      showToast(err.message || 'Error al eliminar HES', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return
    if (detail?.reporte?.id && String(detail.reporte.id) === String(id)) return
    openDetail(id, false)
  }, [searchParams])

  const currentSignatureImage = signatureTarget === 'tecnico'
    ? form.firma_tecnico_imagen
    : form.firma_cliente_imagen

  useEffect(() => {
    if (!showSignatureModal) return
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    if (currentSignatureImage) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      }
      img.src = currentSignatureImage
      setDidSign(true)
    } else {
      setDidSign(false)
    }
  }, [showSignatureModal, currentSignatureImage])

  const getCanvasPos = (event) => {
    const canvas = signatureCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const point = event.touches?.[0] || event
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (point.clientX - rect.left) * scaleX,
      y: (point.clientY - rect.top) * scaleY
    }
  }

  const startDraw = (event) => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { x, y } = getCanvasPos(event)
    isDrawingRef.current = true
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (event) => {
    if (!isDrawingRef.current) return
    event.preventDefault()
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { x, y } = getCanvasPos(event)
    ctx.lineTo(x, y)
    ctx.stroke()
    setDidSign(true)
  }

  const endDraw = () => {
    isDrawingRef.current = false
  }

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setDidSign(false)
  }

  const saveSignature = () => {
    if (!didSign) {
      showToast('Debes firmar antes de guardar', 'error')
      return
    }
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    setForm((prev) => signatureTarget === 'tecnico'
      ? {
          ...prev,
          firma_tecnico_imagen: dataUrl,
          firma_tecnico_terreno: prev.firma_tecnico_terreno || 'Firma digital'
        }
      : {
          ...prev,
          firma_cliente_imagen: dataUrl,
          firma_cliente_terreno: prev.firma_cliente_terreno || 'Firma digital'
        })
    setShowSignatureModal(false)
    showToast('Firma guardada')
  }

  const removeSignature = (target = signatureTarget) => {
    setForm((prev) => target === 'tecnico'
      ? { ...prev, firma_tecnico_imagen: '', firma_tecnico_terreno: '' }
      : { ...prev, firma_cliente_imagen: '', firma_cliente_terreno: '' })
    setDidSign(false)
  }

  const generatePdf = async (reporteId) => {
    try {
      setLoadingPdfId(reporteId)
      const [res, logoDataUrl, jsPdfModule] = await Promise.all([
        api(`/api/reportes/${reporteId}`),
        imageUrlToDataUrl(logoPackmanNegro).catch(() => null),
        import('jspdf')
      ])
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'No se pudo generar el PDF')

      const { jsPDF } = jsPdfModule
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const margin = 12
      let y = 14

      const ensureSpace = (needed = 12) => {
        if (y + needed > pageH - 14) {
          doc.addPage()
          y = 14
        }
      }

      const sectionTitle = (title) => {
        ensureSpace(10)
        doc.setFillColor(240, 246, 242)
        doc.roundedRect(margin, y, pageW - margin * 2, 7, 1.2, 1.2, 'F')
        doc.setTextColor(0, 95, 46)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(title, margin + 3, y + 4.8)
        y += 10
      }

      const drawField = (label, value, x, top, w, h = 11) => {
        doc.setDrawColor(215, 215, 215)
        doc.roundedRect(x, top, w, h, 1, 1)
        doc.setTextColor(110, 110, 110)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(label, x + 2, top + 3.4)
        doc.setTextColor(25, 25, 25)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        const text = value ? String(value) : '-'
        const clipped = doc.splitTextToSize(text, w - 4)
        doc.text(clipped.slice(0, 2), x + 2, top + 8)
      }

      const drawSignaturesFooter = () => {
        const footerH = 44
        const spaceNeeded = footerH + 8
        if (y + spaceNeeded > pageH - 14) {
          doc.addPage()
          y = 14
          doc.setFillColor(248, 248, 248)
          doc.rect(0, 0, pageW, pageH, 'F')
          doc.setFillColor(255, 255, 255)
          doc.roundedRect(margin, 8, pageW - margin * 2, pageH - 16, 2, 2, 'F')
          doc.setDrawColor(225, 225, 225)
          doc.roundedRect(margin, 8, pageW - margin * 2, pageH - 16, 2, 2)
        }

        const boxY = pageH - margin - footerH
        const boxW = (contentW - 4) / 2
        const leftX = margin
        const rightX = margin + boxW + 4

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(90, 90, 90)
        doc.text('Firmas (Cliente / Técnico)', margin, boxY - 2)

        doc.setDrawColor(210, 210, 210)
        doc.roundedRect(leftX, boxY, boxW, footerH, 1, 1)
        doc.roundedRect(rightX, boxY, boxW, footerH, 1, 1)

        doc.setFillColor(246, 246, 246)
        doc.rect(leftX, boxY, boxW, 7, 'F')
        doc.rect(rightX, boxY, boxW, 7, 'F')

        doc.setFontSize(8)
        doc.setTextColor(70, 70, 70)
        doc.text('Cliente en terreno', leftX + 2, boxY + 4.8)
        doc.text('Técnico en terreno', rightX + 2, boxY + 4.8)

        const clientLabel = normalizeDisplayText(payload.reporte.firma_cliente_terreno || (payload.reporte.firma_cliente_imagen ? 'Firma digital' : '-'))
        const techLabel = normalizeDisplayText(payload.reporte.firma_tecnico_terreno || (payload.reporte.firma_tecnico_imagen ? 'Firma digital' : '-'))
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(95, 95, 95)
        doc.text(clientLabel, leftX + 2, boxY + 11.5)
        doc.text(techLabel, rightX + 2, boxY + 11.5)

        if (payload.reporte.firma_cliente_imagen) {
          doc.addImage(payload.reporte.firma_cliente_imagen, 'PNG', leftX + 2, boxY + 13, boxW - 4, footerH - 15)
        }
        if (payload.reporte.firma_tecnico_imagen) {
          doc.addImage(payload.reporte.firma_tecnico_imagen, 'PNG', rightX + 2, boxY + 13, boxW - 4, footerH - 15)
        }
      }

      const drawTerrainValidationData = () => {
        const gap = 4
        const boxW = (contentW - gap) / 2
        const boxH = 36
        ensureSpace(boxH + 4)

        const drawBlock = (x, title, nombre, rut, cargo, firmaTexto) => {
          doc.setDrawColor(215, 215, 215)
          doc.roundedRect(x, y, boxW, boxH, 1, 1)
          doc.setFillColor(246, 246, 246)
          doc.rect(x, y, boxW, 7, 'F')

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          doc.setTextColor(70, 70, 70)
          doc.text(title, x + 2, y + 4.8)

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          doc.setTextColor(40, 40, 40)
          doc.text(`Nombre: ${normalizeDisplayText(nombre)}`, x + 2, y + 11.2)
          doc.text(`RUT: ${normalizeDisplayText(rut)}`, x + 2, y + 16.9)
          doc.text(`Cargo: ${normalizeDisplayText(cargo)}`, x + 2, y + 22.6)
          doc.text(`Firma: ${normalizeDisplayText(firmaTexto)}`, x + 2, y + 28.3)
        }

        drawBlock(
          margin,
          'Cliente en terreno',
          payload.reporte.nombre_cliente_terreno,
          payload.reporte.rut_cliente_terreno,
          payload.reporte.cargo_cliente_terreno,
          payload.reporte.firma_cliente_terreno || (payload.reporte.firma_cliente_imagen ? 'Firma digital' : '-')
        )

        drawBlock(
          margin + boxW + gap,
          'Técnico en terreno',
          payload.reporte.nombre_tecnico_terreno,
          payload.reporte.rut_tecnico_terreno,
          payload.reporte.cargo_tecnico_terreno,
          payload.reporte.firma_tecnico_terreno || (payload.reporte.firma_tecnico_imagen ? 'Firma digital' : '-')
        )

        y += boxH + 4
      }

      doc.setFillColor(248, 248, 248)
      doc.rect(0, 0, pageW, pageH, 'F')

      doc.setFillColor(255, 255, 255)
      doc.roundedRect(margin, 8, pageW - margin * 2, pageH - 16, 2, 2, 'F')
      doc.setDrawColor(225, 225, 225)
      doc.roundedRect(margin, 8, pageW - margin * 2, pageH - 16, 2, 2)

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', margin + 2, 11, 48, 11)
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.setTextColor(20, 20, 20)
      doc.text('HOJA DE ENTREGA DE SERVICIO', pageW - margin - 2, 17, { align: 'right' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(90, 90, 90)
      doc.text(`N° ${payload.reporte.id}`, pageW - margin - 2, 22, { align: 'right' })

      y = 28
      sectionTitle('Datos Generales')

      const contentW = pageW - margin * 2
      const col2 = (contentW - 3) / 2
      const row1Y = y
      drawField('Fecha', formatDate(payload.reporte.fecha), margin, row1Y, col2)
      drawField('Motivo', normalizeDisplayText(payload.reporte.motivo || payload.reporte.descripcion), margin + col2 + 3, row1Y, col2)
      y += 13
      drawField('Cliente', normalizeDisplayText(payload.reporte.cliente_nombre), margin, y, col2)
      drawField('Direccion', normalizeDisplayText(payload.reporte.direccion_cliente || payload.reporte.direccion), margin + col2 + 3, y, col2)
      y += 13
      drawField('Hora de llegada', formatTime(payload.reporte.hora_llegada), margin, y, col2)
      drawField('Hora de salida', formatTime(payload.reporte.hora_salida), margin + col2 + 3, y, col2)
      y += 13
      drawField('Tecnico a cargo', normalizeDisplayText(payload.reporte.tecnico_nombre), margin, y, contentW)
      y += 15

      sectionTitle('Items del Reporte')
      const colQty = 20
      const colDesc = contentW - 32
      const colChk = 12
      const headerY = y
      doc.setFillColor(247, 247, 247)
      doc.rect(margin, headerY, contentW, 8, 'F')
      doc.setDrawColor(215, 215, 215)
      doc.rect(margin, headerY, contentW, 8)
      doc.line(margin + colQty, headerY, margin + colQty, headerY + 8)
      doc.line(margin + colQty + colDesc, headerY, margin + colQty + colDesc, headerY + 8)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(70, 70, 70)
      doc.text('Cant.', margin + 2, headerY + 5.3)
      doc.text('Descripcion', margin + colQty + 2, headerY + 5.3)
      doc.text('Chk', margin + colQty + colDesc + 2, headerY + 5.3)
      y += 8

      const items = payload.items || []
      if (items.length === 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(110, 110, 110)
        doc.rect(margin, y, contentW, 10)
        doc.text('Sin items cargados', margin + 2, y + 6)
        y += 12
      } else {
        for (const item of items) {
          const descLines = doc.splitTextToSize(normalizeDisplayText(item.descripcion || '-'), colDesc - 4)
          const rowH = Math.max(8, descLines.length * 4.2 + 2)
          ensureSpace(rowH + 2)

          doc.setDrawColor(225, 225, 225)
          doc.rect(margin, y, contentW, rowH)
          doc.line(margin + colQty, y, margin + colQty, y + rowH)
          doc.line(margin + colQty + colDesc, y, margin + colQty + colDesc, y + rowH)

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          doc.setTextColor(35, 35, 35)
          doc.text(String(item.cantidad || 0), margin + 3, y + 5.5)

          doc.setFont('helvetica', 'normal')
          doc.text(descLines, margin + colQty + 2, y + 5.2)

          doc.rect(margin + colQty + colDesc + 3.5, y + 2.2, 4.2, 4.2)
          if (item.marcado) {
            doc.setFont('helvetica', 'bold')
            doc.text('X', margin + colQty + colDesc + 4.5, y + 5.7)
          }
          y += rowH
        }
        y += 2
      }

      sectionTitle('Observaciones')
      const obs = normalizeDisplayText(payload.reporte.observaciones || '-')
      const obsLines = doc.splitTextToSize(obs, contentW - 6)
      const obsH = Math.max(16, obsLines.length * 4.5 + 6)
      ensureSpace(obsH + 2)
      doc.setDrawColor(220, 220, 220)
      doc.roundedRect(margin, y, contentW, obsH, 1, 1)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(35, 35, 35)
      doc.text(obsLines, margin + 3, y + 6)
      y += obsH + 4

      sectionTitle('Validacion en Terreno')
      drawTerrainValidationData()

      drawSignaturesFooter()

      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text(`Generado el ${new Date().toLocaleString('es-CL')}`, pageW - margin, pageH - 8, { align: 'right' })

      const pdfBlob = doc.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)
      const pdfWindow = window.open(pdfUrl, '_blank', 'noopener,noreferrer')

      if (!pdfWindow) {
        showToast('No se pudo abrir la vista previa. Revisa si el navegador bloquea ventanas emergentes.', 'error')
      } else {
        showToast('Vista previa PDF abierta en nueva pestaña')
      }

      setTimeout(() => URL.revokeObjectURL(pdfUrl), 180000)
    } catch (err) {
      showToast(err.message || 'No se pudo generar el PDF', 'error')
    } finally {
      setLoadingPdfId(null)
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>

  return (
    <main className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-800" style={{ fontFamily: 'Poppins,sans-serif' }}>Reportes HES</h1>
        <button
          type="button"
          onClick={() => setShowFormModal(true)}
          className="bg-[#00863a] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#006d2e]"
        >
          + Nuevo HES
        </button>
      </div>

      <section className="bg-white rounded-lg shadow p-4 md:p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Buscar</label>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Motivo, cliente, tecnico o fecha"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Filtrar por cliente</label>
            <select
              value={filterCliente}
              onChange={(e) => setFilterCliente(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Filtrar por tecnico</label>
            <select
              value={filterTecnico}
              onChange={(e) => setFilterTecnico(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Motivo</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Llegada</th>
              <th className="px-4 py-3">Salida</th>
              <th className="px-4 py-3">Tecnico</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredReportes.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{r.fecha}</td>
                <td className="px-4 py-3 text-gray-800">{normalizeDisplayText(r.motivo || r.descripcion)}</td>
                <td className="px-4 py-3 text-gray-700">{normalizeDisplayText(r.cliente_nombre || '-')}</td>
                <td className="px-4 py-3 text-gray-600">{r.hora_llegada || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{r.hora_salida || '-'}</td>
                <td className="px-4 py-3 text-gray-700">{normalizeDisplayText(r.tecnico_nombre || '-')}</td>
                <td className="px-4 py-3 text-gray-600">{r.total_items || 0}</td>
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex items-center gap-2">
                    <button
                      onClick={() => openDetail(r.id)}
                      className="h-8 w-8 rounded-full border border-gray-200 hover:border-[#00863a] hover:text-[#00863a] text-gray-600 inline-flex items-center justify-center"
                      title="Ver detalle"
                      aria-label="Ver detalle"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <button
                      onClick={() => generatePdf(r.id)}
                      disabled={loadingPdfId === r.id}
                      className="h-8 w-8 rounded-full border border-gray-200 hover:border-gray-800 hover:text-gray-900 text-gray-600 inline-flex items-center justify-center disabled:opacity-50"
                      title="Generar PDF"
                      aria-label="Generar PDF"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                        <path d="M9 15h6" />
                        <path d="M9 19h6" />
                        <path d="M10 11h4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteReporte(r.id)}
                      disabled={deletingId === r.id}
                      className="h-8 w-8 rounded-full border border-gray-200 hover:border-red-600 hover:text-red-600 text-gray-600 inline-flex items-center justify-center disabled:opacity-50"
                      title="Eliminar HES"
                      aria-label="Eliminar HES"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredReportes.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={8}>No hay resultados para los filtros actuales.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {showFormModal && (
        <div className="fixed inset-0 bg-black/55 z-[55] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-800">Nuevo reporte HES</h2>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="text-gray-400 hover:text-gray-700 text-xl"
                aria-label="Cerrar"
              >
                x
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setField('fecha', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Motivo</label>
              <input
                value={form.motivo}
                onChange={(e) => setField('motivo', e.target.value)}
                placeholder="Detalle del motivo de visita"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cliente</label>
              <select
                value={form.cliente_id}
                onChange={(e) => handleClienteChange(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                required
              >
                <option value="">Seleccionar...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Direccion (automatica segun cliente)</label>
              <input
                value={form.direccion}
                readOnly
                className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-sm text-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hora de llegada</label>
              <input
                type="time"
                value={form.hora_llegada}
                onChange={(e) => setField('hora_llegada', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hora de salida</label>
              <input
                type="time"
                value={form.hora_salida}
                onChange={(e) => setField('hora_salida', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">Items del reporte</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left w-24">Cantidad</th>
                    <th className="px-3 py-2 text-left">Descripcion</th>
                    <th className="px-3 py-2 text-center w-20">Check</th>
                    <th className="px-3 py-2 text-center w-20">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {form.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="1"
                          value={item.cantidad}
                          onChange={(e) => updateItem(idx, 'cantidad', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={item.descripcion}
                          onChange={(e) => updateItem(idx, 'descripcion', e.target.value)}
                          placeholder="Descripcion del item"
                          className="w-full border border-gray-300 rounded px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!item.marcado}
                          onChange={(e) => updateItem(idx, 'marcado', e.target.checked)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 border-t bg-gray-50">
              <button
                type="button"
                onClick={addItem}
                className="bg-gray-700 text-white px-3 py-1.5 rounded text-xs hover:bg-gray-800"
              >
                + Agregar fila
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Observaciones</label>
            <textarea
              rows={3}
              value={form.observaciones}
              onChange={(e) => setField('observaciones', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="border rounded-lg p-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Datos a rellenar en terreno</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border rounded-lg p-3 space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Cliente</p>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nombre de Cliente</label>
                  <input
                    value={form.nombre_cliente_terreno}
                    onChange={(e) => setField('nombre_cliente_terreno', e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Rut de Cliente</label>
                  <input
                    value={form.rut_cliente_terreno}
                    onChange={(e) => setField('rut_cliente_terreno', e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cargo de Cliente</label>
                  <input
                    value={form.cargo_cliente_terreno}
                    onChange={(e) => setField('cargo_cliente_terreno', e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Firma de Cliente</label>
                  <div className="space-y-2">
                    {form.firma_cliente_imagen ? (
                      <img src={form.firma_cliente_imagen} alt="Firma cliente" className="h-24 w-full object-contain border rounded bg-white" />
                    ) : (
                      <div className="h-24 border rounded bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                        Sin firma
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setSignatureTarget('cliente'); setShowSignatureModal(true) }}
                        className="bg-gray-700 text-white px-3 py-2 rounded text-xs hover:bg-gray-800"
                      >
                        {form.firma_cliente_imagen ? 'Editar firma' : 'Firmar'}
                      </button>
                      {form.firma_cliente_imagen && (
                        <button
                          type="button"
                          onClick={() => removeSignature('cliente')}
                          className="bg-red-100 text-red-700 px-3 py-2 rounded text-xs hover:bg-red-200"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-3 space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Técnico</p>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nombre de Técnico</label>
                  <input
                    value={form.nombre_tecnico_terreno}
                    onChange={(e) => setField('nombre_tecnico_terreno', e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Rut de Técnico</label>
                  <input
                    value={form.rut_tecnico_terreno}
                    onChange={(e) => setField('rut_tecnico_terreno', e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cargo de Técnico</label>
                  <input
                    value={form.cargo_tecnico_terreno}
                    onChange={(e) => setField('cargo_tecnico_terreno', e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Firma de Técnico</label>
                  <div className="space-y-2">
                    {form.firma_tecnico_imagen ? (
                      <img src={form.firma_tecnico_imagen} alt="Firma técnico" className="h-24 w-full object-contain border rounded bg-white" />
                    ) : (
                      <div className="h-24 border rounded bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                        Sin firma
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setSignatureTarget('tecnico'); setShowSignatureModal(true) }}
                        className="bg-gray-700 text-white px-3 py-2 rounded text-xs hover:bg-gray-800"
                      >
                        {form.firma_tecnico_imagen ? 'Editar firma' : 'Firmar'}
                      </button>
                      {form.firma_tecnico_imagen && (
                        <button
                          type="button"
                          onClick={() => removeSignature('tecnico')}
                          className="bg-red-100 text-red-700 px-3 py-2 rounded text-xs hover:bg-red-200"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#00863a] text-white px-4 py-2 rounded text-sm hover:bg-[#006d2e] disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : 'Guardar reporte HES'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeDetail}>
          <div className="bg-white rounded-lg w-full max-w-3xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Detalle reporte HES</h3>
              <button onClick={closeDetail} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><span className="text-gray-500">Fecha:</span> <span className="font-medium">{detail.reporte.fecha}</span></div>
                <div><span className="text-gray-500">Motivo:</span> <span className="font-medium">{normalizeDisplayText(detail.reporte.motivo || detail.reporte.descripcion)}</span></div>
                <div><span className="text-gray-500">Cliente:</span> <span className="font-medium">{normalizeDisplayText(detail.reporte.cliente_nombre || '-')}</span></div>
                <div><span className="text-gray-500">Direccion:</span> <span className="font-medium">{normalizeDisplayText(detail.reporte.direccion_cliente || detail.reporte.direccion || '-')}</span></div>
                <div><span className="text-gray-500">Hora llegada:</span> <span className="font-medium">{detail.reporte.hora_llegada || '-'}</span></div>
                <div><span className="text-gray-500">Hora salida:</span> <span className="font-medium">{detail.reporte.hora_salida || '-'}</span></div>
                <div><span className="text-gray-500">Tecnico a cargo:</span> <span className="font-medium">{normalizeDisplayText(detail.reporte.tecnico_nombre || '-')}</span></div>
              </div>

              <div>
                <p className="text-gray-500 mb-1">Tabla de items</p>
                <div className="border rounded-lg divide-y">
                  {detail.items.length === 0 && <p className="p-3 text-gray-500">Sin items cargados.</p>}
                  {detail.items.map((item) => (
                    <div key={item.id} className="p-3 flex gap-3 items-start">
                      <span className="font-mono text-base leading-none mt-0.5">{item.marcado ? '☑' : '☐'}</span>
                      <span className="text-gray-700">{item.cantidad} x {normalizeDisplayText(item.descripcion)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-gray-500 mb-1">Observaciones</p>
                <p className="bg-gray-50 rounded p-3 text-gray-700 whitespace-pre-line">{normalizeDisplayText(detail.reporte.observaciones || '-')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Cliente</p>
                  <p><span className="text-gray-500">Nombre:</span> {normalizeDisplayText(detail.reporte.nombre_cliente_terreno || '-')}</p>
                  <p><span className="text-gray-500">Rut:</span> {normalizeDisplayText(detail.reporte.rut_cliente_terreno || '-')}</p>
                  <p><span className="text-gray-500">Cargo:</span> {normalizeDisplayText(detail.reporte.cargo_cliente_terreno || '-')}</p>
                  <p><span className="text-gray-500">Firma:</span> {normalizeDisplayText(detail.reporte.firma_cliente_terreno || (detail.reporte.firma_cliente_imagen ? 'Firma digital' : '-'))}</p>
                  {detail.reporte.firma_cliente_imagen && (
                    <div>
                      <img src={detail.reporte.firma_cliente_imagen} alt="Firma cliente" className="max-h-40 border rounded bg-white p-2" />
                    </div>
                  )}
                </div>
                <div className="border rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Técnico</p>
                  <p><span className="text-gray-500">Nombre:</span> {normalizeDisplayText(detail.reporte.nombre_tecnico_terreno || '-')}</p>
                  <p><span className="text-gray-500">Rut:</span> {normalizeDisplayText(detail.reporte.rut_tecnico_terreno || '-')}</p>
                  <p><span className="text-gray-500">Cargo:</span> {normalizeDisplayText(detail.reporte.cargo_tecnico_terreno || '-')}</p>
                  <p><span className="text-gray-500">Firma:</span> {normalizeDisplayText(detail.reporte.firma_tecnico_terreno || (detail.reporte.firma_tecnico_imagen ? 'Firma digital' : '-'))}</p>
                  {detail.reporte.firma_tecnico_imagen && (
                    <div>
                      <img src={detail.reporte.firma_tecnico_imagen} alt="Firma técnico" className="max-h-40 border rounded bg-white p-2" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowSignatureModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">{signatureTarget === 'tecnico' ? 'Firma de Técnico' : 'Firma de Cliente'}</h3>
              <button type="button" onClick={() => setShowSignatureModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-500">Firma dentro del recuadro. Puedes usar mouse o tactil.</p>
              <div className="border rounded bg-white overflow-hidden">
                <canvas
                  ref={signatureCanvasRef}
                  width={900}
                  height={260}
                  className="w-full h-56 touch-none"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={clearSignatureCanvas} className="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-300">Limpiar</button>
                <button type="button" onClick={saveSignature} className="bg-[#00863a] text-white px-3 py-2 rounded text-sm hover:bg-[#006d2e]">Guardar firma</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
