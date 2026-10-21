import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/*/space", "/*/profile", "/*/continue/", "/*/experience/", "/*/checkout/", "/*/admin", "/*/share/", "/*/studio/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
