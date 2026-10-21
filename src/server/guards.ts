import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, getProfessional } from "./auth/session";

export async function requireUser(locale: string, nextPath: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export async function requireProfessional(locale: string, nextPath: string) {
  const user = await requireUser(locale, nextPath);
  const pro = await getProfessional(user.id);
  if (!pro) redirect(`/${locale}/studio/onboarding`);
  return { user, pro };
}

export async function requireAdmin(locale: string) {
  const user = await requireUser(locale, `/${locale}/admin`);
  if (!user.isAdmin) redirect(`/${locale}/space`);
  return user;
}
