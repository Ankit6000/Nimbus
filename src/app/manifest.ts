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
        src: "/o__o-icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      {
        src: "/o__o-icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "maskable",
      },
    ],
  };
}
