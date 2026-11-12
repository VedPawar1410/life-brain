/** A grey placeholder block that pulses while content loads; it keeps the layout's shape. */
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}
