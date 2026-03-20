import { Shield, Hash, Clock, ExternalLink } from "lucide-react";

interface Props {
    genesisHash: string;
    simHash: string | null;
    createdAt: Date | null;
    ideaId: string;
}

export default function GenesisProof({
    genesisHash, simHash, createdAt, ideaId,
}: Props) {
    const shortGenesis = `${genesisHash.slice(0, 8)}...${genesisHash.slice(-8)}`;
    const shortSim = simHash ? `${simHash.slice(0, 10)}` : "—";

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">

            {/* Header */}
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-teal-500/10 rounded-lg">
                    <Shield size={15} className="text-teal-400" />
                </div>
                <h4 className="text-sm font-bold text-slate-200">Genesis Proof</h4>
                <span className="ml-auto text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                    Anchored
                </span>
            </div>

            <p className="text-xs text-slate-400">
                This idea is cryptographically anchored to the IdeaConnect Genesis Registry.
                The hash below is an immutable proof of original authorship and timestamp.
            </p>

            {/* Hash rows */}
            <div className="space-y-2">
                <div className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3">
                    <Hash size={13} className="text-teal-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
                            Genesis Hash (SHA-256)
                        </p>
                        <p className="text-xs font-mono text-teal-300 truncate">
                            {shortGenesis}
                        </p>
                    </div>
                </div>

                {simHash && (
                    <div className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3">
                        <Hash size={13} className="text-violet-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
                                SimHash (Fuzzy Fingerprint)
                            </p>
                            <p className="text-xs font-mono text-violet-300">{shortSim}</p>
                        </div>
                    </div>
                )}

                {createdAt && (
                    <div className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3">
                        <Clock size={13} className="text-slate-400 shrink-0" />
                        <div className="flex-1">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
                                Anchored At
                            </p>
                            <p className="text-xs text-slate-300">
                                {new Date(createdAt).toUTCString()}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Verify link */}
            <a
                href={`/registry?highlight=${ideaId}`}
                className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors font-semibold"
            >
                <ExternalLink size={11} />
                View in Genesis Registry
            </a>
        </div>
    );
}
