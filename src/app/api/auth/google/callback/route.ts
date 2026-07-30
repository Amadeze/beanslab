import { googleAuth } from "@/lib/google";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OAuth2RequestError } from "arctic";
import { prisma } from "@/lib/prisma";
import { getIronSession } from "iron-session";
import { SESSION_OPTIONS, type SessionUser } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("google_oauth_state")?.value ?? null;
  const storedCodeVerifier = cookieStore.get("google_code_verifier")?.value ?? null;
  const storedReturnPath = cookieStore.get("google_oauth_from")?.value ?? "/dashboard";
  const returnPath = storedReturnPath.startsWith("/") && !storedReturnPath.startsWith("//")
    ? storedReturnPath
    : "/dashboard";

  if (!code || !state || !storedState || !storedCodeVerifier || state !== storedState) {
    return NextResponse.redirect(new URL("/login?error=InvalidState", request.url));
  }

  try {
    const tokens = await googleAuth.validateAuthorizationCode(code, storedCodeVerifier);
    const accessToken = tokens.accessToken();
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    const googleUser: {
      sub: string;
      name: string;
      email: string;
    } = await response.json();

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: googleUser.sub },
          { email: googleUser.email }
        ]
      }
    });

    if (!user) {
      // Store signup info in session cookie
      const signupSession = await getIronSession<{ googleUser?: { sub: string, email: string, name: string } }>(cookieStore, {
        password: SESSION_OPTIONS.password,
        cookieName: "ros_google_signup",
        cookieOptions: SESSION_OPTIONS.cookieOptions
      });
      signupSession.googleUser = {
        sub: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name
      };
      await signupSession.save();
      
      return NextResponse.redirect(new URL("/register?mode=google", request.url));
    }

    // If user exists but googleId is not linked yet, link it
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: googleUser.sub }
      });
    }

    // Create session
    const session = await getIronSession<{ user?: SessionUser }>(cookieStore, SESSION_OPTIONS);
    session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    };
    await session.save();

    cookieStore.delete("google_oauth_from");
    return NextResponse.redirect(new URL(returnPath, request.url));

  } catch (e) {
    console.error("Google Callback Error:", e);
    if (e instanceof OAuth2RequestError) {
      // Invalid code
      return NextResponse.redirect(new URL("/login?error=OAuthError", request.url));
    }
    return NextResponse.redirect(new URL("/login?error=InternalServerError", request.url));
  }
}
