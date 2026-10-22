import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import LoadingSkeleton from '../components/LoadingSkeleton'
import {
    fetchStationDetails,
    fetchStationAvailability,
    predictPrice,
    holdSlot,
    confirmBooking,
    createSlotSSE
} from '../services/api'

export default function BookSlot() {
    const { stationId } = useParams()
    const navigate = useNavigate()

    const [station, setStation] = useState(null)
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [availability, setAvailability] = useState([])
    const [selectedPlug, setSelectedPlug] = useState(null)
    const [selectedSlot, setSelectedSlot] = useState(null)
    const [duration, setDuration] = useState(1)

    // Pricing & Reservation State
    const [quote, setQuote] = useState(null)
    const [predicting, setPredicting] = useState(false)
    const [holding, setHolding] = useState(false)
    const [heldReservation, setHeldReservation] = useState(null)
    const [countdown, setCountdown] = useState(0)
    const [paying, setPaying] = useState(false)
    const [bookingReceipt, setBookingReceipt] = useState(null)

    // Status & Error
    const [loading, setLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState('')
    const [successMsg, setSuccessMsg] = useState('')
    const [sseStatus, setSseStatus] = useState('connecting')

    const timerRef = useRef(null)

    // 1. Initial Load of Station Details & Slots
    const loadAvailability = async (keepSelection = false) => {
        try {
            const [stData, avData] = await Promise.all([
                fetchStationDetails(stationId),
                fetchStationAvailability(stationId, date)
            ])
            setStation(stData.station)
            setAvailability(avData.plugs || [])

            if (avData.plugs?.length > 0 && !selectedPlug) {
                setSelectedPlug(avData.plugs[0].plug)
            }

            if (!keepSelection) {
                setSelectedSlot(null)
                setQuote(null)
            }
        } catch (err) {
            setErrorMsg(err.message || 'Failed to load station availability.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadAvailability()
    }, [stationId, date])

    // 2. Real-Time SSE Listener (Flow 10)
    useEffect(() => {
        const sse = createSlotSSE(
            (event) => {
                console.log('[SSE Update]', event)
                // When any slot is held, booked, or expired, refresh availability seamlessly without page reload
                loadAvailability(true)
            },
            (status) => {
                setSseStatus(status)
            }
        )

        return () => {
            sse.close()
        }
    }, [stationId, date])

    // 3. 5-Minute Hold Countdown Timer (Flow 5)
    useEffect(() => {
        if (heldReservation && countdown > 0) {
            timerRef.current = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current)
                        setHeldReservation(null)
                        setErrorMsg('Your 5-minute slot reservation hold has expired. Please reselect your slot.')
                        loadAvailability()
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        }
        return () => clearInterval(timerRef.current)
    }, [heldReservation, countdown])

    // Invalidate quote if user alters parameters
    const handleSlotClick = (slot) => {
        if (!slot.can_book) return
        setSelectedSlot(slot)
        setQuote(null)
        setHeldReservation(null)
        setErrorMsg('')
        setSuccessMsg('')
    }

    const handleDurationChange = (e) => {
        setDuration(Number(e.target.value))
        setQuote(null)
        setHeldReservation(null)
    }

    // 4. Request AI Price (Flow 4)
    const handleGetAIPrice = async () => {
        if (!selectedSlot || !selectedPlug) {
            setErrorMsg('Please select an available charging slot first.')
            return
        }

        setPredicting(true)
        setErrorMsg('')
        try {
            const startH = selectedSlot.hour
            const endH = startH + duration
            const dayOfWeek = new Date(date).getDay()

            const res = await predictPrice({
                location: station?.location || 'ECR',
                start_hour: startH,
                end_hour: endH,
                charging_duration: duration,
                day_of_week: dayOfWeek === 0 ? 6 : dayOfWeek - 1
            })

            setQuote({
                price: res.predicted_price,
                reason: res.reason,
                start_time: selectedSlot.start_time,
                end_time: `${String(endH).padStart(2, '0')}:00`,
                duration
            })
        } catch (err) {
            setErrorMsg(err.message || 'AI price estimate is temporarily unavailable. Please retry.')
        } finally {
            setPredicting(false)
        }
    }

    // 5. Hold Slot for 5 Minutes (Flow 5)
    const handleHoldSlot = async () => {
        if (!selectedSlot || !selectedPlug || !quote) {
            setErrorMsg('Please calculate an AI price quote before holding the slot.')
            return
        }

        setHolding(true)
        setErrorMsg('')
        try {
            const res = await holdSlot({
                station_id: stationId,
                plug_id: selectedPlug.id,
                date,
                start_time: selectedSlot.start_time,
                duration,
                location: station?.location
            })

            setHeldReservation(res)
            setCountdown(res.expires_in_seconds || 300)
            setSuccessMsg('Charging slot held! Complete payment within 5 minutes to confirm.')
        } catch (err) {
            setErrorMsg(err.message || 'This slot is no longer available. Availability has been updated.')
            loadAvailability()
        } finally {
            setHolding(false)
        }
    }

    // 6. Pay with Wallet & Confirm (Flow 5)
    const handlePayAndConfirm = async () => {
        if (!heldReservation?.slot_id) {
            setErrorMsg('No active slot hold found. Please hold a slot first.')
            return
        }

        setPaying(true)
        setErrorMsg('')
        try {
            const res = await confirmBooking(heldReservation.slot_id)
            setBookingReceipt(res.booking)
            setHeldReservation(null)
            setCountdown(0)
            setSuccessMsg('Slot successfully confirmed and booked!')
            loadAvailability()
        } catch (err) {
            setErrorMsg(err.message || 'Payment failed. Please verify your wallet balance or retry.')
        } finally {
            setPaying(false)
        }
    }

    const currentPlugData = availability.find(p => p.plug.id === selectedPlug?.id)
    const slots = currentPlugData?.slots || []

    const formatTimer = (secs) => {
        const m = Math.floor(secs / 60)
        const s = secs % 60
        return `${m}:${s < 10 ? '0' : ''}${s}`
    }

    return (
        <div className="min-h-screen bg-[#070913] text-gray-100 flex flex-col font-sans">
            <Navbar />

            <main className="flex-1 pt-20 px-4 md:px-8 max-w-[1500px] mx-auto w-full pb-16">
                {/* Back Link & Station Title */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-white/10">
                    <div>
                        <button
                            onClick={() => navigate('/home')}
                            className="text-xs text-gray-400 hover:text-emerald-400 flex items-center gap-1.5 mb-2 font-semibold transition-colors"
                        >
                            ← Back to Stations Map
                        </button>
                        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                            {station?.name || 'Charging Station'}
                            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                                {station?.power || 'Fast Charge'}
                            </span>
                        </h1>
                        <p className="text-gray-400 text-xs md:text-sm mt-0.5">
                            📍 {station?.address}
                        </p>
                    </div>

                    {/* Live Real-time Indicator (Flow 10) */}
                    <div className="flex items-center gap-2 self-start md:self-auto">
                        <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                            sseStatus === 'connected'
                                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                                : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${sseStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
                            {sseStatus === 'connected' ? 'Live State Sync Active' : 'Sync Reconnecting...'}
                        </div>
                    </div>
                </div>

                {/* Notifications & Error Banners */}
                {errorMsg && (
                    <div className="my-4 p-4 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-200 text-sm flex items-center justify-between gap-3 shadow-lg">
                        <div className="flex items-center gap-2.5">
                            <span className="text-lg">⚠️</span>
                            <span>{errorMsg}</span>
                        </div>
                        <button onClick={() => setErrorMsg('')} className="text-xs text-red-300 hover:text-white font-bold">Dismiss</button>
                    </div>
                )}

                {successMsg && (
                    <div className="my-4 p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-sm flex items-center justify-between gap-3 shadow-lg">
                        <div className="flex items-center gap-2.5">
                            <span className="text-lg">🎉</span>
                            <span>{successMsg}</span>
                        </div>
                        <button onClick={() => setSuccessMsg('')} className="text-xs text-emerald-300 hover:text-white font-bold">Dismiss</button>
                    </div>
                )}

                {/* 5-Minute Reservation Banner (Flow 5) */}
                {heldReservation && countdown > 0 && (
                    <div className="my-4 p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border border-amber-500/40 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-2xl font-mono font-bold text-amber-400">
                                ⏳
                            </div>
                            <div>
                                <h4 className="text-sm font-extrabold text-amber-300">
                                    Slot Held for You: {heldReservation.start_time} - {heldReservation.end_time}
                                </h4>
                                <p className="text-xs text-gray-300 mt-0.5">
                                    Locked Price: <strong className="text-white font-mono">₹{heldReservation.price}</strong>. Complete payment before the timer reaches zero.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-center px-4 py-2 bg-black/40 rounded-xl border border-amber-500/30">
                                <span className="text-[10px] text-gray-400 block font-bold uppercase">Time Remaining</span>
                                <span className="text-xl font-mono font-black text-amber-400">
                                    {formatTimer(countdown)}
                                </span>
                            </div>

                            <button
                                onClick={handlePayAndConfirm}
                                disabled={paying}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            >
                                {paying ? 'Processing Wallet Transfer...' : 'Pay with Wallet →'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Booking Workspace */}
                {loading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
                        <div className="lg:col-span-8"><LoadingSkeleton count={3} /></div>
                        <div className="lg:col-span-4 h-[400px] bg-white/5 rounded-3xl animate-pulse" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
                        {/* Left Column: Plug Switcher & Slot Matrix */}
                        <div className="lg:col-span-8 flex flex-col gap-6">
                            {/* Controls: Date Picker & Plugs */}
                            <div className="bg-[#0b0e1e]/90 border border-white/10 rounded-3xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
                                {/* Date Picker */}
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Date:</span>
                                    <input
                                        type="date"
                                        value={date}
                                        min={new Date().toISOString().split('T')[0]}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="bg-[#12162d] border border-white/10 rounded-xl px-3.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                {/* Plug Tabs */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mr-1">Plugs:</span>
                                    {availability.map((p) => {
                                        const isSel = selectedPlug?.id === p.plug.id
                                        const isMaint = p.plug.status === 'MAINTENANCE'

                                        return (
                                            <button
                                                key={p.plug.id}
                                                onClick={() => {
                                                    setSelectedPlug(p.plug)
                                                    setSelectedSlot(null)
                                                    setQuote(null)
                                                }}
                                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                                                    isSel
                                                        ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/20'
                                                        : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/20'
                                                }`}
                                            >
                                                <span>🔌 {p.plug.name}</span>
                                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isSel ? 'bg-black/20 text-black' : 'bg-white/10 text-gray-400'}`}>
                                                    {p.plug.connector}
                                                </span>
                                                {isMaint && (
                                                    <span className="text-[9px] bg-red-500 text-white px-1 rounded uppercase">Maint</span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Slot Availability Grid (Flow 3) */}
                            <div className="bg-[#0b0e1e]/90 border border-white/10 rounded-3xl p-6 shadow-xl">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-white/5">
                                    <div>
                                        <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                                            Charging Slots for {selectedPlug?.name}
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            Select an open interval. State updates in real-time across all connected drivers.
                                        </p>
                                    </div>

                                    {/* 3-State Legend */}
                                    <div className="flex items-center gap-3 text-xs font-semibold">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-md bg-emerald-500/20 border border-emerald-500/60" />
                                            <span className="text-emerald-400">Available</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-md bg-amber-500/30 border border-amber-500/60" />
                                            <span className="text-amber-400">Held (5m)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-md bg-white/5 border border-white/10" />
                                            <span className="text-gray-500">Booked/Past</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Matrix */}
                                {selectedPlug?.status === 'MAINTENANCE' ? (
                                    <div className="p-12 text-center bg-red-950/20 border border-red-500/20 rounded-2xl">
                                        <div className="text-4xl mb-2">🛠️</div>
                                        <h4 className="text-base font-bold text-red-300">Plug Under Maintenance</h4>
                                        <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                                            This charging port is temporarily offline for maintenance. Please switch to another plug at this station.
                                        </p>
                                    </div>
                                ) : slots.length === 0 ? (
                                    <div className="p-10 text-center text-gray-400 text-sm">
                                        No time slots configured for this date.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                        {slots.map((s) => {
                                            const isSelected = selectedSlot?.slot_id === s.slot_id
                                            const isAvail = s.status === 'AVAILABLE'
                                            const isHeld = s.status === 'HELD'
                                            const isBooked = s.status === 'BOOKED'
                                            const isPast = s.status === 'PAST'

                                            let cardStyles = ''
                                            if (isSelected) {
                                                cardStyles = 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-[1.02]'
                                            } else if (isAvail) {
                                                cardStyles = 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/60 text-emerald-200 cursor-pointer hover:bg-emerald-950/40'
                                            } else if (isHeld) {
                                                cardStyles = 'bg-amber-950/20 border-amber-500/40 text-amber-300 opacity-80 cursor-not-allowed'
                                            } else {
                                                cardStyles = 'bg-white/5 border-white/5 text-gray-500 opacity-50 cursor-not-allowed'
                                            }

                                            return (
                                                <button
                                                    key={s.slot_id}
                                                    disabled={!s.can_book}
                                                    onClick={() => handleSlotClick(s)}
                                                    className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${cardStyles}`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs font-mono font-bold">
                                                            {s.start_time} - {s.end_time}
                                                        </span>
                                                        {isHeld && (
                                                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                                                Held
                                                            </span>
                                                        )}
                                                        {isBooked && (
                                                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-gray-400">
                                                                Booked
                                                            </span>
                                                        )}
                                                        {isPast && (
                                                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
                                                                Past
                                                            </span>
                                                        )}
                                                        {isAvail && (
                                                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isSelected ? 'bg-black/20 text-black' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                                                Open
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="text-[11px] opacity-80 font-semibold">
                                                        {isAvail ? 'Tap to Select' : isHeld ? 'Driver Holding' : 'Unavailable'}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: AI Dynamic Pricing & Booking Flow (Flow 4 & 5) */}
                        <div className="lg:col-span-4 flex flex-col gap-6">
                            <div className="bg-[#0b0e1e]/90 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 sticky top-24">
                                <div>
                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">
                                        Step 2: AI Pricing & Reservation
                                    </span>
                                    <h3 className="text-xl font-black text-white mt-1">
                                        Session Configuration
                                    </h3>
                                </div>

                                {/* Selected Slot Summary */}
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs flex flex-col gap-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Selected Station:</span>
                                        <span className="font-bold text-white">{station?.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Charging Plug:</span>
                                        <span className="font-bold text-white">{selectedPlug?.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Date & Slot:</span>
                                        <span className="font-bold text-emerald-300">
                                            {selectedSlot ? `${date} @ ${selectedSlot.start_time}` : 'None Selected'}
                                        </span>
                                    </div>
                                </div>

                                {/* Duration Selector */}
                                <div>
                                    <label className="text-xs font-semibold text-gray-300 mb-2 block">
                                        Charging Duration:
                                    </label>
                                    <select
                                        value={duration}
                                        onChange={handleDurationChange}
                                        className="w-full bg-[#12162d] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-semibold focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value={1}>1 Hour Session</option>
                                        <option value={2}>2 Hours Session</option>
                                        <option value={3}>3 Hours Session</option>
                                        <option value={4}>4 Hours Session</option>
                                    </select>
                                </div>

                                {/* AI Estimate CTA */}
                                {!quote && (
                                    <button
                                        onClick={handleGetAIPrice}
                                        disabled={!selectedSlot || predicting}
                                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                                    >
                                        {predicting ? 'Calculating PyTorch DQN Quote...' : '⚡ Get AI Price Estimate'}
                                    </button>
                                )}

                                {/* AI Quote Card (Flow 4) */}
                                {quote && (
                                    <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 flex flex-col gap-3 animate-fade-in-up">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                                                DQN Dynamic Price Quoted
                                            </span>
                                            <span className="text-2xl font-mono font-black text-white">
                                                ₹{quote.price}
                                            </span>
                                        </div>

                                        <p className="text-[11px] text-gray-300 bg-white/5 p-2.5 rounded-xl border border-white/5 leading-relaxed">
                                            💡 <strong>Grid Analysis:</strong> {quote.reason}
                                        </p>

                                        <div className="text-[11px] text-gray-400 flex justify-between pt-1">
                                            <span>Session Interval:</span>
                                            <span className="font-mono text-white font-bold">{quote.start_time} - {quote.end_time}</span>
                                        </div>

                                        {/* Hold Slot CTA (Flow 5) */}
                                        {!heldReservation && (
                                            <button
                                                onClick={handleHoldSlot}
                                                disabled={holding}
                                                className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                                            >
                                                {holding ? 'Locking Reservation...' : '🔒 Hold Slot (5 Mins)'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Confirmation Booking Modal (Flow 5 Receipt) */}
            {bookingReceipt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#0b0e1e] border border-emerald-500/40 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative text-center">
                        <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
                            ✓
                        </div>

                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">
                            Booking Confirmed
                        </span>
                        <h3 className="text-2xl font-black text-white mt-1">
                            {bookingReceipt.booking_id}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                            Your charging slot is locked and ready.
                        </p>

                        <div className="my-5 p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-left flex flex-col gap-2">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Station:</span>
                                <span className="font-bold text-white">{bookingReceipt.station}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Port:</span>
                                <span className="font-bold text-white">{bookingReceipt.plug}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Date:</span>
                                <span className="font-bold text-white">{bookingReceipt.date}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Interval:</span>
                                <span className="font-bold text-emerald-300 font-mono">{bookingReceipt.start_time} - {bookingReceipt.end_time}</span>
                            </div>
                            <div className="flex justify-between border-t border-white/10 pt-2 mt-1">
                                <span className="text-gray-400">Amount Paid:</span>
                                <span className="font-mono font-bold text-emerald-400 text-sm">₹{bookingReceipt.amount}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/bookings')}
                                className="flex-1 py-3 rounded-xl bg-emerald-500 text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors"
                            >
                                View My Bookings
                            </button>
                            <button
                                onClick={() => setBookingReceipt(null)}
                                className="px-4 py-3 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/15 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
