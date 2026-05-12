import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Create account — IdeaConnect",
  description: "Join IdeaConnect and start building ideas.",
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
