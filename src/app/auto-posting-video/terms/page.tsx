import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, BASE_PATH, CONTACT_EMAIL, LAST_UPDATED, OPERATOR_NAME } from "../config";

export const metadata: Metadata = {
  title: "Terms of Service",
  alternates: { canonical: `${BASE_PATH}/terms` },
};

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. Acceptance",
    body: `By using ${APP_NAME}, operated by ${OPERATOR_NAME}, you agree to these Terms. If you do not agree, do not use the app.`,
  },
  {
    title: "2. The service",
    body: `${APP_NAME} lets you upload and schedule videos to a YouTube channel you own or manage, using the YouTube Data API.`,
  },
  {
    title: "3. YouTube and Google terms",
    body: (
      <>
        The app uses YouTube API Services. By using it you also agree to the{" "}
        <a href="https://www.youtube.com/t/terms" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
          YouTube Terms of Service
        </a>{" "}
        and acknowledge the{" "}
        <a href="https://policies.google.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
          Google Privacy Policy
        </a>
        .
      </>
    ),
  },
  {
    title: "4. Your content and responsibilities",
    body: "You keep all rights to the videos you upload. You are responsible for having the rights to publish them and for complying with YouTube's Community Guidelines and applicable law. Do not use the app for spam, misleading content or to post to channels you are not authorized to manage.",
  },
  {
    title: "5. Privacy",
    body: (
      <>
        How we handle your data is described in our{" "}
        <Link href={`${BASE_PATH}/privacy-policy`} className="text-blue-600 hover:underline">
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
  {
    title: "6. Termination",
    body: "You can stop using the app and revoke its access at any time from your Google Account. We may suspend access if these Terms are violated.",
  },
  {
    title: "7. Disclaimer and liability",
    body: `The app is provided "as is" without warranties. To the extent permitted by law, ${OPERATOR_NAME} is not liable for indirect or consequential damages, or for outages or changes of YouTube or Google services.`,
  },
  {
    title: "8. Changes",
    body: "We may update these Terms. Continued use after an update means you accept the new Terms.",
  },
  {
    title: "9. Contact",
    body: (
      <>
        Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
          {CONTACT_EMAIL}
        </a>
        .
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <article className="space-y-8 leading-relaxed">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">{APP_NAME} Terms of Service</h1>
        <p className="text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>
      </header>
      {sections.map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">{s.title}</h2>
          <p className="text-gray-700">{s.body}</p>
        </section>
      ))}
    </article>
  );
}
