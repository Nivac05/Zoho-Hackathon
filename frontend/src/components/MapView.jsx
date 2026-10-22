import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const CENTRES = {
    'ECR':          [12.8236, 80.2295],
    'Anna Nagar':   [13.0853, 80.2100],
    'Medavakkam':   [12.9210, 80.1770],
    'Pammal':       [12.9675, 80.1302],
    'Maduravoyal':  [13.0601, 80.1651],
}

function createPin(available, selected) {
    const cls = selected
        ? 'chive-pin chive-pin-green'
        : available
        ? 'chive-pin chive-pin-green'
        : 'chive-pin chive-pin-red'

    const icon = selected ? '⚡' : available ? '⚡' : '✕'
    const opacity = selected ? 1 : available ? 0.9 : 0.6

    return L.divIcon({
        className: '',
        html: `<div class="${cls}" style="opacity:${opacity};${selected ? 'box-shadow:0 0 20px rgba(34,197,94,0.7)' : ''}">
                 <span class="chive-pin-inner">${icon}</span>
               </div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 42],
        popupAnchor: [0, -46],
    })
}

function FlyTo({ lender }) {
    const map = useMap()
    useEffect(() => {
        if (lender) map.flyTo([lender.lat, lender.lng], 16, { duration: 0.8 })
    }, [lender])
    return null
}

export default function MapView({ lenders = [], locationName, selectedLender, onSelectLender }) {
    const centre = CENTRES[locationName] || [13.0827, 80.2707]

    return (
        <div className="w-full h-full dark-map-tiles">
            <MapContainer
                center={centre}
                zoom={13}
                style={{ width: '100%', height: '100%' }}
                zoomControl
                scrollWheelZoom
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    maxZoom={19}
                />
                <FlyTo lender={selectedLender} />

                {lenders.map(l => {
                    const id = l.id || l._id
                    const selId = selectedLender?.id || selectedLender?._id
                    const isSel = id === selId

                    return (
                        <Marker
                            key={id}
                            position={[l.lat, l.lng]}
                            icon={createPin(l.available, isSel)}
                            eventHandlers={{ click: () => onSelectLender(l) }}
                        >
                            <Popup>
                                <div style={{ minWidth: 170 }}>
                                    <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#f1f5f9' }}>
                                        {l.name}
                                    </p>
                                    <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>
                                        {l.address}
                                    </p>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        <span style={{
                                            background: l.available ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)',
                                            color: l.available ? '#4ade80' : '#f87171',
                                            border: `1px solid ${l.available ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`,
                                            borderRadius: 999, fontSize: 10, padding: '2px 10px', fontWeight: 700,
                                        }}>
                                            {l.available ? '● Available' : '● Full'}
                                        </span>
                                        <span style={{
                                            background: 'rgba(245,158,11,.12)', color: '#fbbf24',
                                            border: '1px solid rgba(245,158,11,.25)',
                                            borderRadius: 999, fontSize: 10, padding: '2px 10px', fontWeight: 700,
                                        }}>
                                            {l.power}
                                        </span>
                                    </div>
                                    <p style={{ color: '#64748b', fontSize: 11, marginTop: 8 }}>
                                        ⚡ {l.connector}
                                    </p>
                                </div>
                            </Popup>
                        </Marker>
                    )
                })}
            </MapContainer>
        </div>
    )
}
