import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { registerUser } from '../services/api'

export default function Register() {
    const [form, setForm] = useState({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'driver'
    })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        if (localStorage.getItem('isLoggedIn') === 'true') {
            navigate(localStorage.getItem('role') === 'lender' ? '/lender' : '/home')
        }
    }, [navigate])

    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (!form.name.trim() || !form.username.trim() || !form.email.trim() || !form.password.trim()) {
            setError('All fields are required.')
            return
        }

        if (form.password.length < 8) {
            setError('Password must contain at least 8 characters.')
            return
        }

        setLoading(true)
        try {
            await registerUser(form)
            navigate('/login?registered=true')
        } catch (err) {
            setError(err.message || 'Registration failed. Username or email may already be taken.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', background: '#0f172a', fontFamily: "'Plus Jakarta Sans', Inter, system-ui" }}>
            {/* Left panel – Branding & Value prop */}
            <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 52px', background: 'linear-gradient(160deg, #111827 60%, #0c2013 100%)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 16px rgba(34,197,94,0.4)' }}>⚡</div>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.03em' }}>C-HIVE</div>
                        <div style={{ fontSize: 9, color: '#4ade80', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Smart EV Grid</div>
                    </div>
                </div>

                <div>
                    <div style={{ fontSize: 34, fontWeight: 900, color: '#f1f5f9', lineHeight: 1.2, letterSpacing: '-0.03em', marginBottom: 16 }}>
                        Join the next-gen<br />
                        <span style={{ color: '#22c55e' }}>EV charging community.</span>
                    </div>
                    <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.7, maxWidth: 350 }}>
                        Whether you drive an electric vehicle or host a commercial or residential charger, C-HIVE connects you directly to smart power.
                    </p>

                    <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                                🚗
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>For Drivers</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>Reserve guaranteed slots with instant atomic locks</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                                ⚡
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>For Lenders</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>Monetize idle charging ports with auto-settlement</div>
                            </div>
                        </div>
                    </div>
                </div>

                <p style={{ fontSize: 11, color: '#334155' }}>© 2025 C-HIVE · Smart EV Infrastructure</p>
            </div>

            {/* Right panel – Register Form */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 40px' }}>
                <div style={{ width: '100%', maxWidth: 420 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', marginBottom: 6, letterSpacing: '-0.02em' }}>
                        Create your account
                    </h2>
                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
                        Get started in less than a minute
                    </p>

                    {error && (
                        <div className="alert-error" style={{ marginBottom: 16, fontSize: 12 }}>
                            <span>⚠️</span> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                            <label className="form-label">Full Name</label>
                            <input
                                className="form-input"
                                type="text"
                                required
                                placeholder="Cavin Real"
                                value={form.name}
                                onChange={set('name')}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label className="form-label">Username</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    required
                                    placeholder="cavin_ev"
                                    value={form.username}
                                    onChange={set('username')}
                                />
                            </div>
                            <div>
                                <label className="form-label">Role</label>
                                <select
                                    className="form-input"
                                    value={form.role}
                                    onChange={set('role')}
                                >
                                    <option value="driver">🚗 EV Driver</option>
                                    <option value="lender">⚡ Station Lender</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="form-label">Email Address</label>
                            <input
                                className="form-input"
                                type="email"
                                required
                                placeholder="cavin@example.com"
                                value={form.email}
                                onChange={set('email')}
                            />
                        </div>

                        <div>
                            <label className="form-label">Password</label>
                            <input
                                className="form-input"
                                type="password"
                                required
                                minLength={8}
                                placeholder="At least 8 characters"
                                value={form.password}
                                onChange={set('password')}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading}
                            style={{ marginTop: 8, padding: '13px 20px', width: '100%', fontSize: 14 }}
                        >
                            {loading ? 'Creating Account…' : 'Register Account →'}
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', fontSize: 12, color: '#475569', marginTop: 24 }}>
                        Already have an account?{' '}
                        <Link to="/login" style={{ color: '#4ade80', fontWeight: 700, textDecoration: 'none' }}>
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
