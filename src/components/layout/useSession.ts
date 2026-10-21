"use client";

import { useEffect, useState } from "react";

export interface ClientSession {
  signedIn: boolean;
  firstName?: string | null;
  isProfessional?: boolean;
}

let cached: Promise<ClientSession> | null = null;

/** Lightweight client-side session lookup so marketing pages can stay statically rendered. */
export function useSession(): ClientSession | null {
  const [session, setSession] = useState<ClientSession | null>(null);
  useEffect(() => {
    cached ??= fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { signedIn: false }))
      .catch(() => ({ signedIn: false }));
    let alive = true;
    void cached.then((s) => alive && setSession(s));
    return () => {
      alive = false;
    };
  }, []);
  return session;
}
