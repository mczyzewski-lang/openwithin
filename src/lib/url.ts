export function appUrl(): string {
  return (process.env.APP_URL || "https://openwithin.app").replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  return `${appUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
