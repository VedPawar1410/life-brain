import { ImageResponse } from "next/og";
import { BrainMark } from "./brand";

// 192 and 512 are the sizes Android needs to offer "Install app". Served at /icon/192 and /icon/512.
const SIZES = [192, 512];

export function generateImageMetadata() {
  return SIZES.map((px) => ({ id: String(px), size: { width: px, height: px }, contentType: "image/png" }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const px = Number(await id);
  return new ImageResponse(<BrainMark size={px} />, { width: px, height: px });
}
