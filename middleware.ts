import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const liffState = request.nextUrl.searchParams.get("liff.state");
  if (liffState) {
    try {
      const decoded = decodeURIComponent(liffState);
      // Ensure it is an internal relative path to prevent open redirect
      if (decoded.startsWith("/") && !decoded.startsWith("//")) {
        const url = request.nextUrl.clone();

        // Remove liff.state parameter
        url.searchParams.delete("liff.state");

        // Split target path and its search params
        const [targetPath, targetQuery] = decoded.split("?");
        url.pathname = targetPath;

        if (targetQuery) {
          const extraParams = new URLSearchParams(targetQuery);
          extraParams.forEach((val, key) => {
            url.searchParams.set(key, val);
          });
        }

        return NextResponse.redirect(url, 307);
      }
    } catch (e) {
      console.warn("Failed to redirect liff.state:", e);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico and static assets
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
