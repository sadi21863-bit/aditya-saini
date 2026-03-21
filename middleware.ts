import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/onboarding(.*)",
    "/feed",
    "/registry",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, request) => {
    const { userId } = await auth();

    // Protect admin routes
    if (isAdminRoute(request)) {
        await auth.protect((has) => has({ role: "admin" }));
    }

    // Protect all non-public routes
    if (!isPublicRoute(request)) {
        await auth.protect();
    }

    // Redirect authenticated users without a profile to onboarding
    if (
        userId &&
        !request.nextUrl.pathname.startsWith("/onboarding") &&
        !request.nextUrl.pathname.startsWith("/sign-in") &&
        !request.nextUrl.pathname.startsWith("/sign-up")
    ) {
        // Let the onboarding page itself handle the DB check and redirect
        // This avoids DB calls in middleware for every request
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        "/(api|trpc)(.*)",
    ],
};
