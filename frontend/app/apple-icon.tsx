import { ImageResponse } from "next/og";
import { BrainMark } from "./brand";

// iOS ignores the web manifest's icons for "Add to Home Screen" and uses this instead.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BrainMark size={180} />, size);
}
