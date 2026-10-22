import { useNavigate } from 'react-router-dom'

export default function ErrorUI({ message }) {
    const navigate = useNavigate()
    return (
        <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
            <div className="glass-card max-w-md w-full text-center py-12 animate-scale-in">
                <div className="text-5xl mb-5">⚠️</div>
                <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed">{message}</p>
                <button onClick={() => navigate('/home')} className="neon-btn mx-auto">
                    ← Back to Home
                </button>
            </div>
        </div>
    )
}
