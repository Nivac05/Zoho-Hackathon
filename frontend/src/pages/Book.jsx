import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import MapView from '../components/MapView'
import LenderCard from '../components/LenderCard'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { predictPrice } from '../services/api'

const LOCATION_INDEX = { 'ECR': 0, 'Anna Nagar': 1, 'Medavakkam': 2, 'Pammal': 3, 'Maduravoyal': 4 }
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function todayIndex() {
    const d = new Date().getDay() // 0=Sun
    return d === 0 ? 6 : d - 1
}

export default function Book() {
    const { location } = useParams()
    const navigate = useNavigate()
    const loc = decodeURIComponent(location)
    const [lenders, setLenders] = useState([])
    const [fetchingLenders, setFetchingLenders] = useState(true)

    const [form, setForm] = useState({
        start_hour: '',
        end_hour: '',
        charging_duration: '',
        day_of_week: todayIndex(),
    })
    const [price, setPrice] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [selectedLender, setSel] = useState(null)
    const [booked, setBooked] = useState(false)
    const [reason, setReason] = useState('')
    const [walletBalance, setWalletBalance] = useState(0)

    useEffect(() => {
        if (!localStorage.getItem('isLoggedIn')) navigate('/login')

        // Fetch lenders from MongoDB
        const fetchLenders = async () => {
            try {
                const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000'
                const res = await fetch(`${API_URL}/api/lenders?location=${encodeURIComponent(loc)}`)
                const data = await res.json()
                if (data.success) {
                    setLenders(data.lenders)
                }
            } catch (err) {
                console.error('Failed to fetch lenders:', err)
            } finally {
                setFetchingLenders(false)
            }
        }
        fetchLenders()

        const fetchWallet = async () => {
            const token = localStorage.getItem('token')
            const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000'
            const res = await fetch(`${API_URL}/api/user/wallet`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) setWalletBalance(data.wallet_balance)
        }
        fetchWallet()
    }, [loc, navigate])

    const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

    const handlePredict = async () => {
        setError('')
        if (!form.start_hour || !form.end_hour || !form.charging_duration) {
            setError('Please fill in start hour, end hour, and duration.')
            return
        }
        setLoading(true)
        setPrice(null)
        try {
            const result = await predictPrice({
                location: LOCATION_INDEX[loc] ?? 0,
                start_hour: parseInt(form.start_hour),
                end_hour: parseInt(form.end_hour),
                charging_duration: parseFloat(form.charging_duration),
                day_of_week: parseInt(form.day_of_week),
            })
            setPrice(result.predicted_price)
            setReason(result.reason)
        } catch (err) {
            setError(err.message || 'Could not reach the pricing server. Is the backend running?')
        } finally {
            setLoading(false)
        }
    }

    const handleBook = async () => {
        if (!selectedLender) { setError('Please select a charging station first.'); return }
        if (walletBalance < price) { setError('Insufficient wallet balance. Please add credits.'); return }

        setLoading(true)
        try {
            const token = localStorage.getItem('token')
            const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000'
            const res = await fetch(`${API_URL}/api/book`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    lender_name: selectedLender.name,
                    price: price,
                    timestamp: new Date().toISOString()
                })
            })
            const data = await res.json()
            if (data.success) {
                setBooked(true)
                setWalletBalance(data.new_balance)
                setTimeout(() => navigate('/home'), 3500)
            } else {
                setError(data.error)
            }
        } catch (err) {
            setError('Booking failed. Connection error.')
        } finally {
            setLoading(false)
        }
    }


    return (
        <div className="min-h-screen bg-dark-900">
            <Navbar />

            <div className="pt-20 pb-12 px-4 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8 animate-fade-in-up">
                    <button
                        onClick={() => navigate('/home')}
                        className="flex items-center gap-2 text-gray-500 hover:text-neon-green transition-colors mb-4 text-sm"
                    >
                        ← Back to zones
                    </button>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-extrabold text-white">
                                Charge at{' '}
                                <span style={{ background: 'linear-gradient(135deg,#00ff88,#00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                    {loc}
                                </span>
                            </h1>
                            <p className="text-gray-400 mt-1">
                                {lenders.filter(l => l.available).length} of {lenders.length} stations available
                            </p>
                        </div>
                        <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl">
                            <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Your Wallet</p>
                            <p className="text-neon-green font-bold">₹{walletBalance.toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                {/* Booked confirmation */}
                {booked && (
                    <div className="glass-card border-neon-green/40 mb-8 animate-scale-in text-center py-10">
                        <div className="text-5xl mb-4">✅</div>
                        <h2 className="text-2xl font-bold text-neon-green mb-2">Booking Confirmed!</h2>
                        <p className="text-gray-400">
                            Your slot at <strong className="text-white">{selectedLender?.name}</strong> has been reserved.
                        </p>
                        <p className="text-gray-600 text-sm mt-3">Redirecting to home…</p>
                    </div>
                )}

                {!booked && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* ── LEFT PANEL ── */}
                        <div className="space-y-6">
                            {/* Booking form */}
                            <div className="glass-card animate-fade-in-up">
                                <h2 className="text-lg font-semibold text-white mb-5">⚡ Session Details</h2>
                                <div className="space-y-4">
                                    {/* Start & End hours */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-gray-400 text-xs mb-1.5 block">Start Hour (0–23)</label>
                                            <input
                                                id="start_hour"
                                                type="number" min="0" max="23"
                                                className="num-input w-full"
                                                placeholder="e.g. 9"
                                                value={form.start_hour}
                                                onChange={setF('start_hour')}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-xs mb-1.5 block">End Hour (0–23)</label>
                                            <input
                                                id="end_hour"
                                                type="number" min="0" max="23"
                                                className="num-input w-full"
                                                placeholder="e.g. 11"
                                                value={form.end_hour}
                                                onChange={setF('end_hour')}
                                            />
                                        </div>
                                    </div>

                                    {/* Duration */}
                                    <div>
                                        <label className="text-gray-400 text-xs mb-1.5 block">Charging Duration (hours)</label>
                                        <input
                                            id="charging_duration"
                                            type="number" min="0.1" step="0.1"
                                            className="num-input w-full"
                                            placeholder="e.g. 1.5"
                                            value={form.charging_duration}
                                            onChange={setF('charging_duration')}
                                        />
                                    </div>

                                    {/* Day of week */}
                                    <div>
                                        <label className="text-gray-400 text-xs mb-1.5 block">Day of Week</label>
                                        <select id="day_of_week" className="select-input w-full" value={form.day_of_week} onChange={setF('day_of_week')}>
                                            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                                        </select>
                                    </div>

                                    {/* Error */}
                                    {error && (
                                        <div className="animate-fade-in flex items-start gap-2 text-red-400 text-sm rounded-xl px-4 py-3 border border-red-500/20 bg-red-500/10">
                                            <span className="mt-0.5">⚠</span> {error}
                                        </div>
                                    )}

                                    <button
                                        id="predict-btn"
                                        onClick={handlePredict}
                                        disabled={loading}
                                        className="neon-btn w-full text-sm"
                                    >
                                        {loading ? <><span className="spinner" /> Calculating price…</> : 'Get AI Price Estimate'}
                                    </button>
                                </div>
                            </div>

                            {/* Price */}
                            {loading && <LoadingSkeleton />}
                            {price !== null && !loading && (
                                <div className="glass-card border border-neon-green/30 animate-price-reveal" style={{ boxShadow: '0 0 40px rgba(0,255,136,.1)' }}>
                                    <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">AI Predicted Price</p>
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="text-gray-400 text-lg">₹</span>
                                        <span className="text-5xl font-extrabold text-neon-green">{price.toFixed(2)}</span>
                                    </div>
                                    <p className="text-gray-500 text-sm">for {form.charging_duration}h · {DAYS[form.day_of_week]}</p>
                                    {reason && (
                                        <div className="bg-neon-green/5 border border-neon-green/10 rounded-lg p-3 mb-4 text-xs text-neon-green flex items-center gap-2">
                                            <span>💡</span> AI Mind: {reason}
                                        </div>
                                    )}

                                    {selectedLender && (
                                        <div className="space-y-3">
                                            <button
                                                onClick={() => window.open(`https://www.google.com/maps?q=${selectedLender.lat},${selectedLender.lng}`, '_blank')}
                                                className="w-full py-3 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-all text-sm font-semibold flex items-center justify-center gap-2"
                                            >
                                                📍 Navigate to Station
                                            </button>
                                            <button id="book-btn" onClick={handleBook} disabled={loading} className="neon-btn w-full">
                                                {loading ? 'Processing...' : `✅ Confirm Booking at ${selectedLender.name}`}
                                            </button>
                                        </div>
                                    )}
                                    {!selectedLender && (
                                        <p className="text-gray-500 text-xs mt-4">👇 Select a station below to book</p>
                                    )}
                                </div>
                            )}

                            {/* Lenders list */}
                            <div>
                                <h2 className="text-lg font-semibold text-white mb-4">Nearby Stations</h2>
                                <div className="space-y-3 stagger">
                                    {lenders.map(l => (
                                        <LenderCard
                                            key={l._id || l.id}
                                            lender={l}
                                            selected={(selectedLender?._id || selectedLender?.id) === (l._id || l.id)}
                                            onSelect={() => setSel(sel => (sel?._id || sel?.id) === (l._id || l.id) ? null : l)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── RIGHT PANEL: Map ── */}
                        <div className="lg:sticky lg:top-24 h-[480px] lg:h-[680px] rounded-2xl overflow-hidden border border-white/10 animate-fade-in">
                            <MapView
                                lenders={lenders}
                                locationName={loc}
                                selectedLender={selectedLender}
                                onSelectLender={(l) => setSel(sel => (sel?._id || sel?.id) === (l._id || l.id) ? null : l)}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
