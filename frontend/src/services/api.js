const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000'

function getHeaders(auth = true) {
    const headers = { 'Content-Type': 'application/json' }
    if (auth) {
        const token = localStorage.getItem('token')
        if (token) headers['Authorization'] = `Bearer ${token}`
    }
    return headers
}

async function handleResponse(res) {
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.success === false) {
        let errorMsg = data.error || data.message || data.msg
        if (!errorMsg) {
            if (res.status === 401 || res.status === 422) {
                errorMsg = 'Session expired or not authenticated. Please log in.'
            } else {
                errorMsg = `Request failed with status ${res.status}`
            }
        }
        throw new Error(errorMsg)
    }
    return data
}

// 1. Auth APIs
export async function loginUser(identifier, password) {
    const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: getHeaders(false),
        body: JSON.stringify({ username: identifier, password })
    })
    return handleResponse(res)
}

export async function registerUser(userData) {
    const res = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: getHeaders(false),
        body: JSON.stringify(userData)
    })
    return handleResponse(res)
}

// 2. Stations APIs
export async function fetchStations(filters = {}) {
    const params = new URLSearchParams()
    if (filters.location && filters.location !== 'All') params.append('location', filters.location)
    if (filters.connector && filters.connector !== 'All') params.append('connector', filters.connector)
    if (filters.power && filters.power !== 'All') params.append('power', filters.power)

    const res = await fetch(`${API_URL}/api/stations?${params.toString()}`)
    return handleResponse(res)
}

export async function fetchStationDetails(stationId) {
    const res = await fetch(`${API_URL}/api/stations/${stationId}`)
    return handleResponse(res)
}

// 3. Slot Availability API
export async function fetchStationAvailability(stationId, date) {
    const res = await fetch(`${API_URL}/api/stations/${stationId}/availability?date=${date}`)
    return handleResponse(res)
}

// 4. AI Pricing API
export async function predictPrice(payload) {
    const res = await fetch(`${API_URL}/api/predict`, {
        method: 'POST',
        headers: getHeaders(false),
        body: JSON.stringify(payload)
    })
    return handleResponse(res)
}

// 5. Atomic Slot Hold & Confirm APIs
export async function holdSlot(payload) {
    const res = await fetch(`${API_URL}/api/slots/hold`, {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify(payload)
    })
    return handleResponse(res)
}

export async function confirmBooking(slotId) {
    const res = await fetch(`${API_URL}/api/slots/confirm`, {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ slot_id: slotId })
    })
    return handleResponse(res)
}

// 6. User Bookings & Wallet APIs
export async function fetchUserBookings() {
    const res = await fetch(`${API_URL}/api/user/bookings`, {
        headers: getHeaders(true)
    })
    return handleResponse(res)
}

export async function fetchUserWallet() {
    const token = localStorage.getItem('token')
    if (!token) return { success: false, wallet_balance: 0 }
    const res = await fetch(`${API_URL}/api/user/wallet`, {
        headers: getHeaders(true)
    })
    return handleResponse(res)
}

export async function topupWallet(amount) {
    const res = await fetch(`${API_URL}/api/user/wallet/topup`, {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ amount: Number(amount) })
    })
    return handleResponse(res)
}

// 7. Cancellation API
export async function cancelBooking(bookingId) {
    const res = await fetch(`${API_URL}/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: getHeaders(true)
    })
    return handleResponse(res)
}

// 8. Lender APIs
export async function fetchLenderStations() {
    const res = await fetch(`${API_URL}/api/lenders/mine`, {
        headers: getHeaders(true)
    })
    return handleResponse(res)
}

export async function registerLenderStation(stationData) {
    const res = await fetch(`${API_URL}/api/lenders/stations`, {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify(stationData)
    })
    return handleResponse(res)
}

export async function togglePlugMaintenance(plugId) {
    const res = await fetch(`${API_URL}/api/lenders/plugs/${plugId}/maintenance`, {
        method: 'PATCH',
        headers: getHeaders(true)
    })
    return handleResponse(res)
}

export async function fetchLenderAnalytics() {
    const res = await fetch(`${API_URL}/api/lenders/analytics`, {
        headers: getHeaders(true)
    })
    return handleResponse(res)
}

// 9. Real-Time SSE Stream Hook / Factory
export function createSlotSSE(onUpdate, onStatusChange) {
    const es = new EventSource(`${API_URL}/api/slots/stream`)
    
    es.addEventListener('open', () => {
        if (onStatusChange) onStatusChange('connected')
    })

    es.addEventListener('slot_change', (e) => {
        try {
            const data = JSON.parse(e.data)
            if (onUpdate) onUpdate(data)
        } catch (err) {
            console.error('SSE JSON error:', err)
        }
    })

    es.onerror = () => {
        if (onStatusChange) onStatusChange('reconnecting')
    }

    return es
}
