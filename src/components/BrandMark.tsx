import { Church } from "lucide-react";

export function BrandMark({
  dark = false,
  size = "md",
}: {
  dark?: boolean;
  size?: "md" | "lg";
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-600/30 ${
          size === "lg" ? "h-11 w-11" : "h-9 w-9"
        }`}
      >
        <Church
          className={size === "lg" ? "h-6 w-6" : "h-5 w-5"}
          aria-hidden
        />
      </span>
      <span
        className={`font-bold tracking-tight ${
          size === "lg" ? "text-2xl" : "text-lg"
        } ${dark ? "text-white" : "text-slate-900"}`}
      >
        Church<span className={dark ? "text-indigo-300" : "text-indigo-600"}>OS</span>
      </span>
    </span>
  );
}
