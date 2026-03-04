export default function IdeaCardSkeleton() {
    return (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 flex flex-col gap-4 animate-pulse">
            {/* Top row: Status + Date */}
            <div className="flex justify-between items-center">
                <div className="h-5 w-16 bg-slate-200 rounded-full" />
                <div className="h-3 w-20 bg-slate-100 rounded" />
            </div>

            {/* Category + Title + Hook */}
            <div>
                <div className="h-3 w-24 bg-slate-200 rounded mb-2" />
                <div className="h-6 w-full bg-slate-300 rounded mb-2" />
                <div className="h-6 w-3/4 bg-slate-300 rounded mb-2" />
                <div className="h-4 w-full bg-slate-100 rounded" />
                <div className="h-4 w-2/3 bg-slate-100 rounded mt-1" />
            </div>

            {/* Badge row */}
            <div className="flex gap-2">
                <div className="h-6 w-20 bg-slate-200 rounded-full" />
                <div className="h-6 w-24 bg-slate-200 rounded-full" />
            </div>

            {/* Stats + Actions */}
            <div className="flex flex-col gap-3 mt-auto">
                <div className="flex items-center gap-4">
                    <div className="h-4 w-16 bg-slate-100 rounded" />
                    <div className="h-4 w-16 bg-slate-100 rounded" />
                </div>
                <div className="flex gap-2 pt-3 border-t border-slate-50">
                    <div className="h-8 w-20 bg-slate-100 rounded-xl" />
                </div>
            </div>
        </div>
    );
}
