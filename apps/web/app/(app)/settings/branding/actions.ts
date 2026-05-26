"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const themePreferences = new Set(["light", "dark", "nocturne", "graphite", "warm"]);

export async function updateBrandingSettings(formData: FormData) {
  const cookieStore = await cookies();
  const workspaceName = String(formData.get("workspaceName") ?? "").trim();
  const primaryColor = String(formData.get("primaryColor") ?? "").trim();
  const themePreference = String(formData.get("themePreference") ?? "").trim();

  if (workspaceName) {
    cookieStore.set("crm_workspace_name", workspaceName, { path: "/", sameSite: "lax" });
  }

  if (/^#[0-9a-f]{6}$/i.test(primaryColor)) {
    cookieStore.set("crm_primary_color", primaryColor, { path: "/", sameSite: "lax" });
  }

  if (themePreferences.has(themePreference)) {
    cookieStore.set("crm_theme_preference", themePreference, { path: "/", sameSite: "lax" });
  }

  revalidatePath("/settings/branding");
  revalidatePath("/");
}
