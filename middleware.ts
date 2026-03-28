import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, request) => {
    const { userId } = await auth();

    // Only protect admin routes during development
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

    // TODO: Re-enable auth protection before deployment
    // if (!isPublicRoute(request)) {
    //   await auth.protect();
    // }

    return NextResponse.next();
});

export const config = {
    matcher: [
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        "/(api|trpc)(.*)",
    ],
};