// Shared artwork for the generated app icons (see icon.tsx / apple-icon.tsx).
// Plain shapes, no emoji or web fonts: ImageResponse would have to fetch those over the network.
export const BRAND_TEAL = "#0f766e";

export function BrainMark({ size }: { size: number }) {
  const s = size / 100; // draw on a 100×100 grid, scale to the requested size
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_TEAL,
      }}
    >
      <svg width={64 * s} height={64 * s} viewBox="0 0 64 64">
        {/* two hemispheres + a spark: "brain" + "idea" */}
        <path d="M30 10c-8 0-14 6-14 13-5 2-8 7-8 12 0 8 6 14 14 14h8z" fill="#f0fdfa" />
        <path d="M34 10c8 0 14 6 14 13 5 2 8 7 8 12 0 8-6 14-14 14h-8z" fill="#ccfbf1" />
        <circle cx="32" cy="56" r="4" fill="#fde68a" />
      </svg>
    </div>
  );
}
