import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import BookSlot from './pages/BookSlot'
import MyBookings from './pages/MyBookings'
import LenderDashboard from './pages/LenderDashboard'

function PrivateRoute({ children, role }) {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
    const userRole = localStorage.getItem('role')

    if (!isLoggedIn) {
        return <Navigate to="/login" replace />
    }

    if (role && userRole !== role) {
        const target = userRole === 'lender' ? '/lender' : '/home'
        return <Navigate to={target} replace />
    }

    return children
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public Auth Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Driver Routes */}
                <Route path="/home" element={<PrivateRoute role="driver"><Home /></PrivateRoute>} />
                <Route path="/book-station/:stationId" element={<PrivateRoute role="driver"><BookSlot /></PrivateRoute>} />
                <Route path="/bookings" element={<PrivateRoute role="driver"><MyBookings /></PrivateRoute>} />

                {/* Lender Routes */}
                <Route path="/lender" element={<PrivateRoute role="lender"><LenderDashboard /></PrivateRoute>} />

                {/* Root Redirection */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    )
}
