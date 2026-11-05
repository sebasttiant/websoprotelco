import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Home-screen icon for iOS: the yellow check, matching the favicon. Kept as
 * its own file convention because Apple ignores the SVG favicon the rest of
 * the site uses.
 */
export default async function AppleIcon() {
  const symbolSvg = await readFile(
    join(process.cwd(), "public/assets/brand/soprotelco-check.svg"),
    "utf8",
  );
  const symbolSrc = `data:image/svg+xml;base64,${Buffer.from(symbolSvg).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
        }}
      >
        <img src={symbolSrc} width={164} height={171} alt="" />
      </div>
    ),
    size,
  );
}
