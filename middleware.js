export function middleware(req) {
    if (req.nextUrl.pathname.startsWith('/socket.io')) {
      return new Response(null, { status: 204 });
    }
  }
  
  export const config = {
    matcher: ['/socket.io/:path*'],
  };
  