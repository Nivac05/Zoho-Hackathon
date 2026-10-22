import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Chennai zone centres
const ZONE_CENTRES = {
    'ECR':          [12.8236, 80.2295],
    'Anna Nagar':   [13.0853, 80.2100],
    'Medavakkam':   [12.9210, 80.1770],
    'Pammal':       [12.9675, 80.1302],
    'Maduravoyal':  [13.0601, 80.1651],
    'default':      [13.0827, 80.2707],
}

function createPickerPin() {
    return L.divIcon({
        className: '',
        html: `<div class="chive-pin chive-pin-picker"><span class="chive-pin-inner">📍</span></div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 42],
    })
}

function FlyToZone({ zone }) {
    const map = useMap()
    useEffect(() => {
        const c = ZONE_CENTRES[zone] || ZONE_CENTRES.default
        map.flyTo(c, 14, { duration: 0.8 })
    }, [zone])
    return null
}

function FlyToCoords({ lat, lng }) {
    const map = useMap()
    useEffect(() => {
        if (lat && lng) map.flyTo([lat, lng], 17, { duration: 0.6 })
    }, [lat, lng])
    return null
}

// This is the click handler INSIDE the map container
function MapClickHandler({ onCoordsPicked }) {
    useMapEvents({
        click(e) {
            onCoordsPicked(e.latlng.lat, e.latlng.lng)
        }
    })
    return null
}

// Nominatim search result shape
// { place_id, display_name, lat, lon, address: { city, state, country } }

export default function MapPicker({ zone, lat, lng, onLocationSelect }) {
    const [markerPos, setMarkerPos] = useState(
        lat && lng ? [parseFloat(lat), parseFloat(lng)] : null
    )
    const [searchQuery, setSearchQuery] = useState('')
    const [suggestions, setSuggestions] = useState([])
    const [searchLoading, setSearchLoading] = useState(false)
    const [reverseLoading, setReverseLoading] = useState(false)
    const [resolvedAddress, setResolvedAddress] = useState('')
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [flyTarget, setFlyTarget] = useState(null)

    const searchRef = useRef(null)
    const debounceRef = useRef(null)
    const mapRef = useRef(null)

    // Sync external lat/lng changes
    useEffect(() => {
        if (lat && lng) {
            setMarkerPos([parseFloat(lat), parseFloat(lng)])
        }
    }, [lat, lng])

    // Reverse geocode a set of coordinates
    const reverseGeocode = useCallback(async (pLat, pLng) => {
        setReverseLoading(true)
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pLat}&lon=${pLng}&zoom=18&addressdetails=1`,
                { headers: { 'Accept-Language': 'en' } }
            )
            const data = await res.json()
            const addr = data.display_name || `${pLat.toFixed(5)}, ${pLng.toFixed(5)}`
            setResolvedAddress(addr)
            setSearchQuery(addr.split(',').slice(0, 3).join(',').trim())
            onLocationSelect(pLat, pLng, addr)
        } catch {
            const fallback = `${pLat.toFixed(5)}, ${pLng.toFixed(5)}`
            setResolvedAddress(fallback)
            onLocationSelect(pLat, pLng, fallback)
        } finally {
            setReverseLoading(false)
        }
    }, [onLocationSelect])

    // Handle map click
    const handleMapClick = useCallback((pLat, pLng) => {
        setMarkerPos([pLat, pLng])
        setDropdownOpen(false)
        reverseGeocode(pLat, pLng)
    }, [reverseGeocode])

    // Nominatim forward search (debounced 400ms)
    const handleSearchChange = (e) => {
        const q = e.target.value
        setSearchQuery(q)
        setDropdownOpen(true)

        clearTimeout(debounceRef.current)
        if (q.length < 3) { setSuggestions([]); return }

        debounceRef.current = setTimeout(async () => {
            setSearchLoading(true)
            try {
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ' Chennai India')}&limit=6&addressdetails=1&accept-language=en`
                const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
                const data = await res.json()
                setSuggestions(data)
            } catch {
                setSuggestions([])
            } finally {
                setSearchLoading(false)
            }
        }, 400)
    }

    const handleSuggestionClick = (s) => {
        const pLat = parseFloat(s.lat)
        const pLng = parseFloat(s.lon)
        setMarkerPos([pLat, pLng])
        setFlyTarget({ lat: pLat, lng: pLng })
        const addr = s.display_name
        setResolvedAddress(addr)
        setSearchQuery(addr.split(',').slice(0, 3).join(',').trim())
        setSuggestions([])
        setDropdownOpen(false)
        onLocationSelect(pLat, pLng, addr)
    }

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const centre = ZONE_CENTRES[zone] || ZONE_CENTRES.default

    return (
        <div className="flex flex-col gap-3 h-full">
            {/* ─── Search Bar like Google Maps ─── */}
            <div className="relative" ref={searchRef}>
                <div className="relative flex items-center">
                    <span className="absolute left-3 text-green-400 text-sm pointer-events-none">
                        🔍
                    </span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onFocus={() => suggestions.length > 0 && setDropdownOpen(true)}
                        placeholder="Search location, address or landmark..."
                        className="form-input pl-9 pr-16"
                        style={{ background: '#0f172a' }}
                    />
                    <div className="absolute right-3 flex items-center gap-2">
                        {searchLoading && (
                            <span className="text-[11px] text-green-400 animate-pulse">Searching…</span>
                        )}
                        {reverseLoading && (
                            <span className="text-[11px] text-blue-400 animate-pulse">Resolving…</span>
                        )}
                        {markerPos && !searchLoading && !reverseLoading && (
                            <span className="text-green-400 text-sm">✓</span>
                        )}
                    </div>
                </div>

                {/* Suggestions dropdown */}
                {dropdownOpen && suggestions.length > 0 && (
                    <div className="location-search-dropdown">
                        {suggestions.map((s, i) => {
                            const mainText = s.display_name.split(',').slice(0, 2).join(',').trim()
                            const subText = s.display_name.split(',').slice(2, 5).join(',').trim()
                            return (
                                <div
                                    key={s.place_id || i}
                                    className="location-search-item"
                                    onMouseDown={() => handleSuggestionClick(s)}
                                >
                                    <span className="location-search-icon">
                                        {s.type === 'road' ? '🛣️' : s.type === 'residential' ? '🏘️' : '📍'}
                                    </span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>
                                            {mainText}
                                        </div>
                                        {subText && (
                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                                {subText}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Hint text */}
            <p style={{ fontSize: 11, color: '#475569', marginTop: -6 }}>
                Search above <em>or</em> click anywhere on the map to drop a pin
            </p>

            {/* ─── Map ─── */}
            <div
                className="flex-1 rounded-xl overflow-hidden border border-white/10 dark-map-tiles"
                style={{ minHeight: 320, cursor: 'crosshair' }}
            >
                <MapContainer
                    center={centre}
                    zoom={14}
                    style={{ width: '100%', height: '100%', minHeight: 320 }}
                    zoomControl
                    scrollWheelZoom
                    whenCreated={(m) => { mapRef.current = m }}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        maxZoom={19}
                    />
                    <FlyToZone zone={zone} />
                    {flyTarget && <FlyToCoords lat={flyTarget.lat} lng={flyTarget.lng} />}
                    <MapClickHandler onCoordsPicked={handleMapClick} />
                    {markerPos && (
                        <Marker position={markerPos} icon={createPickerPin()} />
                    )}
                </MapContainer>
            </div>

            {/* ─── Resolved address confirmation ─── */}
            {resolvedAddress && (
                <div className="alert-success animate-fade-in" style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 15 }}>📍</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4ade80', marginBottom: 2 }}>
                            Location Confirmed
                        </div>
                        <div style={{ fontSize: 12, color: '#86efac', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {resolvedAddress}
                        </div>
                    </div>
                    {markerPos && (
                        <div style={{ fontSize: 10, color: '#4ade80', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {markerPos[0].toFixed(4)}, {markerPos[1].toFixed(4)}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
