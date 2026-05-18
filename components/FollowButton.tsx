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

    if (currentUserId === targetUserId) return null;

    const handleToggleFollow = () => {
        startTransition(async () => {
            if (isFollowing) {
                const result = await unfollowUser(targetUserId);
                if (result.success) setIsFollowing(false);
            } else {
                const result = await followUser(targetUserId);
                if (result.success) setIsFollowing(true);
            }
        });
    };

    void targetHandle;

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
