import { NextResponse } from "next/server";

// Keep form redirects on the browser's public origin, not Next.js's internal
// hostname behind Render/preview proxies. A 303 follows a POST with a GET.
// Callers must supply a trusted, root-relative application path.
export function redirectAfterPost(path: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: path },
  });
}
