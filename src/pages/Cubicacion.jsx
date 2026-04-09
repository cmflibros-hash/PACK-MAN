import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import logoPackmanNegro from '../assets/Logo-Packman-Negro.svg'
import { api } from '../api'

const Badge = ({ value }) => {
  const c = { borrador: 'bg-gray-100 text-gray-600', aprobada: 'bg-green-100 text-green-800', emitida: 'bg-blue-100 text-blue-800', rechazada: 'bg-red-100 text-red-800' }
  return <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${c[value] || 'bg-gray-100 text-gray-600'}`}>{value}</span>
}

const clean = (v) => (v === null || v === undefined || String(v).trim() === '' ? '-' : String(v))

export default function Cubicacion() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [items, setItems] = useState([])

  useEffect(() => {
    api('/api/cubicaciones').then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const openDetailById = (id) => {
    api(`/api/cubicaciones/${id}`).then(r => r.json()).then(d => {
      setDetail(d.cubicacion)
      setItems(d.items)
    }).catch(() => {})
  }

  const viewDetail = (cub) => {
    const next = new URLSearchParams(searchParams)
    next.set('id', String(cub.id))
    setSearchParams(next)
    openDetailById(cub.id)
  }

  const closeDetail = () => {
    setDetail(null)
    setItems([])
    const next = new URLSearchParams(searchParams)
    next.delete('id')
    setSearchParams(next)
  }

  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return
    if (detail?.id && String(detail.id) === String(id)) return
    openDetailById(id)
  }, [searchParams])

  const goToInforme = (informeId) => {
    if (!informeId) return
    navigate(`/informes?id=${informeId}`)
  }

  const exportExcel = async () => {
    if (!detail) return

    const XLSX = await import('xlsx')

    const rows = [
      ['DETALLE CUBICACION'],
      ['Titulo', clean(detail.titulo)],
      ['Fecha', clean(detail.fecha)],
      ['Estado', clean(detail.estado)],
      ['Temporada', clean(detail.temporada_nombre)],
      ['Cliente', clean(detail.cliente_nombre)],
      ['Maquina', clean(detail.maquina_nombre)],
      ['Modelo', clean(detail.modelo_nombre)],
      ['Informe', clean(detail.informe_titulo)],
      []
    ]

    const headers = ['Equipo', 'Componente', 'Codigo', 'Nombre Item', 'Cantidad Individual', 'Total General Item']
    const detailRows = items.map((it) => [
      clean(it.equipo_nombre),
      clean(it.componente_nombre),
      clean(it.codigo),
      clean(it.repuesto_nombre),
      Number(it.cantidad || 0),
      Number(it.cantidad_general || it.cantidad || 0)
    ])

    rows.push(headers)
    rows.push(...detailRows)
    rows.push([])
    rows.push(['Filas Totales', items.length])

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    worksheet['!cols'] = [
      { wch: 28 },
      { wch: 28 },
      { wch: 16 },
      { wch: 42 },
      { wch: 18 },
      { wch: 20 }
    ]

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cubicacion')
    const safeTitle = String(detail.titulo || 'cubicacion').replace(/[\\/:*?"<>|]/g, '_')
    XLSX.writeFile(workbook, `${safeTitle}.xlsx`)
  }

  const exportPdf = async () => {
    if (!detail) return

    const { jsPDF } = await import('jspdf')

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const marginX = 30
    const topStart = 42
    const rowHeight = 18
    const colWidths = [120, 150, 90, 220, 95, 105]
    const headers = ['Equipo', 'Componente', 'Código', 'Nombre Item', 'Cant. Ind.', 'Total Item']
    const logoW = 120
    const logoH = 28

    // Convierte el SVG del logo a PNG para insertarlo de forma consistente en jsPDF.
    let logoDataUrl = ''
    try {
      const logoText = await fetch(logoPackmanNegro).then((r) => r.text())
      const svgBlob = new Blob([logoText], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)
      const img = new Image()
      img.src = svgUrl
      await img.decode()

      const canvas = document.createElement('canvas')
      const targetW = 180
      const ratio = img.naturalWidth > 0 ? (img.naturalHeight / img.naturalWidth) : 0.25
      const targetH = Math.max(40, Math.round(targetW * ratio))
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, targetW, targetH)
        logoDataUrl = canvas.toDataURL('image/png')
      }
      URL.revokeObjectURL(svgUrl)
    } catch (_) {
      logoDataUrl = ''
    }

    const drawHeader = () => {
      const logoY = topStart - 2
      const textStartX = logoDataUrl ? (marginX + logoW + 14) : marginX
      const titleY = topStart + 8
      const dateY = titleY + 16
      const detailY = dateY + 14

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', marginX, logoY, logoW, logoH)
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(String(detail.titulo || 'Cubicación'), textStartX, titleY)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`Fecha: ${clean(detail.fecha)}`, textStartX, dateY)
      doc.text(
        `Cliente: ${clean(detail.cliente_nombre)} | Máquina: ${clean(detail.maquina_nombre)} | Modelo: ${clean(detail.modelo_nombre)}`,
        textStartX,
        detailY
      )

      let x = marginX
      const y = detailY + 28
      doc.setFillColor(245, 245, 245)
      doc.rect(marginX, y - 12, pageWidth - marginX * 2, rowHeight, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      headers.forEach((h, idx) => {
        doc.text(h, x + 4, y)
        x += colWidths[idx]
      })
      doc.setDrawColor(220, 220, 220)
      doc.line(marginX, y + 6, pageWidth - marginX, y + 6)
      return y + 20
    }

    let y = drawHeader()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)

    const addPageIfNeeded = () => {
      if (y > pageHeight - 36) {
        doc.addPage()
        y = drawHeader()
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
      }
    }

    for (const it of items) {
      addPageIfNeeded()
      const row = [
        clean(it.equipo_nombre),
        clean(it.componente_nombre),
        clean(it.codigo),
        clean(it.repuesto_nombre),
        String(Number(it.cantidad || 0)),
        String(Number(it.cantidad_general || it.cantidad || 0))
      ]

      let x = marginX
      row.forEach((cell, idx) => {
        const maxW = colWidths[idx] - 8
        const value = doc.splitTextToSize(cell, maxW)[0] || ''
        const alignRight = idx >= 4
        if (alignRight) {
          const textW = doc.getTextWidth(value)
          doc.text(value, x + colWidths[idx] - textW - 4, y)
        } else {
          doc.text(value, x + 4, y)
        }
        x += colWidths[idx]
      })

      doc.setDrawColor(235, 235, 235)
      doc.line(marginX, y + 6, pageWidth - marginX, y + 6)
      y += rowHeight
    }

    const safeTitle = String(detail.titulo || 'cubicacion').replace(/[\\/:*?"<>|]/g, '_')
    doc.save(`${safeTitle}.pdf`)
  }

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>

  return (
    <main className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800" style={{fontFamily:'Poppins,sans-serif'}}>Cubicaciones</h1>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3">Título</th><th className="px-4 py-3">Temporada</th>
              <th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Modelo</th>
              <th className="px-4 py-3">Informe</th><th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{clean(c.titulo)}</td>
                <td className="px-4 py-3 text-gray-600">{clean(c.temporada_nombre)}</td>
                <td className="px-4 py-3 text-gray-600">{clean(c.cliente_nombre)}</td>
                <td className="px-4 py-3 text-gray-600">{clean(c.modelo_nombre)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{clean(c.informe_titulo)}</td>
                <td className="px-4 py-3 text-gray-500">{clean(c.fecha)}</td>
                <td className="px-4 py-3"><Badge value={c.estado} /></td>
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex items-center gap-2">
                    <button onClick={() => viewDetail(c)} className="text-[#00863a] hover:text-[#006d2e] text-xs font-medium">Detalle</button>
                    {c.informe_id && (
                      <button onClick={() => goToInforme(c.informe_id)} className="text-xs font-medium text-gray-700 hover:text-gray-900">Ir a informe</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detalle */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeDetail}
        >
          <div
            className="bg-white rounded-lg w-full max-w-6xl shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-gray-800">{detail.titulo}</h2>
                <p className="text-xs text-gray-400 mt-1">Fecha: {detail.fecha} · <Badge value={detail.estado} /></p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportPdf}
                  className="px-3 py-1.5 text-xs rounded-md bg-[#00863a] text-white hover:bg-[#006d2e]"
                >
                  Exportar PDF
                </button>
                <button
                  onClick={exportExcel}
                  className="px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Exportar Excel
                </button>
                {detail.informe_id && (
                  <button
                    onClick={() => goToInforme(detail.informe_id)}
                    className="px-3 py-1.5 text-xs rounded-md bg-gray-800 text-white hover:bg-black"
                  >
                    Ver Informe
                  </button>
                )}
                <button onClick={closeDetail} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-xs text-gray-500 mb-3">
                Cliente: {clean(detail.cliente_nombre)} · Máquina: {clean(detail.maquina_nombre)} · Modelo: {clean(detail.modelo_nombre)}
              </p>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Equipo</th>
                    <th className="px-3 py-2 text-left">Componente</th>
                    <th className="px-3 py-2 text-left">Código</th>
                    <th className="px-3 py-2 text-left">Nombre Item</th>
                    <th className="px-3 py-2 text-right">Cant. Individual</th>
                    <th className="px-3 py-2 text-right">Total General Item</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((it, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700">{clean(it.equipo_nombre)}</td>
                      <td className="px-3 py-2 text-gray-700">{clean(it.componente_nombre)}</td>
                      <td className="px-3 py-2 text-gray-700 font-mono">{clean(it.codigo)}</td>
                      <td className="px-3 py-2 text-gray-800">{clean(it.repuesto_nombre)}</td>
                      <td className="px-3 py-2 text-right text-gray-700 font-medium">{Number(it.cantidad || 0)}</td>
                      <td className="px-3 py-2 text-right font-bold text-[#00863a]">{Number(it.cantidad_general || it.cantidad || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-bold">
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-right text-gray-700">Filas totales</td>
                    <td className="px-3 py-3 text-right text-[#00863a] text-base">{items.length}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {data.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
          No hay cubicaciones registradas
        </div>
      )}
    </main>
  )
}
