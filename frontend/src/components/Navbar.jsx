import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { fetchUserWallet } from '../services/api'

export default function Navbar() {
    const navigate = useNavigate()
    const loc = useLocation()
    const username = localStorage.getItem('username') || ''
    const role = localStorage.getItem('role') || 'driver'
    const [balance, setBalance] = useState(null)

    useEffect(() => {
        const load = async () => {
            try { const d = await fetchUserWallet(); if (d.success) setBalance(d.wallet_balance) }
            catch { /* silent */ }
        }
        load()
        const iv = setInterval(load, 15000)
        return () => clearInterval(iv)
    }, [])

    const logout = () => { localStorage.clear(); navigate('/login') }

    const links = role === 'lender'
        ? [{ path: '/lender', label: 'Stations' }]
        : [{ path: '/home', label: 'Find Chargers' }, { path: '/bookings', label: 'My Bookings' }]

    return (
        <nav className="chive-nav" style={{ height: 56 }}>
            <div style={{ maxWidth: 1560, margin: '0 auto', padding: '0 28px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

                {/* Logo */}
                <button
                    onClick={() => navigate(role === 'lender' ? '/lender' : '/home')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'opacity .15s' }}
                    onMouseOver={e => e.currentTarget.style.opacity = '.8'}
                    onMouseOut={e => e.currentTarget.style.opacity = '1'}
                >
                    <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, boxShadow: '0 2px 10px rgba(34,197,94,.4)',
                    }}>
                        <span className="bolt-animate" style={{ fontSize: 14 }}>⚡</span>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--white)', letterSpacing: '-.01em', lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif" }}>C-HIVE</div>
                        <div style={{ fontSize: 8, color: 'var(--green)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>Smart EV Grid</div>
                    </div>
                </button>

                {/* Navigation links */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {links.map(l => {
                        const active = loc.pathname === l.path
                        return (
                            <button
                                key={l.path}
                                onClick={() => navigate(l.path)}
                                style={{
                                    padding: '6px 14px', borderRadius: 8,
                                    fontSize: 13, fontWeight: 600,
                                    background: active ? 'rgba(34,197,94,.1)' : 'transparent',
                                    color: active ? 'var(--green)' : 'var(--slate-400)',
                                    border: active ? '1px solid rgba(34,197,94,.2)' : '1px solid transparent',
                                    cursor: 'pointer', transition: 'all .15s', fontFamily: "'Space Grotesk', sans-serif",
                                    position: 'relative',
                                }}
                                onMouseOver={e => { if (!active) { e.currentTarget.style.color = 'var(--white)'; e.currentTarget.style.background = 'rgba(255,255,255,.05)' } }}
                                onMouseOut={e => { if (!active) { e.currentTarget.style.color = 'var(--slate-400)'; e.currentTarget.style.background = 'transparent' } }}
                            >
                                {l.label}
                            </button>
                        )
                    })}
                </div>

                {/* Right: Wallet + User chip + Logout */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Wallet */}
                    {balance !== null && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '5px 12px', borderRadius: 8,
                            background: 'rgba(34,197,94,.07)', border: '1px solid rgba(34,197,94,.15)',
                        }}>
                            <span style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>₹</span>
                            <span className="stat-number" style={{ fontSize: 14, color: 'var(--green)' }}>
                                {Math.floor(balance)}
                            </span>
                        </div>
                    )}

                    {/* User chip */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 12px', borderRadius: 8,
                        background: 'var(--slate-800)', border: '1px solid rgba(255,255,255,.07)',
                    }}>
                        <div style={{
                            width: 22, height: 22, borderRadius: 6,
                            background: role === 'driver' ? '#1d4ed8' : '#16a34a',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                        }}>
                            {role === 'driver' ? '🚗' : '⚡'}
                        </div>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-200)', lineHeight: 1 }}>{username}</div>
                            <div style={{ fontSize: 9, color: 'var(--slate-600)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>{role}</div>
                        </div>
                    </div>

                    {/* Sign out */}
                    <button
                        onClick={logout}
                        style={{
                            padding: '6px 12px', fontSize: 12, fontWeight: 600,
                            color: 'var(--slate-600)', background: 'none',
                            border: '1px solid rgba(255,255,255,.06)',
                            borderRadius: 8, cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit',
                        }}
                        onMouseOver={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,.25)' }}
                        onMouseOut={e => { e.currentTarget.style.color = 'var(--slate-600)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)' }}
                    >
                        Sign out
                    </button>
                </div>
            </div>
        </nav>
    )
}
