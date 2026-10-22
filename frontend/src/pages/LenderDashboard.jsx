import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import MapPicker from '../components/MapPicker'
import LoadingSkeleton from '../components/LoadingSkeleton'
import {
    fetchLenderStations,
    registerLenderStation,
    togglePlugMaintenance,
    fetchLenderAnalytics
} from '../services/api'

export default function LenderDashboard() {
    const [form, setForm] = useState({
        name: '',
        location: 'ECR',
        address: '',
        connector: 'CCS2',
        power: '50 kW',
        lat: null,
        lng: null,
    })
    const [myStations, setMyStations] = useState([])
    const [analytics, setAnalytics] = useState(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [msg, setMsg] = useState({ type: '', text: '' })
    const [activeTab, setActiveTab] = useState('stations')

    const loadData = async () => {
        setLoading(true)
        try {
            const [stRes, anRes] = await Promise.all([
                fetchLenderStations(),
                fetchLenderAnalytics()
            ])
            setMyStations(stRes.stations || [])
            setAnalytics(anRes)
        } catch (err) {
            setMsg({ type: 'error', text: err.message || 'Failed to load data.' })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadData() }, [])

    // This is what MapPicker calls — receives lat, lng, and resolved address
    const handleLocationSelect = (lat, lng, address) => {
        setForm(f => ({
            ...f,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            ...(address ? { address } : {}),
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.lat || !form.lng) {
            setMsg({ type: 'error', text: 'Please pick a location on the map first.' })
            return
        }
        if (!form.name.trim() || !form.address.trim()) {
            setMsg({ type: 'error', text: 'Station name and address are required.' })
            return
        }
        setSubmitting(true)
        setMsg({ type: '', text: '' })
        try {
            await registerLenderStation(form)
            setMsg({ type: 'success', text: `"${form.name}" registered successfully on the C-HIVE grid!` })
            setForm({ name: '', location: 'ECR', address: '', connector: 'CCS2', power: '50 kW', lat: null, lng: null })
            await loadData()
            setActiveTab('stations')
        } catch (err) {
            setMsg({ type: 'error', text: err.message || 'Registration failed. Please try again.' })
        } finally {
            setSubmitting(false)
        }
    }

    const handleToggleMaintenance = async (plugId, currentStatus) => {
        try {
            const res = await togglePlugMaintenance(plugId)
            setMsg({ type: 'success', text: res.message })
            await loadData()
        } catch (err) {
            setMsg({ type: 'error', text: err.message || 'Could not update plug status.' })
        }
    }

    return (
        <div className="min-h-screen" style={{ background: '#0f172a', color: '#f1f5f9', fontFamily: "'Plus Jakarta Sans', Inter, system-ui" }}>
            <Navbar />

            <main className="pt-16 px-4 md:px-8 max-w-7xl mx-auto pb-20">
                {/* ─── Header ─── */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 py-6 border-b border-white/5">
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 999, padding: '3px 12px', marginBottom: 8 }}>
                            <span className="live-dot" style={{ width: 7, height: 7 }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                Lender Portal
                            </span>
                        </div>
                        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em', margin: 0 }}>
                            Station Management
                        </h1>
                        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                            Manage charging hubs, track bookings and view your earnings
                        </p>
                    </div>

                    {/* Tab Controls */}
                    <div style={{ display: 'flex', background: '#1e293b', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 4, gap: 2 }}>
                        {[
                            { key: 'stations', label: `My Stations (${myStations.length})` },
                            { key: 'analytics', label: 'Earnings' },
                            { key: 'register', label: '+ Add Station' },
                        ].map(t => (
                            <button
                                key={t.key}
                                onClick={() => setActiveTab(t.key)}
                                className={`tab-btn${activeTab === t.key ? ' active' : ''}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ─── Status Banner ─── */}
                {msg.text && (
                    <div className={`${msg.type === 'error' ? 'alert-error' : 'alert-success'} animate-fade-in mt-4`} style={{ justifyContent: 'space-between' }}>
                        <span>{msg.text}</span>
                        <button onClick={() => setMsg({ type: '', text: '' })} style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, cursor: 'pointer', background: 'none', border: 'none', color: 'inherit' }}>
                            Dismiss ✕
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="mt-6"><LoadingSkeleton count={3} /></div>
                ) : activeTab === 'stations' ? (
                    /* ─── MY STATIONS LIST ─── */
                    <div className="mt-6">
                        {myStations.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 24px', background: '#1e293b', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
                                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>
                                    No Stations Yet
                                </h3>
                                <p style={{ fontSize: 13, color: '#64748b', maxWidth: 320, margin: '0 auto 20px' }}>
                                    You haven't added any charging stations. Register your first hub to start earning.
                                </p>
                                <button className="btn-primary" onClick={() => setActiveTab('register')}>
                                    Register First Station
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                                {myStations.map(st => (
                                    <div key={st.id} className="card" style={{ padding: 20 }}>
                                        {/* Station Header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#4ade80', display: 'block', marginBottom: 4 }}>
                                                    {st.id}
                                                </span>
                                                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: 0, lineHeight: 1.3 }}>
                                                    {st.name}
                                                </h3>
                                            </div>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace', background: 'rgba(245,158,11,.1)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(245,158,11,.2)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                                                {st.power}
                                            </span>
                                        </div>

                                        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                                            📍 {st.address}
                                        </p>

                                        {/* Plugs */}
                                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                                            <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                                Charging Plugs ({st.plugs?.length || 0})
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {st.plugs?.map(p => {
                                                    const isMaint = p.status === 'MAINTENANCE'
                                                    return (
                                                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#0f172a', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <div>
                                                                <p style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                                                                    🔌 {p.name}
                                                                </p>
                                                                <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>
                                                                    {p.connector} · {p.power}
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleToggleMaintenance(p.id, p.status)}
                                                                style={{
                                                                    fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: 6,
                                                                    border: isMaint ? '1px solid rgba(239,68,68,.4)' : '1px solid rgba(34,197,94,.3)',
                                                                    background: isMaint ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.08)',
                                                                    color: isMaint ? '#f87171' : '#4ade80',
                                                                    cursor: 'pointer', transition: 'all 0.15s',
                                                                    textTransform: 'uppercase', letterSpacing: '0.03em',
                                                                }}
                                                            >
                                                                {isMaint ? '⚠ Maintenance' : '✓ Active'}
                                                            </button>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : activeTab === 'analytics' ? (
                    /* ─── ANALYTICS ─── */
                    <div className="mt-6 flex flex-col gap-6">
                        {/* KPI row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
                            {[
                                { label: 'Wallet Balance', value: `₹${analytics?.wallet_balance?.toFixed(2) ?? '0.00'}`, sub: 'available earnings', color: '#4ade80' },
                                { label: 'Net Revenue', value: `₹${analytics?.net_revenue?.toFixed(2) ?? '0.00'}`, sub: 'after refunds', color: '#f1f5f9' },
                                { label: 'Total Sessions', value: analytics?.confirmed_count ?? 0, sub: 'confirmed bookings', color: '#f1f5f9' },
                                { label: 'Hours Booked', value: `${analytics?.total_booked_hours ?? 0}h`, sub: 'total charg. time', color: '#fbbf24' },
                                { label: 'Utilization', value: `${analytics?.utilization_pct ?? 0}%`, sub: 'of operating hours', color: '#38bdf8' },
                            ].map(k => (
                                <div key={k.label} className="card" style={{ padding: 18 }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                                        {k.label}
                                    </p>
                                    <p style={{ fontSize: 24, fontWeight: 800, color: k.color, fontFamily: 'monospace', margin: 0 }}>
                                        {k.value}
                                    </p>
                                    <p style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{k.sub}</p>
                                </div>
                            ))}
                        </div>

                        {/* Booking table */}
                        <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#f1f5f9' }}>
                                Recent Booking Receipts
                            </h3>
                            {!analytics?.recent_bookings?.length ? (
                                <p style={{ textAlign: 'center', color: '#475569', fontSize: 13, padding: '24px 0' }}>No bookings yet.</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'left' }}>
                                            {['ID', 'Driver', 'Port', 'Date & Slot', 'Dur', 'Amount', 'Status'].map(h => (
                                                <th key={h} style={{ padding: '6px 10px', fontWeight: 700, fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.recent_bookings.map(b => (
                                            <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <td style={{ padding: '10px 10px', fontFamily: 'monospace', color: '#4ade80', fontWeight: 700 }}>{b.id}</td>
                                                <td style={{ padding: '10px 10px', color: '#cbd5e1' }}>{b.user_username}</td>
                                                <td style={{ padding: '10px 10px', color: '#94a3b8' }}>{b.plug_name}</td>
                                                <td style={{ padding: '10px 10px', fontFamily: 'monospace', color: '#38bdf8' }}>{b.date} {b.start_time}–{b.end_time}</td>
                                                <td style={{ padding: '10px 10px', color: '#64748b' }}>{b.duration_hours}h</td>
                                                <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#4ade80' }}>₹{b.amount}</td>
                                                <td style={{ padding: '10px 10px' }}>
                                                    <span className={b.status === 'CONFIRMED' ? 'badge-green' : 'badge-red'}>
                                                        {b.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                ) : (
                    /* ─── REGISTER STATION ─── */
                    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, marginTop: 24, alignItems: 'start' }}>
                        {/* Form */}
                        <div className="card" style={{ padding: 24 }}>
                            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: '#f1f5f9' }}>
                                Station Details
                            </h3>
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label className="form-label">Station Name *</label>
                                    <input
                                        className="form-input"
                                        required
                                        placeholder="e.g. Marina EV Hub"
                                        value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="form-label">Zone / Area</label>
                                    <select
                                        className="form-input"
                                        value={form.location}
                                        onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                                    >
                                        {['ECR', 'Anna Nagar', 'Medavakkam', 'Pammal', 'Maduravoyal'].map(z => (
                                            <option key={z} value={z}>{z}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="form-label">Street Address *</label>
                                    <input
                                        className="form-input"
                                        required
                                        placeholder="Auto-filled when you pick map location"
                                        value={form.address}
                                        onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label className="form-label">Connector</label>
                                        <select
                                            className="form-input"
                                            value={form.connector}
                                            onChange={e => setForm(f => ({ ...f, connector: e.target.value }))}
                                        >
                                            <option value="CCS2">CCS2 DC Fast</option>
                                            <option value="Type 2">Type 2 AC</option>
                                            <option value="CHAdeMO">CHAdeMO</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Power Output</label>
                                        <select
                                            className="form-input"
                                            value={form.power}
                                            onChange={e => setForm(f => ({ ...f, power: e.target.value }))}
                                        >
                                            <option value="22 kW">22 kW AC</option>
                                            <option value="50 kW">50 kW DC Fast</option>
                                            <option value="60 kW">60 kW DC</option>
                                            <option value="120 kW">120 kW Super</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Location status */}
                                <div style={{ padding: '10px 14px', background: form.lat ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${form.lat ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: 10 }}>
                                    {form.lat ? (
                                        <p style={{ fontSize: 12, color: '#4ade80', margin: 0 }}>
                                            ✓ Location set: {form.lat?.toFixed(4)}, {form.lng?.toFixed(4)}
                                        </p>
                                    ) : (
                                        <p style={{ fontSize: 12, color: '#fbbf24', margin: 0 }}>
                                            ⚠ Search for a location or click the map to set coordinates
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={submitting}
                                    style={{ marginTop: 4, padding: '12px 20px', width: '100%', fontSize: 14 }}
                                >
                                    {submitting ? 'Registering...' : 'Register Station on Grid ⚡'}
                                </button>
                            </form>
                        </div>

                        {/* Map Picker */}
                        <div className="card" style={{ padding: 20, minHeight: 480, display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#f1f5f9' }}>
                                Pick Location
                            </h3>
                            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                                Search by address or click anywhere on the map to place your station pin
                            </p>
                            <div style={{ flex: 1, minHeight: 380 }}>
                                <MapPicker
                                    zone={form.location}
                                    lat={form.lat}
                                    lng={form.lng}
                                    onLocationSelect={handleLocationSelect}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
