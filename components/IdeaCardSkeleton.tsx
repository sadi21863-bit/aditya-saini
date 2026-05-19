export default function IdeaCardSkeleton() {
    return (
        <div className="bg-ic-card border border-ic-rule rounded-2xl p-4 flex flex-col gap-4 animate-pulse">
            <div className="flex justify-between items-center">
                <div className="h-5 w-16 bg-ic-rule rounded-full" />
                <div className="h-3 w-20 bg-ic-rule rounded" />
            </div>
            <div>
                <div className="h-3 w-24 bg-ic-rule rounded mb-2" />
                <div className="h-6 w-full bg-ic-rule rounded mb-2" />
                <div className="h-6 w-3/4 bg-ic-rule rounded mb-2" />
                <div className="h-4 w-full bg-ic-paper-deep rounded" />
                <div className="h-4 w-2/3 bg-ic-paper-deep rounded mt-1" />
            </div>
            <div className="flex gap-2">
                <div className="h-6 w-20 bg-ic-rule rounded-full" />
                <div className="h-6 w-24 bg-ic-rule rounded-full" />
            </div>
            <div className="flex flex-col gap-3 mt-auto">
                <div className="flex items-center gap-4">
                    <div className="h-4 w-16 bg-ic-paper-deep rounded" />
                    <div className="h-4 w-16 bg-ic-paper-deep rounded" />
                </div>
                <div className="flex gap-2 pt-3 border-t border-ic-rule">
                    <div className="h-8 w-20 bg-ic-paper-deep rounded-xl" />
                </div>
            </div>
        </div>
    );
}
