"use server";

// This file re-exports from ideaActions for backwards compatibility.
// New code should import from @/app/actions/ideaActions directly.
export { addIdea, updateIdea, deleteIdea, launchIdea, addLike } from "@/app/actions/ideaActions";
