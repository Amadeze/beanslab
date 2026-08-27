import { googleAuth } from "@/lib/google";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OAuth2RequestError } from "arctic";
import { prisma } from "@/lib/prisma";
import { getIronSession } from "iron-session";
import { SESSION_OPTIONS, type SessionUser } from "@/lib/session";
import { googleLoginDestination, parseVerifiedGoogleUser, resolveGoogleSignInTarget } from "@/lib/google-oauth";

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

    if (!response.ok) {
      return NextResponse.redirect(new URL("/login?error=OAuthError", request.url));
    }

    const googleUser = parseVerifiedGoogleUser(await response.json());
    if (!googleUser) {
      return NextResponse.redirect(new URL("/login?error=GoogleEmailNotVerified", request.url));
    }

    const [userByGoogleId, userByEmail] = await Promise.all([
      prisma.user.findUnique({
        where: { googleId: googleUser.sub },
        select: { id: true, googleId: true, password: true, isActive: true, tenantId: true, role: true, name: true, email: true, sessionVersion: true, emailVerifiedAt: true, tenant: { select: { isActive: true } } },
      }),
      prisma.user.findUnique({
        where: { email: googleUser.email },
        select: { id: true, googleId: true, password: true, isActive: true, tenantId: true, role: true, name: true, email: true, sessionVersion: true, emailVerifiedAt: true, tenant: { select: { isActive: true } } },
      }),
    ]);

    const decision = resolveGoogleSignInTarget(
      userByGoogleId ? { id: userByGoogleId.id, googleId: userByGoogleId.googleId, password: userByGoogleId.password } : null,
      userByEmail ? { id: userByEmail.id, googleId: userByEmail.googleId, password: userByEmail.password } : null,
    );

    if (decision.action === "reject") {
      return NextResponse.redirect(new URL(`/login?error=${decision.error}`, request.url));
    }

    if (decision.action === "signup") {
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

    const account = userByEmail ?? userByGoogleId;
    if (!account) {
      return NextResponse.redirect(new URL("/login?error=InternalServerError", request.url));
    }
    let user = account;

    if (!user.isActive || (user.role !== "SUPERADMIN" && !user.tenant.isActive)) {
      return NextResponse.redirect(new URL("/login?error=AccountDisabled", request.url));
    }

    // decision === "link": account exists without a Google id — link it now.
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.sub,
          // Google memverifikasi kepemilikan email (callback menolak
          // email_verified=false), jadi tandai terverifikasi.
          ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }),
        },
        include: { tenant: { select: { isActive: true } } },
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
      sessionVersion: user.sessionVersion,
    };
    await session.save();

    cookieStore.delete("google_oauth_state");
    cookieStore.delete("google_code_verifier");
    cookieStore.delete("google_oauth_from");
    return NextResponse.redirect(
      new URL(googleLoginDestination(returnPath), request.url),
    );

  } catch (e) {
    console.error("Google Callback Error:", e);
    if (e instanceof OAuth2RequestError) {
      // Invalid code
      return NextResponse.redirect(new URL("/login?error=OAuthError", request.url));
    }
    return NextResponse.redirect(new URL("/login?error=InternalServerError", request.url));
  }
}
