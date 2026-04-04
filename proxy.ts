import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// Public routes: landing, auth pages, sign-in, sign-up, OG images
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/og(.*)",
  "/api/health(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();

  // Forward pathname so layout can guard unenrolled users → /onboarding
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  // Admin routes: must be authenticated AND have admin role
  if (isAdminRoute(request)) {
    if (!userId) {
      await auth.protect();
      return;
    }
    const adminOk = await isAdmin();
    if (!adminOk) {
      return NextResponse.redirect(new URL("/feed", request.url));
    }
    return next();
  }

  // All non-public routes require authentication
  if (!isPublicRoute(request) && !userId) {
    await auth.protect();
    return;
  }

  return next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
