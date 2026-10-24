import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, BASE_PATH, CONTACT_EMAIL, OPERATOR_NAME } from "./config";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: `${APP_NAME} schedules and uploads your videos to your own YouTube channel.`,
  applicationName: APP_NAME,
  alternates: { canonical: BASE_PATH },
  openGraph: { siteName: APP_NAME, url: BASE_PATH, type: "website" },
};

const navLinks = [
  { href: BASE_PATH, label: "Home" },
  { href: `${BASE_PATH}/privacy-policy`, label: "Privacy Policy" },
  { href: `${BASE_PATH}/terms`, label: "Terms of Service" },
];

export default function AutoPostingVideoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-gray-800" lang="en">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href={BASE_PATH} className="text-lg font-bold text-gray-900">
            {APP_NAME}
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className="text-blue-600 hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10">{children}</main>
      <footer className="border-t border-gray-200">
        <div className="mx-auto flex max-w-4xl flex-wrap justify-between gap-3 px-4 py-6 text-sm text-gray-500">
          <span>
            © {new Date().getFullYear()} {APP_NAME} by {OPERATOR_NAME}
          </span>
          <span className="flex flex-wrap gap-4">
            {navLinks.slice(1).map((l) => (
              <Link key={l.href} href={l.href} className="hover:underline">
                {l.label}
              </Link>
            ))}
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline">
              {CONTACT_EMAIL}
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
