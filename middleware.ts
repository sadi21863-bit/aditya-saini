import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";

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

    // Protect admin routes using single isAdmin() source of truth from lib/auth
    if (isAdminRoute(request)) {
        if (!userId) {
            await auth.protect();
            return;
        }
        const adminOk = await isAdmin();
        if (!adminOk) {
            return NextResponse.redirect(new URL("/feed", request.url));
        }
    }

    // Protect all non-public routes
    if (!isPublicRoute(request)) {
        await auth.protect();
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        "/(api|trpc)(.*)",
    ],
};
