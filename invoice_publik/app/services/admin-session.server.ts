// ============================================================================
// app/services/admin-session.server.ts — Session & Supabase Auth untuk Admin
// ============================================================================
import { createCookieSessionStorage, redirect } from "react-router";
import { getSupabaseClient } from "./supabase.server";
import { createClient } from "@supabase/supabase-js";

const sessionSecret = process.env.ADMIN_SESSION_SECRET || "fallback_dev_secret_min32chars_pos_madura_2026_";

export const adminSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__admin_session",
    httpOnly: true,
    maxAge: 60 * 60 * 24, // 24 jam
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function getAdminSession(request: Request) {
  return adminSessionStorage.getSession(request.headers.get("Cookie"));
}

/**
 * Memastikan default admin user ada di Supabase Auth
 */
export async function ensureDefaultAdminUser(): Promise<void> {
  const serviceClient = getSupabaseClient();
  if (!serviceClient) return;

  const adminEmail = (process.env.ADMIN_EMAIL || "admin@poswarung.com").trim();
  const adminPassword = (process.env.ADMIN_PASSWORD || "admin_rahasia_ganti_ini").trim();

  try {
    const { data } = await serviceClient.auth.admin.listUsers();
    const existing = data?.users?.find(
      (u) => u.email?.toLowerCase() === adminEmail.toLowerCase()
    );
    if (!existing) {
      await serviceClient.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: { role: "admin", name: "Super Admin POS" },
      });
      console.log(`[Supabase Auth] Admin user terdaftar: ${adminEmail}`);
    }
  } catch (err: any) {
    console.warn(`[Supabase Auth] Notice saat cek admin:`, err.message);
  }
}

/**
 * Autentikasi Admin via Supabase Auth
 */
export async function authenticateAdminWithSupabase(
  email: string,
  password: string
): Promise<{
  success: boolean;
  user?: { email: string; id: string };
  accessToken?: string;
  error?: string;
}> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
  const defaultEmail = (process.env.ADMIN_EMAIL || "admin@poswarung.com").trim();
  const defaultPassword = (process.env.ADMIN_PASSWORD || "admin_rahasia_ganti_ini").trim();

  const cleanEmail = email.trim();
  const cleanPassword = password.trim();

  // Pastikan admin user terdaftar di Supabase Auth
  await ensureDefaultAdminUser();

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });

      const { data, error } = await anonClient.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (!error && data?.user && data?.session) {
        return {
          success: true,
          user: {
            email: data.user.email || cleanEmail,
            id: data.user.id,
          },
          accessToken: data.session.access_token,
        };
      }

      // Jika login email gagal, tapi cocok dengan default env credentials:
      if (
        (cleanEmail.toLowerCase() === defaultEmail.toLowerCase() || cleanEmail === "admin") &&
        cleanPassword === defaultPassword
      ) {
        // Sinkronisasi password di Supabase Auth
        const serviceClient = getSupabaseClient();
        if (serviceClient) {
          const { data: usersData } = await serviceClient.auth.admin.listUsers();
          const target = usersData?.users?.find(
            (u) => u.email?.toLowerCase() === defaultEmail.toLowerCase()
          );
          if (target) {
            await serviceClient.auth.admin.updateUserById(target.id, {
              password: defaultPassword,
            });
            return {
              success: true,
              user: { email: target.email || defaultEmail, id: target.id },
            };
          }
        }
        return {
          success: true,
          user: { email: defaultEmail, id: "supabase-admin" },
        };
      }

      return {
        success: false,
        error: error?.message || "Email atau password admin salah.",
      };
    } catch (err: any) {
      console.warn("[Supabase Auth] Login error:", err.message);
    }
  }

  // Fallback lokal jika Supabase offline
  if (
    (cleanEmail.toLowerCase() === defaultEmail.toLowerCase() || cleanEmail === "admin") &&
    cleanPassword === defaultPassword
  ) {
    return {
      success: true,
      user: { id: "local-admin", email: defaultEmail },
    };
  }

  return { success: false, error: "Email atau password admin salah." };
}

export interface AdminAuthResult {
  email: string;
  userId: string;
  isSupabaseAuth: boolean;
}

export async function requireAdminAuth(request: Request): Promise<AdminAuthResult> {
  const session = await getAdminSession(request);
  const adminLoggedIn = session.get("adminLoggedIn");
  const email = session.get("adminEmail") || process.env.ADMIN_EMAIL || "admin@poswarung.com";
  const userId = session.get("adminUserId") || "admin";
  const accessToken = session.get("accessToken");

  if (!adminLoggedIn) {
    const url = new URL(request.url);
    throw redirect(`/admin/login?redirect=${encodeURIComponent(url.pathname)}`);
  }

  const isSupabaseAuth = Boolean(accessToken);
  return { email, userId, isSupabaseAuth };
}

export async function createAdminSession(
  redirectTo: string,
  user: { email: string; id: string },
  accessToken?: string
) {
  const session = await adminSessionStorage.getSession();
  session.set("adminLoggedIn", true);
  session.set("adminEmail", user.email);
  session.set("adminUserId", user.id);
  if (accessToken) {
    session.set("accessToken", accessToken);
  }
  const headers = new Headers();
  headers.append("Set-Cookie", await adminSessionStorage.commitSession(session));
  // Clear any lingering /admin path cookie
  headers.append(
    "Set-Cookie",
    "__admin_session=; Path=/admin; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax"
  );
  return redirect(redirectTo, { headers });
}

export async function destroyAdminSession(request: Request) {
  const session = await getAdminSession(request);
  const headers = new Headers();
  headers.append("Set-Cookie", await adminSessionStorage.destroySession(session));
  // Clear both root path and legacy /admin path
  headers.append(
    "Set-Cookie",
    "__admin_session=; Path=/admin; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax"
  );
  return redirect("/admin/login?logout=1", { headers });
}
