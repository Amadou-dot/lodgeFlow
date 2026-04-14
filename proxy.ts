import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/about(.*)',
  '/cabins',
  '/experiences(.*)',
  '/dining(.*)',
  '/pricing(.*)',
  '/contact(.*)',
  '/api/cabins(.*)',
  '/api/experiences(.*)',
  '/api/dining(.*)',
  '/api/settings(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect API routes that create bookings or user-specific data
  if (req.nextUrl.pathname.startsWith('/api/bookings')) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
