import { useMemo, useState, useEffect } from 'react'
import { api } from '../api'

const badgeColors = {
  pendiente: 'bg-amber-100 text-amber-800',
  'en proceso': 'bg-blue-100 text-blue-800',
  completado: 'bg-emerald-100 text-emerald-800',
  crítica: 'bg-red-100 text-red-800',
  alta: 'bg-orange-100 text-orange-800',
  media: 'bg-yellow-100 text-yellow-800',
  baja: 'bg-gray-100 text-gray-600',
}

const labelMes = (periodo) => {
  if (!periodo || !periodo.includes('-')) return periodo || '-'
  const [y, m] = periodo.split('-')
  return `${m}/${y.slice(2)}`
}

const normalizeText = (v) => (v === null || v === undefined || String(v).trim() === '' ? '-' : String(v))

const StatusBadge = ({ value }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColors[String(value || '').toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>
    {normalizeText(value)}
  </span>
)

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/dashboard/stats').then((r) => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const monthlySeries = useMemo(() => {
    const src = Array.isArray(data?.reportesMensuales) ? data.reportesMensuales : []
    if (!src.length) return []
    return src.map((d) => ({
      label: labelMes(d.periodo),
      value: Number(d.total) || 0,
    }))
  }, [data])

  const fillRate = useMemo(() => {
    const total = Number(data?.embudo?.hes_total) || 0
    const pendientes = Number(data?.embudo?.hes_pendientes) || 0
    if (!total) return 0
    return Math.max(0, Math.min(100, Math.round(((total - pendientes) / total) * 100)))
  }, [data])

  if (loading) return <div className="p-6 text-gray-500">Cargando dashboard...</div>
  if (!data) return <div className="p-6 text-red-500">Error al cargar el dashboard.</div>

  const {
    stats = {},
    ultimosReportes = [],
    stockBajoItems = [],
    tecnicoProductividad = [],
    cubicacionesRecientes = [],
    repuestosDemanda = [],
    embudo = {}
  } = data

  const hesRecientes = ultimosReportes.slice(0, 4)
  const stockCritico = stockBajoItems.slice(0, 4)
  const cubicacionesTop = cubicacionesRecientes.slice(0, 4)
  const demandaTop = repuestosDemanda.slice(0, 4)
  const tecnicosTop = tecnicoProductividad.slice(0, 5)

  return (
    <main className="h-full overflow-hidden flex flex-col gap-3">
      <section className="h-12 rounded-xl border border-[#00863a]/35 bg-white shadow-sm px-4 flex items-center justify-between">
        <div className="min-w-0 flex items-center gap-2">
          <span className="h-6 w-1.5 rounded-full bg-[#00863a]" />
          <h1 className="text-base font-semibold text-gray-800 truncate" style={{ fontFamily: 'Poppins,sans-serif' }}>
            Panel Técnico y Cotizaciones
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500 leading-none">Cumplimiento HES</p>
          <p className="text-sm font-semibold text-[#006d2e] leading-none mt-1">{fillRate}% · Pend.: {Number(embudo.hes_pendientes) || 0}</p>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        <KpiCard label="Clientes" value={stats.clientes} tone="blue" compact />
        <KpiCard label="Máquinas" value={stats.maquinas} tone="emerald" compact />
        <KpiCard label="HES" value={embudo.hes_total} tone="amber" compact />
        <KpiCard label="Informes" value={embudo.informes_total} tone="slate" compact />
        <KpiCard label="Cubicaciones" value={embudo.cubicaciones_total} tone="violet" compact />
        <KpiCard label="Stock Crítico" value={stats.stockBajo} tone="red" compact />
      </section>

      <section className="min-h-0 flex-1 grid grid-cols-1 xl:grid-cols-12 gap-3">
        <article className="xl:col-span-5 bg-white rounded-xl border border-gray-100 shadow-sm p-3 min-h-0">
          <header className="mb-2">
            <h2 className="font-semibold text-sm text-gray-800">Embudo Operacional</h2>
            <p className="text-[11px] text-gray-500">HES → Informe → Cubicación</p>
          </header>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <FunnelStage title="HES" value={embudo.hes_total} subtitle={`${embudo.hes_pendientes || 0} pend.`} tone="amber" compact />
            <FunnelStage title="Informes" value={embudo.informes_total} subtitle="emitidos" tone="blue" compact />
            <FunnelStage title="Cubicación" value={embudo.cubicaciones_total} subtitle="cotizar" tone="emerald" compact />
          </div>
          <h3 className="text-xs font-semibold text-gray-700 mb-2">Tendencia HES</h3>
          <TrendChart data={monthlySeries} compact />
        </article>

        <article className="xl:col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm p-3 min-h-0">
          <h2 className="font-semibold text-sm text-gray-800 mb-2">Carga por Técnico (30d)</h2>
          <BarList
            rows={tecnicosTop.map((t) => ({ name: normalizeText(t.nombre), total: (Number(t.hes_30d) || 0) + (Number(t.informes_30d) || 0) }))}
            colorClass="bg-[#1d4ed8]"
            compact
          />
        </article>

        <article className="xl:col-span-4 bg-white rounded-xl border border-gray-100 shadow-sm p-3 min-h-0 grid grid-rows-2 gap-3">
          <div className="min-h-0">
            <h2 className="font-semibold text-sm text-gray-800 mb-2">Stock Crítico</h2>
            <MiniTable
              headers={['Código', 'Repuesto', 'Brecha']}
              rows={stockCritico.map((i) => [
                normalizeText(i.codigo),
                normalizeText(i.nombre),
                Math.max(0, (Number(i.stock_minimo) || 0) - (Number(i.stock) || 0))
              ])}
            />
          </div>
          <div className="min-h-0">
            <h2 className="font-semibold text-sm text-gray-800 mb-2">Mayor Demanda</h2>
            <MiniTable
              headers={['Código', 'Item', 'Cant.']}
              rows={demandaTop.map((r) => [normalizeText(r.codigo), normalizeText(r.nombre), Number(r.total_general) || 0])}
            />
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <article className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <h2 className="font-semibold text-sm text-gray-800 mb-2">Cubicaciones Recientes</h2>
          <MiniTable
            headers={['Fecha', 'Cliente', 'Cubicación']}
            rows={cubicacionesTop.map((c) => [normalizeText(c.fecha), normalizeText(c.cliente_nombre), `#${c.id} · ${normalizeText(c.titulo)}`])}
          />
        </article>
        <article className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <h2 className="font-semibold text-sm text-gray-800 mb-2">Últimos HES</h2>
          <MiniTable
            headers={['Fecha', 'Cliente', 'Estado']}
            rows={hesRecientes.map((r) => [normalizeText(r.fecha), normalizeText(r.cliente_nombre), normalizeText(r.estado)])}
          />
        </article>
      </section>
    </main>
  )
}

function KpiCard({ label, value, tone, compact = false }) {
  const toneMap = {
    blue: 'from-blue-100 to-blue-50 text-blue-700 border-blue-100',
    emerald: 'from-emerald-100 to-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'from-amber-100 to-amber-50 text-amber-700 border-amber-100',
    slate: 'from-slate-100 to-slate-50 text-slate-700 border-slate-100',
    violet: 'from-violet-100 to-violet-50 text-violet-700 border-violet-100',
    red: 'from-red-100 to-red-50 text-red-700 border-red-100',
  }
  return (
    <article className="rounded-2xl border shadow-sm bg-white overflow-hidden">
      <div className={`h-1 w-full bg-gradient-to-r ${toneMap[tone] || toneMap.slate}`} />
      <div className={compact ? 'p-2.5' : 'p-4'}>
        <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
        <p className={compact ? 'text-xl font-bold text-gray-800 mt-0.5' : 'text-3xl font-bold text-gray-800 mt-1'}>{Number(value) || 0}</p>
      </div>
    </article>
  )
}

function TrendChart({ data, compact = false }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <p className="text-sm text-gray-500 p-2">No hay datos suficientes para la tendencia.</p>
  }

  const width = 700
  const height = compact ? 170 : 260
  const p = compact ? 22 : 28
  const max = Math.max(...data.map((d) => d.value), 1)
  const stepX = (width - p * 2) / Math.max(data.length - 1, 1)

  const points = data.map((d, i) => {
    const x = p + i * stepX
    const y = height - p - ((d.value / max) * (height - p * 2))
    return { x, y, ...d }
  })

  const linePath = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - p} L ${points[0].x} ${height - p} Z`

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => {
          const y = p + ((height - p * 2) / 4) * i
          return <line key={i} x1={p} y1={y} x2={width - p} y2={y} stroke="#e5e7eb" strokeWidth="1" />
        })}
        <path d={areaPath} fill="url(#trendFill)" />
        <path d={linePath} fill="none" stroke="#0f8a4a" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((pt) => (
          <g key={pt.label}>
            <circle cx={pt.x} cy={pt.y} r="4" fill="#0f8a4a" />
            <text x={pt.x} y={height - 6} textAnchor="middle" fontSize={compact ? '9' : '10'} fill="#6b7280">{pt.label}</text>
            <text x={pt.x} y={pt.y - 8} textAnchor="middle" fontSize={compact ? '9' : '10'} fill="#111827">{pt.value}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function BarList({ rows, colorClass, compact = false }) {
  if (!Array.isArray(rows) || rows.length === 0) return <p className="text-sm text-gray-500 mt-2">Sin datos.</p>
  const max = Math.max(...rows.map((r) => r.total), 1)
  return (
    <div className={compact ? 'space-y-1.5 mt-1' : 'space-y-2 mt-2'}>
      {rows.map((r) => (
        <div key={r.name}>
          <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
            <span className="truncate pr-2">{r.name}</span>
            <span className="font-semibold">{r.total}</span>
          </div>
          <div className={compact ? 'h-1.5 rounded-full bg-gray-100 overflow-hidden' : 'h-2 rounded-full bg-gray-100 overflow-hidden'}>
            <div className={`h-full ${colorClass}`} style={{ width: `${(r.total / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function FunnelStage({ title, value, subtitle, tone, compact = false }) {
  const toneMap = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }
  return (
    <div className={`border rounded-xl ${compact ? 'p-2.5' : 'p-4'} ${toneMap[tone] || toneMap.blue}`}>
      <p className="text-[10px] uppercase tracking-wide">{title}</p>
      <p className={compact ? 'text-xl font-bold mt-0.5' : 'text-3xl font-bold mt-1'}>{Number(value) || 0}</p>
      <p className="text-[11px] mt-0.5">{subtitle}</p>
      <div className="mt-2 h-1.5 rounded-full bg-white/60 overflow-hidden">
        <div className="h-full bg-current" style={{ width: `${Math.min(100, (Number(value) || 0) > 0 ? 100 : 0)}%` }} />
      </div>
    </div>
  )
}

function MiniTable({ headers, rows }) {
  return (
    <table className="w-full text-[11px]">
      <thead className="text-gray-500 uppercase">
        <tr>
          {headers.map((h) => <th key={h} className="text-left py-1.5 pr-2">{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.length === 0 && <tr><td colSpan={headers.length} className="py-2 text-gray-500">Sin datos</td></tr>}
        {rows.map((r, idx) => (
          <tr key={idx}>
            {r.map((c, cIdx) => <td key={cIdx} className="py-1.5 pr-2 text-gray-700 truncate max-w-[180px]">{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
