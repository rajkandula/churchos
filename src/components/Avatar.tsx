/** Photo if we have one, otherwise initials on a soft gradient. */
export function Avatar({
  name,
  photoUrl,
  size = "md",
  className = "",
}: {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const dims =
    size === "sm"
      ? "h-8 w-8 text-[10px]"
      : size === "lg"
        ? "h-12 w-12 text-sm"
        : size === "xl"
          ? "h-16 w-16 text-xl rounded-2xl"
          : "h-9 w-9 text-xs";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        className={`${dims} shrink-0 ${size === "xl" ? "rounded-2xl" : "rounded-full"} border border-slate-200 object-cover ${className}`}
      />
    );
  }
  return (
    <span
      className={`flex ${dims} shrink-0 items-center justify-center ${size === "xl" ? "rounded-2xl" : "rounded-full"} bg-gradient-to-br from-indigo-100 to-violet-100 font-bold text-indigo-600 ${className}`}
    >
      {initials || "?"}
    </span>
  );
}
