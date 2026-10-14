import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#apps", label: "Apps" },
      { href: "/#features", label: "Features" },
      { href: "/signup", label: "Get started" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    title: "For families",
    links: [
      { href: "/contact", label: "Contact the team" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <BrandMark />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
              Everything your church needs, in one place — people, giving,
              attendance, groups and more.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-indigo-600"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6 text-xs text-slate-400">
          <span>© {new Date().getFullYear()} ChurchOS. All rights reserved.</span>
          <span>Made with care for churches everywhere</span>
        </div>
      </div>
    </footer>
  );
}
