import type { MetadataRoute } from "next";
import { BRAND_TEAL } from "./brand";

// The web app manifest is what makes the site installable: name, icon, and
// display "standalone" (opens full-screen without browser chrome, like a native app).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Life Brain",
    short_name: "Life Brain",
    description: "Your personal second brain for body & life know-how",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0a09",
    theme_color: BRAND_TEAL,
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ask", url: "/ask" },
      { name: "Add", url: "/add" },
    ],
  };
}
