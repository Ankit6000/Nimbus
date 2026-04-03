import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "O__O",
    short_name: "O__O",
    description:
      "Private vault portal with admin-managed access, uploads, and hidden storage channels.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f0e4",
    theme_color: "#f7f0e4",
    orientation: "portrait",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        type: "image/png",
        sizes: "192x192",
        purpose: "any",
      },
      {
        src: "/android-chrome-512x512.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "any",
      },
      {
        src: "/maskable-icon-512x512.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
