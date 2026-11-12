// Shared artwork for the generated app icons (see icon.tsx / apple-icon.tsx).
// Plain shapes, no emoji or web fonts: ImageResponse would have to fetch those over the network.

/** The app's accent green (--accent in globals.css, light mode). */
export const BRAND_GREEN = "#2f6f5e";

// The brain glyph from Lucide (ISC licence), the same icon as the Brain tab, so the home-screen
// icon and the app share one mark. Arc flags are written out ("0 1", not "01") because the
// image renderer's SVG parser is stricter than a browser's.
const BRAIN_PATHS = [
  "M12 18V5",
  "M15 13a4.17 4.17 0 0 1 -3 -4 4.17 4.17 0 0 1 -3 4",
  "M17.707 6.294A3 3 0 1 0 12 5a3 3 0 1 0 -5.707 1.294",
  "M17.996 5.125a4 4 0 0 1 2.526 5.77",
  "M18 18a4 4 0 0 0 2 -7.465",
  "M19.967 17.482a4 4 0 1 1 -7.967 .517 4 4 0 1 1 -7.967 -.517",
  "M6 18a4 4 0 0 1 -2 -7.465",
  "M6.004 5.125a4 4 0 0 0 -2.526 5.77",
];

export function BrainMark({ size }: { size: number }) {
  // The glyph fills ~56% of the canvas: inside Android's maskable safe zone (the inner 80% circle).
  const glyph = Math.round(size * 0.56);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_GREEN,
      }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="#ffffff"
        strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        {BRAIN_PATHS.map((d) => <path key={d} d={d} />)}
      </svg>
    </div>
  );
}
