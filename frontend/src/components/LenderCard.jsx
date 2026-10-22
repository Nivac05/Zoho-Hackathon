export default function LenderCard({ lender, selected, onSelect }) {
    return (
        <div
            id={`lender-${lender._id || lender.id}`}
            onClick={onSelect}
            className="flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200"
            style={{
                background: selected ? 'rgba(0,255,136,.08)' : 'rgba(255,255,255,.03)',
                border: selected ? '1px solid rgba(0,255,136,.35)' : '1px solid rgba(255,255,255,.07)',
                boxShadow: selected ? '0 0 24px rgba(0,255,136,.1)' : 'none',
                transform: selected ? 'scale(1.01)' : 'scale(1)',
            }}
        >
            {/* Icon */}
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
                style={{ background: lender.available ? 'rgba(0,255,136,.12)' : 'rgba(255,68,102,.1)' }}
            >
                ⚡
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <p className="text-white text-sm font-semibold leading-tight truncate">{lender.name}</p>
                    <span
                        className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                            background: lender.available ? 'rgba(0,255,136,.12)' : 'rgba(255,68,102,.12)',
                            color: lender.available ? '#00ff88' : '#ff4466',
                            border: `1px solid ${lender.available ? 'rgba(0,255,136,.3)' : 'rgba(255,68,102,.3)'}`,
                        }}
                    >
                        {lender.available ? 'Available' : 'Busy'}
                    </span>
                </div>
                <p className="text-gray-500 text-xs mt-0.5 truncate">{lender.address}</p>
                <div className="flex items-center gap-3 mt-2">
                    <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(0,212,255,.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,.2)' }}
                    >
                        {lender.power}
                    </span>
                    <span className="text-xs text-gray-500">{lender.connector}</span>
                    <span className="text-xs text-gray-500 ml-auto">⭐ {lender.rating}</span>
                </div>
            </div>
        </div>
    )
}
