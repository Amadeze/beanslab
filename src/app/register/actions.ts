"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { getIronSession } from "iron-session";
import { SESSION_OPTIONS, type SessionUser } from "@/lib/session";
import { getCurrentDate } from "@/lib/date-utils";
import {
  enforceRateLimit,
  RateLimitError,
  requestIdentifier,
} from "@/lib/rate-limit";

export async function registerTenant(data: {
  roasteryName: string;
  subdomain: string;
  email: string;
  password: string;
  tier?: "TRIAL" | "BASIC" | "PRO" | "ENTERPRISE";
}) {
  try {
    const roasteryName = data.roasteryName.trim();
    const subdomain = data.subdomain.toLowerCase().trim();
    const email = data.email.toLowerCase().trim();
    const password = data.password;
    const requestHeaders = await headers();
    await enforceRateLimit({
      scope: "register",
      identifier: requestIdentifier(requestHeaders),
      limit: 5,
      windowSeconds: 60 * 60,
    });

    // 1. Basic validations
    if (!roasteryName || !subdomain || !email || !password) {
      return { success: false, error: "All fields are required" };
    }

    if (roasteryName.length > 100) {
      return { success: false, error: "Roastery name is too long" };
    }

    if (
      subdomain.length < 3 ||
      subdomain.length > 40 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(subdomain)
    ) {
      return { success: false, error: "Subdomain can only contain lowercase letters, numbers, and hyphens" };
    }

    if (["www", "app", "admin", "api", "mail", "support"].includes(subdomain)) {
      return { success: false, error: "Subdomain is reserved" };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: "Email is invalid" };
    }

    if (password.length < 8) {
      return { success: false, error: "Password must be at least 8 characters" };
    }

    if (!/[A-Z]/.test(password)) {
      return { success: false, error: "Password must contain at least one uppercase letter" };
    }

    if (!/[0-9]/.test(password)) {
      return { success: false, error: "Password must contain at least one number" };
    }

    // 2. Check if subdomain exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { subdomain },
    });
    if (existingTenant) {
      return { success: false, error: "Subdomain is already taken" };
    }

    // 3. Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return { success: false, error: "Email is already registered" };
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Create Tenant and User in transaction
    // Set 14 days trial
    const trialEndsAt = getCurrentDate();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const result = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          code: subdomain.toUpperCase(), // basic code generation
          name: roasteryName,
          subdomain: subdomain,
          subscriptionTier: "TRIAL",
          subscriptionStatus: "ACTIVE",
          trialEndsAt: trialEndsAt,
        },
      });

      const newUser = await tx.user.create({
        data: {
          tenantId: newTenant.id,
          name: email.split("@")[0],
          email: email,
          password: hashedPassword,
          role: "OWNER",
        },
      });

      return { tenant: newTenant, user: newUser };
    });

    const session = await getIronSession<{ user?: SessionUser }>(await cookies(), SESSION_OPTIONS);
    session.user = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
      tenantId: result.tenant.id,
    };
    await session.save();

    return { success: true, tenantId: result.tenant.id };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      error:
        error instanceof RateLimitError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Something went wrong",
    };
  }
}

export async function registerTenantWithGoogle(data: {
  roasteryName: string;
  subdomain: string;
}) {
  try {
    const roasteryName = data.roasteryName.trim();
    const subdomain = data.subdomain.toLowerCase().trim();
    const requestHeaders = await headers();
    await enforceRateLimit({
      scope: "register",
      identifier: requestIdentifier(requestHeaders),
      limit: 5,
      windowSeconds: 60 * 60,
    });

    if (!roasteryName || !subdomain) {
      return { success: false, error: "Nama Roastery and Subdomain are required" };
    }

    if (
      subdomain.length < 3 ||
      subdomain.length > 40 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(subdomain)
    ) {
      return { success: false, error: "Subdomain can only contain lowercase letters, numbers, and hyphens" };
    }

    const cookieStore = await cookies();
    const signupSession = await getIronSession<{ googleUser?: { sub: string, email: string, name: string } }>(cookieStore, {
      password: SESSION_OPTIONS.password,
      cookieName: "ros_google_signup",
      cookieOptions: SESSION_OPTIONS.cookieOptions
    });

    if (!signupSession.googleUser) {
      return { success: false, error: "Sesi Google tidak valid atau kedaluwarsa. Silakan ulangi Sign in dengan Google." };
    }

    const { sub: googleId, email, name } = signupSession.googleUser;

    const existingTenant = await prisma.tenant.findUnique({
      where: { subdomain },
    });
    if (existingTenant) {
      return { success: false, error: "Subdomain is already taken" };
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return { success: false, error: "Email is already registered" };
    }

    const trialEndsAt = getCurrentDate();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const result = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          code: subdomain.toUpperCase(),
          name: roasteryName,
          subdomain: subdomain,
          subscriptionTier: "TRIAL",
          subscriptionStatus: "ACTIVE",
          trialEndsAt: trialEndsAt,
        },
      });

      const newUser = await tx.user.create({
        data: {
          tenantId: newTenant.id,
          name: name || email.split("@")[0],
          email: email,
          googleId: googleId,
          role: "OWNER",
        },
      });

      return { tenant: newTenant, user: newUser };
    });

    // Destroy signup session
    signupSession.destroy();

    const session = await getIronSession<{ user?: SessionUser }>(cookieStore, SESSION_OPTIONS);
    session.user = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
      tenantId: result.tenant.id,
    };
    await session.save();

    return { success: true, tenantId: result.tenant.id };
  } catch (error) {
    console.error("Google Registration error:", error);
    return {
      success: false,
      error:
        error instanceof RateLimitError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Something went wrong",
    };
  }
}
