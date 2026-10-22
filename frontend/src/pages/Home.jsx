import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import MapView from '../components/MapView'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { fetchStations } from '../services/api'

const LOCATIONS  = ['All', 'ECR', 'Anna Nagar', 'Medavakkam', 'Pammal', 'Maduravoyal']
const CONNECTORS = ['All', 'CCS2', 'Type 2', 'DC Fast']
const POWER_LVL  = ['All', '22 kW', '50 kW', '60 kW', '120 kW']

export default function Home() {
    const navigate = useNavigate()
    const [stations, setStations] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedStation, setSelectedStation] = useState(null)
    const [viewMode, setViewMode] = useState('both')
    const [filters, setFilters] = useState({ location: 'All', connector: 'All', power: 'All', search: '' })

    const loadStations = async () => {
        setLoading(true); setError('')
        try {
            const data = await fetchStations(filters)
            setStations(data.stations || [])
            if (data.stations?.length > 0 && !selectedStation) setSelectedStation(data.stations[0])
        } catch (err) { setError(err.message || 'Failed to load charging stations.') }
        finally { setLoading(false) }
    }

    useEffect(() => { loadStations() }, [filters.location, filters.connector, filters.power])

    const filtered = stations.filter(st => {
        if (!filters.search) return true
        const q = filters.search.toLowerCase()
        return st.name.toLowerCase().includes(q) || st.address.toLowerCase().includes(q)
    })

    const available = filtered.filter(s => s.has_available).length

    return (
        <div style={{ minHeight: '100vh', background: 'var(--slate-900)', color: 'var(--white)', display: 'flex', flexDirection: 'column', fontFamily: "'Space Grotesk', system-ui, sans-serif", animation: 'page-in .3s ease-out' }}>
            <Navbar />

            <main style={{ flex: 1, paddingTop: 72, maxWidth: 1560, margin: '0 auto', width: '100%', padding: '72px 28px 32px', display: 'flex', flexDirection: 'column' }}>

                {/* ── Header ── */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,.05)', marginBottom: 20, animation: 'card-rise .4s ease-out' }}>
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.18)', borderRadius: 999, padding: '4px 12px', marginBottom: 10 }}>
                            <span className="live-dot" />
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', letterSpacing: '.07em', textTransform: 'uppercase' }}>
                                Live Availability Grid
                            </span>
                        </div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--white)', letterSpacing: '-.03em', margin: 0 }}>
                            Find Charging Stations
                        </h1>
                        <p style={{ fontSize: 13, color: 'var(--slate-400)', marginTop: 4 }}>
                            {filtered.length} station{filtered.length !== 1 ? 's' : ''} across Chennai · {available} with open plugs
                        </p>
                    </div>

                    {/* KPI pills */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        {[
                            { v: available, label: 'Open Hubs', color: 'var(--green)' },
                            { v: filtered.length, label: 'Total Hubs', color: 'var(--slate-200)' },
                        ].map(k => (
                            <div key={k.label} style={{
                                padding: '10px 18px', background: 'var(--slate-800)',
                                border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, textAlign: 'center',
                            }}>
                                <div className="kpi-value" style={{ fontSize: 22, color: k.color }}>{k.v}</div>
                                <div style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{k.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Filter Toolbar ── */}
                <div style={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
                    padding: '14px 16px',
                    background: 'var(--slate-800)',
                    border: '1px solid rgba(255,255,255,.07)',
                    borderRadius: 14, marginBottom: 20,
                    animation: 'card-rise .4s ease-out .06s both',
                }}>
                    {/* Search */}
                    <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Search station or street…"
                            value={filters.search}
                            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                            style={{ width: '100%', background: 'var(--slate-900)', border: '1.5px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '9px 14px 9px 36px', color: 'var(--white)', fontSize: 13, fontFamily: 'inherit', outline: 'none', transition: 'border-color .15s' }}
                            onFocus={e => e.target.style.borderColor = 'rgba(34,197,94,.45)'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.08)'}
                        />
                    </div>

                    {/* Filter selects */}
                    {[
                        { label: 'Area', key: 'location', opts: LOCATIONS },
                        { label: 'Connector', key: 'connector', opts: CONNECTORS },
                        { label: 'Power', key: 'power', opts: POWER_LVL },
                    ].map(f => (
                        <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{f.label}</span>
                            <select
                                value={filters[f.key]}
                                onChange={e => setFilters(fl => ({ ...fl, [f.key]: e.target.value }))}
                                style={{ background: 'var(--slate-900)', border: '1.5px solid rgba(255,255,255,.08)', borderRadius: 9, padding: '8px 12px', fontSize: 12, color: 'var(--white)', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
                            >
                                {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                    ))}

                    {/* View mode toggle */}
                    <div style={{ display: 'flex', background: 'var(--slate-900)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 9, padding: 3, gap: 2, marginLeft: 'auto' }}>
                        {[['both', '⊟ Split'], ['list', '☰ List'], ['map', '⊕ Map']].map(([mode, label]) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                style={{
                                    padding: '6px 12px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                                    background: viewMode === mode ? 'var(--green)' : 'transparent',
                                    color: viewMode === mode ? '#000' : 'var(--slate-400)',
                                    border: 'none', borderRadius: 7, cursor: 'pointer', transition: 'all .15s',
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Content Area ── */}
                {loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1 }}>
                        <LoadingSkeleton count={3} />
                        <div style={{ background: 'var(--slate-800)', borderRadius: 16, border: '1px solid rgba(255,255,255,.06)', minHeight: 450, animation: 'bolt-pulse 1.5s ease-in-out infinite' }} />
                    </div>
                ) : error ? (
                    <div className="alert-error" style={{ flexDirection: 'column', gap: 12, padding: 32, textAlign: 'center' }}>
                        <p style={{ fontWeight: 600 }}>{error}</p>
                        <button onClick={loadStations} className="btn-ghost" style={{ alignSelf: 'center' }}>Retry ↺</button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--slate-800)', borderRadius: 18, border: '1px solid rgba(255,255,255,.06)' }}>
                        <div style={{ fontSize: 44, marginBottom: 16 }}>🔌</div>
                        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No stations found</h3>
                        <p style={{ color: 'var(--slate-400)', fontSize: 14, maxWidth: 340, margin: '0 auto 24px' }}>
                            No charging hubs match your filters. Try clearing them.
                        </p>
                        <button className="btn-primary" onClick={() => setFilters({ location: 'All', connector: 'All', power: 'All', search: '' })}>
                            Clear Filters
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'both' ? '420px 1fr' : '1fr', gap: 20, flex: 1, minHeight: 500 }}>

                        {/* Station List */}
                        {(viewMode === 'both' || viewMode === 'list') && (
                            <div className="stagger" style={{
                                display: 'flex', flexDirection: 'column', gap: 10,
                                overflowY: 'auto', maxHeight: 780, paddingRight: 4,
                                gridColumn: viewMode === 'list' ? '1 / -1' : 'auto',
                            }}>
                                {(viewMode === 'list'
                                    ? [...filtered]
                                    : filtered
                                ).map((st, idx) => {
                                    const isSel = selectedStation?.id === st.id
                                    return (
                                        <div
                                            key={st.id}
                                            onClick={() => setSelectedStation(st)}
                                            className={`card-hover animate-card-rise${isSel ? ' card-selected station-card-active' : ''}`}
                                            style={{
                                                padding: 18,
                                                animationDelay: `${idx * .04}s`,
                                                cursor: 'pointer',
                                                ...(isSel ? {
                                                    borderColor: 'rgba(34,197,94,.45)',
                                                    background: 'rgba(34,197,94,.04)',
                                                    transform: 'translateY(-2px)',
                                                    boxShadow: '0 8px 28px rgba(0,0,0,.4), inset 3px 0 0 #22c55e',
                                                } : {}),
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--white)', margin: 0, lineHeight: 1.3, letterSpacing: '-.01em' }}>{st.name}</h3>
                                                    <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📍 {st.address}</p>
                                                </div>
                                                <span className={st.has_available ? 'badge-green' : 'badge-red'}>
                                                    {st.has_available ? '● Open' : '● Full'}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', padding: '3px 8px', borderRadius: 6, color: 'var(--slate-200)' }}>
                                                    ⚡ {st.connector}
                                                </span>
                                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', padding: '3px 8px', borderRadius: 6, color: '#fbbf24' }}>
                                                    🚀 {st.power}
                                                </span>
                                                <span style={{ fontSize: 11, color: 'var(--slate-400)', marginLeft: 'auto' }}>
                                                    {st.plugs?.length || 1} plug{(st.plugs?.length || 1) > 1 ? 's' : ''}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>
                                                    AI Dynamic Rate ✓
                                                </span>
                                                <button
                                                    className="btn-primary"
                                                    onClick={e => { e.stopPropagation(); navigate(`/book-station/${st.id}`) }}
                                                    style={{ padding: '7px 16px', fontSize: 12 }}
                                                >
                                                    Book Slot →
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Map */}
                        {(viewMode === 'both' || viewMode === 'map') && (
                            <div style={{
                                borderRadius: 16, overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,.07)',
                                position: 'relative', minHeight: 460,
                                animation: 'card-rise .45s ease-out .08s both',
                                boxShadow: '0 4px 32px rgba(0,0,0,.3)',
                                gridColumn: viewMode === 'map' ? '1 / -1' : 'auto',
                            }}>
                                <MapView
                                    lenders={filtered.map(s => ({ ...s, available: s.has_available }))}
                                    locationName={filters.location}
                                    selectedLender={selectedStation}
                                    onSelectLender={setSelectedStation}
                                />

                                {/* Float card on selected station */}
                                {selectedStation && (
                                    <div style={{
                                        position: 'absolute', bottom: 16, left: 16, right: 16, maxWidth: 420,
                                        background: 'rgba(10,15,30,.95)',
                                        border: '1px solid rgba(34,197,94,.3)',
                                        borderRadius: 14, padding: '14px 16px',
                                        backdropFilter: 'blur(14px)',
                                        zIndex: 1000,
                                        animation: 'scale-in .2s ease-out',
                                        boxShadow: '0 8px 32px rgba(0,0,0,.6)',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div className="kicker" style={{ marginBottom: 4 }}>Selected Hub</div>
                                                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--white)', margin: 0 }}>{selectedStation.name}</h4>
                                                <p style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {selectedStation.address}
                                                </p>
                                            </div>
                                            <button
                                                className="btn-primary"
                                                onClick={() => navigate(`/book-station/${selectedStation.id}`)}
                                                style={{ padding: '8px 16px', fontSize: 12, flexShrink: 0 }}
                                            >
                                                Book →
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}
