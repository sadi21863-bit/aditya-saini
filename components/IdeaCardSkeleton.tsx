export default function IdeaCardSkeleton() {
    return (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 flex flex-col gap-4 animate-pulse">
            <div className="flex justify-between items-center">
                <div className="h-5 w-16 bg-gray-200 dark:bg-slate-700 rounded-full" />
                <div className="h-3 w-20 bg-gray-100 dark:bg-slate-800 rounded" />
            </div>
            <div>
                <div className="h-3 w-24 bg-gray-200 dark:bg-slate-700 rounded mb-2" />
                <div className="h-6 w-full bg-gray-300 dark:bg-slate-600 rounded mb-2" />
                <div className="h-6 w-3/4 bg-gray-300 dark:bg-slate-600 rounded mb-2" />
                <div className="h-4 w-full bg-gray-100 dark:bg-slate-800 rounded" />
                <div className="h-4 w-2/3 bg-gray-100 dark:bg-slate-800 rounded mt-1" />
            </div>
            <div className="flex gap-2">
                <div className="h-6 w-20 bg-gray-200 dark:bg-slate-700 rounded-full" />
                <div className="h-6 w-24 bg-gray-200 dark:bg-slate-700 rounded-full" />
            </div>
            <div className="flex flex-col gap-3 mt-auto">
                <div className="flex items-center gap-4">
                    <div className="h-4 w-16 bg-gray-100 dark:bg-slate-800 rounded" />
                    <div className="h-4 w-16 bg-gray-100 dark:bg-slate-800 rounded" />
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-50 dark:border-slate-800">
                    <div className="h-8 w-20 bg-gray-100 dark:bg-slate-800 rounded-xl" />
                </div>
            </div>
        </div>
    );
}
