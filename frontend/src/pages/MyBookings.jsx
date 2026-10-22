import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import LoadingSkeleton from '../components/LoadingSkeleton'
import {
    fetchUserBookings,
    fetchUserWallet,
    topupWallet,
    cancelBooking
} from '../services/api'

export default function MyBookings() {
    const navigate = useNavigate()
    const [bookings, setBookings] = useState({ upcoming: [], past: [], cancelled: [] })
    const [wallet, setWallet] = useState({ wallet_balance: 0, transactions: [] })
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('bookings') // 'bookings' or 'wallet'
    const [topupAmount, setTopupAmount] = useState('500')
    const [actionMsg, setActionMsg] = useState({ type: '', text: '' })
    const [cancellingId, setCancellingId] = useState(null)

    const loadData = async () => {
        setLoading(true)
        try {
            const [bRes, wRes] = await Promise.all([
                fetchUserBookings(),
                fetchUserWallet()
            ])
            setBookings({
                upcoming: bRes.upcoming || [],
                past: bRes.past || [],
                cancelled: bRes.cancelled || []
            })
            setWallet(wRes)
        } catch (err) {
            setActionMsg({ type: 'error', text: err.message || 'Failed to load booking & wallet details.' })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const handleCancel = async (bookingId) => {
        if (!window.confirm('Are you sure you want to cancel this booking? Full refund will be credited to your wallet.')) return
        setCancellingId(bookingId)
        setActionMsg({ type: '', text: '' })
        try {
            const res = await cancelBooking(bookingId)
            setActionMsg({ type: 'success', text: res.message || 'Booking cancelled and refunded successfully.' })
            await loadData()
        } catch (err) {
            setActionMsg({ type: 'error', text: err.message || 'Unable to cancel booking.' })
        } finally {
            setCancellingId(null)
        }
    }

    const handleTopup = async (e) => {
        e.preventDefault()
        if (Number(topupAmount) <= 0) return
        try {
            const res = await topupWallet(topupAmount)
            setActionMsg({ type: 'success', text: `Wallet successfully credited with ₹${topupAmount}!` })
            await loadData()
        } catch (err) {
            setActionMsg({ type: 'error', text: err.message || 'Topup failed.' })
        }
    }

    return (
        <div className="min-h-screen bg-[#070913] text-gray-100 flex flex-col font-sans">
            <Navbar />

            <main className="flex-1 pt-20 px-4 md:px-8 max-w-[1300px] mx-auto w-full pb-16">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-white/10">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                            My Charging Activity & Wallet
                        </h1>
                        <p className="text-gray-400 text-xs md:text-sm mt-0.5">
                            Track upcoming charging sessions, view receipts and manage your virtual wallet
                        </p>
                    </div>

                    {/* Navigation Pills */}
                    <div className="flex items-center rounded-2xl bg-white/5 border border-white/10 p-1 self-start sm:self-auto">
                        <button
                            onClick={() => setActiveTab('bookings')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                activeTab === 'bookings' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Charging Bookings ({bookings.upcoming.length + bookings.past.length + bookings.cancelled.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('wallet')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                activeTab === 'wallet' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Wallet & History (₹{Number(wallet.wallet_balance || 0).toFixed(2)})
                        </button>
                    </div>
                </div>

                {/* Status Banners */}
                {actionMsg.text && (
                    <div className={`my-4 p-4 rounded-2xl border text-sm flex items-center justify-between ${
                        actionMsg.type === 'error'
                            ? 'bg-red-950/50 border-red-500/40 text-red-200'
                            : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                    }`}>
                        <div className="flex items-center gap-2">
                            <span>{actionMsg.type === 'error' ? '⚠️' : '✅'}</span>
                            <span>{actionMsg.text}</span>
                        </div>
                        <button onClick={() => setActionMsg({ type: '', text: '' })} className="text-xs opacity-70 hover:opacity-100 font-bold">Dismiss</button>
                    </div>
                )}

                {loading ? (
                    <div className="my-8"><LoadingSkeleton count={3} /></div>
                ) : activeTab === 'bookings' ? (
                    /* Bookings View (Flow 6 & Flow 8) */
                    <div className="flex flex-col gap-8 my-6">
                        {/* Upcoming Bookings */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                <h3 className="text-base font-extrabold text-white uppercase tracking-wider">
                                    Upcoming Charging Sessions ({bookings.upcoming.length})
                                </h3>
                            </div>

                            {bookings.upcoming.length === 0 ? (
                                <div className="p-8 text-center bg-white/5 border border-white/10 rounded-2xl">
                                    <p className="text-gray-400 text-xs">No upcoming sessions. Book a slot at any nearby charging hub!</p>
                                    <button
                                        onClick={() => navigate('/home')}
                                        className="mt-3 px-4 py-1.5 bg-emerald-500 text-black text-xs font-bold rounded-xl"
                                    >
                                        Find Chargers
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {bookings.upcoming.map((b) => (
                                        <div key={b.id} className="p-5 rounded-2xl bg-[#0b0e1e] border border-emerald-500/30 shadow-xl flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <span className="font-mono text-xs font-bold text-emerald-400">{b.id}</span>
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                        Confirmed
                                                    </span>
                                                </div>
                                                <h4 className="text-base font-black text-white">{b.station_name}</h4>
                                                <p className="text-xs text-gray-400 mt-0.5">Port: {b.plug_name}</p>

                                                <div className="grid grid-cols-2 gap-2 my-3 p-3 rounded-xl bg-white/5 text-xs">
                                                    <div>
                                                        <span className="text-[10px] text-gray-400 uppercase block">Date</span>
                                                        <span className="font-bold text-white">{b.date}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-gray-400 uppercase block">Interval</span>
                                                        <span className="font-bold text-emerald-300 font-mono">{b.start_time} - {b.end_time}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-gray-400 uppercase block">Duration</span>
                                                        <span className="font-bold text-white">{b.duration_hours} Hour(s)</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-gray-400 uppercase block">Total Cost</span>
                                                        <span className="font-bold font-mono text-emerald-400">₹{b.amount}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Cancel Action (Flow 8) */}
                                            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                                                <span className="text-[11px] text-gray-400">
                                                    Cancelable &ge; 2h prior
                                                </span>
                                                <button
                                                    onClick={() => handleCancel(b.id)}
                                                    disabled={cancellingId === b.id}
                                                    className="px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-colors disabled:opacity-50"
                                                >
                                                    {cancellingId === b.id ? 'Cancelling...' : 'Cancel & Refund'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Past & Cancelled Sessions */}
                        <div>
                            <h3 className="text-base font-extrabold text-white uppercase tracking-wider mb-3">
                                Past & Cancelled Records ({bookings.past.length + bookings.cancelled.length})
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[...bookings.past, ...bookings.cancelled].map((b) => {
                                    const isCancelled = b.status === 'CANCELLED'

                                    return (
                                        <div key={b.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 opacity-75">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-mono text-xs text-gray-400">{b.id}</span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                    isCancelled ? 'bg-red-500/20 text-red-300' : 'bg-gray-500/20 text-gray-300'
                                                }`}>
                                                    {b.status}
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-bold text-white">{b.station_name} ({b.plug_name})</h4>
                                            <p className="text-xs text-gray-400 mt-1 font-mono">
                                                {b.date} · {b.start_time} - {b.end_time} · ₹{b.amount}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Wallet & Ledger View (Flow 6) */
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-6">
                        {/* Balance Card & Top-up */}
                        <div className="lg:col-span-5 flex flex-col gap-6">
                            <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950 via-[#0d132b] to-slate-900 border border-emerald-500/30 shadow-2xl">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                                    Virtual Charging Balance
                                </span>
                                <div className="text-4xl font-black font-mono text-white mt-1">
                                    ₹{Number(wallet.wallet_balance || 0).toFixed(2)}
                                </div>
                                <p className="text-xs text-gray-400 mt-2">
                                    Instantly debited for held slot confirmations and credited upon valid cancellations.
                                </p>

                                <form onSubmit={handleTopup} className="mt-6 pt-5 border-t border-white/10 flex flex-col gap-3">
                                    <label className="text-xs font-semibold text-gray-300">
                                        Quick Top-Up Demo Funds:
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="50"
                                            value={topupAmount}
                                            onChange={(e) => setTopupAmount(e.target.value)}
                                            className="flex-1 bg-[#12162d] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                                        />
                                        <button
                                            type="submit"
                                            className="px-5 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs uppercase tracking-wider hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                                        >
                                            + Add Funds
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* Transaction Ledger */}
                        <div className="lg:col-span-7 bg-[#0b0e1e] border border-white/10 rounded-3xl p-6 shadow-xl">
                            <h3 className="text-base font-extrabold text-white uppercase tracking-wider mb-4">
                                Wallet Activity Ledger
                            </h3>

                            {wallet.transactions?.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-8">No wallet activity yet.</p>
                            ) : (
                                <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                                    {wallet.transactions.map((t) => {
                                        const isCredit = t.type === 'TOPUP' || t.type === 'REFUND' || t.type === 'CREDIT_EARNING'

                                        return (
                                            <div key={t.id} className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                                                <div>
                                                    <p className="font-semibold text-white">{t.description}</p>
                                                    <span className="text-[10px] text-gray-400">{t.created_at}</span>
                                                </div>
                                                <div className={`font-mono font-bold text-sm ${isCredit ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {isCredit ? '+' : '-'}₹{t.amount}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
