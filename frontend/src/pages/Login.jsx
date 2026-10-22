import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { loginUser } from '../services/api'

export default function Login() {
    const [form, setForm] = useState({ username: '', password: '' })
    const [error, setError] = useState('')
    const [info, setInfo] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        if (new URLSearchParams(location.search).get('registered')) setInfo('Account created! Sign in below.')
        if (localStorage.getItem('isLoggedIn') === 'true') {
            navigate(localStorage.getItem('role') === 'lender' ? '/lender' : '/home')
        }
    }, [])

    const doLogin = async (username, password) => {
        setError(''); setInfo(''); setLoading(true)
        try {
            const d = await loginUser(username, password)
            localStorage.setItem('isLoggedIn', 'true')
            localStorage.setItem('token', d.token)
            localStorage.setItem('role', d.user.role)
            localStorage.setItem('username', d.user.username)
            localStorage.setItem('user_id', d.user.id)
            navigate(d.user.role === 'lender' ? '/lender' : '/home')
        } catch (err) {
            setError(err.message || 'Invalid username or password.')
        } finally { setLoading(false) }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.username.trim() || !form.password.trim()) { setError('Both fields are required.'); return }
        await doLogin(form.username, form.password)
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex',
            background: 'var(--slate-900)',
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            animation: 'page-in .4s ease-out both',
        }}>
            {/* ── Left: EV Brand Panel ── */}
            <div className="ev-grid-bg" style={{
                flex: '0 0 44%',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                padding: '44px 52px',
                background: 'linear-gradient(150deg, #040c18 0%, #050e1a 60%, #020810 100%)',
                borderRight: '1px solid rgba(6,182,212,.1)',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Scan line */}
                <div className="ev-scan-line" />

                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 11,
                        background: 'var(--green)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, fontWeight: 900,
                        boxShadow: '0 4px 20px rgba(6,182,212,.5)',
                    }}>
                        <span className="bolt-animate">⚡</span>
                    </div>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--white)', letterSpacing: '-.01em', lineHeight: 1 }}>C-HIVE</div>
                        <div style={{ fontSize: 9, color: 'var(--green)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>Smart EV Grid</div>
                    </div>
                </div>

                {/* Main Content */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: 38, fontWeight: 800, color: 'var(--white)', lineHeight: 1.15, letterSpacing: '-.03em', marginBottom: 18 }}>
                        Charge smarter,<br/>
                        <span style={{ color: 'var(--green)' }}>drive further.</span>
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--slate-400)', lineHeight: 1.75, maxWidth: 340, marginBottom: 40 }}>
                        Reserve guaranteed EV charging slots across Chennai with real-time availability, AI dynamic pricing, and instant wallet payments.
                    </p>

                    {/* Feature rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {[
                            { icon: '⚡', color: 'rgba(6,182,212,.12)', border: 'rgba(6,182,212,.22)', label: 'Instant Booking', sub: '5-min atomic hold — no one can snipe your slot' },
                            { icon: '🗺', color: 'rgba(14,165,233,.1)', border: 'rgba(14,165,233,.2)', label: 'Live Map', sub: 'Real-time slot sync via Server-Sent Events' },
                            { icon: '🤖', color: 'rgba(168,85,247,.1)', border: 'rgba(168,85,247,.18)', label: 'AI Dynamic Pricing', sub: 'Deep Q-Network adjusts rates by grid load & time' },
                        ].map((f, i) => (
                            <div key={f.label} style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                animation: `card-rise .4s ease-out ${.1 + i * .1}s both`,
                            }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 10,
                                    background: f.color, border: `1px solid ${f.border}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 18, flexShrink: 0,
                                }}>
                                    {f.icon}
                                </div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', marginBottom: 2 }}>{f.label}</div>
                                    <div style={{ fontSize: 11, color: 'var(--slate-400)', lineHeight: 1.5 }}>{f.sub}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.18)', position: 'relative', zIndex: 1 }}>
                    © 2025 C-HIVE · Zoho Hackathon · Chennai
                </p>
            </div>

            {/* ── Right: Auth Form ── */}
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                justifyContent: 'center', alignItems: 'center',
                padding: '48px 40px',
                animation: 'card-rise .45s ease-out .1s both',
            }}>
                <div style={{ width: '100%', maxWidth: 390 }}>

                    {/* Heading */}
                    <div style={{ marginBottom: 32 }}>
                        <div className="kicker" style={{ marginBottom: 8 }}>Welcome back</div>
                        <h1 style={{ fontSize: 30, fontWeight: 800, color: 'var(--white)', letterSpacing: '-.03em', margin: 0 }}>
                            Sign in to your account
                        </h1>
                    </div>

                    {/* Alerts */}
                    {info && (
                        <div className="alert-success" style={{ marginBottom: 20, fontSize: 13 }}>
                            <span>✅</span> {info}
                        </div>
                    )}
                    {error && (
                        <div className="alert-error" style={{ marginBottom: 20, fontSize: 13 }}>
                            <span>⚠</span> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div>
                            <label className="form-label">Username or Email</label>
                            <input
                                className="form-input"
                                type="text"
                                required
                                placeholder="driver1 or lender1"
                                value={form.username}
                                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                            />
                        </div>

                        <div>
                            <label className="form-label">Password</label>
                            <input
                                className="form-input"
                                type="password"
                                required
                                placeholder="••••••••"
                                value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading}
                            style={{ marginTop: 6, padding: '14px 22px', width: '100%', fontSize: 15, borderRadius: 12 }}
                        >
                            {loading ? (
                                <>
                                    <span style={{ display: 'inline-block', animation: 'bolt-pulse .8s ease-in-out infinite' }}>⚡</span>
                                    Authenticating…
                                </>
                            ) : 'Sign in →'}
                        </button>
                    </form>

                    {/* Demo quick logins */}
                    <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.2)', textTransform: 'uppercase', letterSpacing: '.1em', textAlign: 'center', marginBottom: 12 }}>
                            Quick demo access
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {[
                                { label: '🚗  Driver — Arun', un: 'driver1', pw: 'password123', accent: 'rgba(14,165,233,.1)', border: 'rgba(14,165,233,.2)' },
                                { label: '⚡  Lender — Sundar', un: 'lender1', pw: 'password123', accent: 'rgba(6,182,212,.08)', border: 'rgba(6,182,212,.2)' },
                            ].map(d => (
                                <button
                                    key={d.un}
                                    type="button"
                                    onClick={() => doLogin(d.un, d.pw)}
                                    style={{
                                        padding: '10px 14px', fontSize: 12, fontWeight: 600,
                                        background: d.accent, border: `1px solid ${d.border}`,
                                        borderRadius: 10, color: 'var(--slate-200)', cursor: 'pointer',
                                        transition: 'all .15s', fontFamily: 'inherit',
                                        letterSpacing: '.01em',
                                    }}
                                    onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.color = '#fff' }}
                                    onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.color = 'var(--slate-200)' }}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--slate-400)', marginTop: 24 }}>
                        New here?{' '}
                        <Link to="/register" style={{ color: 'var(--green)', fontWeight: 700 }}>
                            Create account →
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
