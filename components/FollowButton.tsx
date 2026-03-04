// components/FollowButton.tsx
"use client";

import { useState, useTransition } from "react";
import { followUser, unfollowUser } from "@/app/actions/socialActions";
import { UserPlus, UserCheck } from "lucide-react";

interface FollowButtonProps {
    currentUserId: string;
    targetUserId: string;
    targetHandle: string;
    initialIsFollowing: boolean;
    size?: "sm" | "md" | "lg";
    variant?: "default" | "compact";
}

export default function FollowButton({
    currentUserId,
    targetUserId,
    targetHandle,
    initialIsFollowing,
    size = "md",
    variant = "default",
}: FollowButtonProps) {
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [isPending, startTransition] = useTransition();

    // Don't show button if user is viewing their own profile
    if (currentUserId === targetUserId) {
        return null;
    }

    const handleToggleFollow = () => {
        startTransition(async () => {
            if (isFollowing) {
                const result = await unfollowUser(currentUserId, targetUserId);
                if (result.success) {
                    setIsFollowing(false);
                }
            } else {
                const result = await followUser(currentUserId, targetUserId);
                if (result.success) {
                    setIsFollowing(true);
                }
            }
        });
    };

    const sizeClasses = {
        sm: "text-xs px-3 py-1.5",
        md: "text-sm px-4 py-2",
        lg: "text-base px-6 py-3",
    };

    if (variant === "compact") {
        return (
            <button
                onClick={handleToggleFollow}
                disabled={isPending}
                className={`flex items-center gap-1.5 rounded-lg font-semibold transition-all ${sizeClasses[size]
                    } ${isFollowing
                        ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                        : "bg-[#0d9488] text-white hover:bg-[#0f766e] shadow-sm"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                {isFollowing ? (
                    <>
                        <UserCheck size={14} />
                        Following
                    </>
                ) : (
                    <>
                        <UserPlus size={14} />
                        Follow
                    </>
                )}
            </button>
        );
    }

    return (
        <button
            onClick={handleToggleFollow}
            disabled={isPending}
            className={`flex items-center gap-2 rounded-xl font-bold transition-all ${sizeClasses[size]
                } ${isFollowing
                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border-2 border-slate-200"
                    : "bg-gradient-to-r from-[#0d9488] to-teal-600 text-white hover:from-[#0f766e] hover:to-teal-700 shadow-md hover:shadow-lg"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            {isFollowing ? (
                <>
                    <UserCheck size={16} />
                    Following
                </>
            ) : (
                <>
                    <UserPlus size={16} />
                    Follow
                </>
            )}
        </button>
    );
}
