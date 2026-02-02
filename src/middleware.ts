import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SETUP_PATH = "/setup";
const INIT_PARAM = "__rol_init";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value, ...rest }) => {
    // NextResponse.cookies.set supports either (name, value, options) or a cookie object.
    // We use the object form to preserve options when present.
    to.cookies.set({ name, value, ...rest });
  });
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isHtmlGet =
    request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
  const hasInitParam = request.nextUrl.searchParams.has(INIT_PARAM);

  if (request.nextUrl.pathname === SETUP_PATH) {
    return response;
  }

  if (!user) {
    if (hasInitParam) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = SETUP_PATH;
      redirectUrl.searchParams.delete(INIT_PARAM);
      return NextResponse.redirect(redirectUrl);
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = SETUP_PATH;
      return NextResponse.redirect(redirectUrl);
    }

    if (isHtmlGet) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.searchParams.set(INIT_PARAM, "1");
      const redirectResponse = NextResponse.redirect(redirectUrl);
      copyCookies(response, redirectResponse);
      return redirectResponse;
    }

    return response;
  }

  if (hasInitParam && isHtmlGet) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.searchParams.delete(INIT_PARAM);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|apple-touch-icon.png|manifest.webmanifest|robots.txt|sitemap.xml).*)",
  ],
};
