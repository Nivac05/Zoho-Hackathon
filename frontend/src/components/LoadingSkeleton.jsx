export default function LoadingSkeleton() {
    return (
        <div className="glass-card space-y-4 animate-fade-in">
            <div className="skeleton h-4 w-32 rounded" />
            <div className="flex items-baseline gap-2">
                <div className="skeleton h-12 w-16 rounded-lg" />
                <div className="skeleton h-6 w-24 rounded" />
            </div>
            <div className="skeleton h-3 w-40 rounded" />
            <div className="skeleton h-10 w-full rounded-xl mt-2" />
        </div>
    )
}
