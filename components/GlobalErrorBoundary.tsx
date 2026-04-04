"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class GlobalErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error("[IdeaConnect Error Boundary]", error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback ?? (
                    <div className="min-h-screen flex items-center justify-center bg-background">
                        <div className="text-center space-y-4 p-8 max-w-md">
                            <div className="flex justify-center text-slate-400">
                                <AlertTriangle size={40} />
                            </div>
                            <h2 className="text-xl font-semibold text-foreground">
                                Something went wrong
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                Something went wrong. Your ideas and data are safe.
                            </p>
                            <button
                                onClick={() => this.setState({ hasError: false })}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                )
            );
        }
        return this.props.children;
    }
}
