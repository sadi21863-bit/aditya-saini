"use server";

// Backwards-compatibility re-export shim.
// New code should import directly from @/app/actions/ideaActions.
export {
  addIdea,
  updateIdea,
  deleteIdea,
  launchIdea,
  recallIdea,
  addLike,
  sparkIdea,
  addContributor,
  recordView,
} from "@/app/actions/ideaActions";
