"use client";

import { useState, useTransition } from "react";
import { followUser, unfollowUser } from "@/app/actions/socialActions";
import { UserPlus, UserCheck } from "lucide-react";
import toast from "react-hot-toast";

interface FollowButtonProps {
    currentUserId: string;
    targetUserId: string;
    initialIsFollowing: boolean;
    size?: "sm" | "md" | "lg";
}

export default function FollowButton({
    currentUserId,
    targetUserId,
    initialIsFollowing,
    size = "md",
}: FollowButtonProps) {
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [isPending, startTransition] = useTransition();

    if (currentUserId === targetUserId) return null;

    const handleToggleFollow = () => {
        const next = !isFollowing;
        setIsFollowing(next);
        startTransition(async () => {
            const result = next
                ? await followUser(targetUserId)
                : await unfollowUser(targetUserId);
            if (!result.success) {
                setIsFollowing(!next);
                toast.error(result.error ?? "Couldn't update follow status");
            }
        });
    };

    const sizeClasses = {
        sm: "text-xs px-3 py-1.5",
        md: "text-sm px-4 py-2",
        lg: "text-base px-6 py-3",
    };

    const followingCls = `bg-ic-paper-deep border border-ic-rule text-ic-muted`;
    const notFollowingCls = `border border-ic-rule text-ic-ink hover:border-ic-accent hover:text-ic-ink`;

    return (
        <button
            onClick={handleToggleFollow}
            disabled={isPending}
            className={`flex items-center gap-2 rounded-lg font-mono font-medium transition-colors
                ${sizeClasses[size]}
                ${isFollowing ? followingCls : notFollowingCls}
                disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            {isFollowing
                ? <><UserCheck size={14} /> Following</>
                : <><UserPlus size={14} /> Follow</>}
        </button>
    );
}
