import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const alt = "SOPROTELCO | Equipos de fibra óptica y conectividad";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card shown when any SOPROTELCO link is shared (WhatsApp is the main sales
 * channel, so this is the brand's most-seen surface). Navy field, the full white
 * logo — artwork unchanged, see brand/logo-direction — and the site promise.
 * The vector logo is embedded as data so the card never depends on a request to
 * itself while it is being generated.
 */
export default async function OpengraphImage() {
  const logoSvg = await readFile(
    join(process.cwd(), "public/assets/brand/soprotelco-logo-white.svg"),
    "utf8",
  );
  const logoSrc = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
          backgroundColor: "#0C1A2A",
          padding: 64,
        }}
      >
        <img src={logoSrc} width={600} alt="" />
        <p
          style={{
            margin: 0,
            color: "#7CF3FF",
            fontSize: 34,
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Equipos de fibra óptica y conectividad en Colombia
        </p>
      </div>
    ),
    size,
  );
}
