import type { Metadata } from "next";
import { APP_NAME, BASE_PATH, CONTACT_EMAIL, LAST_UPDATED, OPERATOR_NAME, YOUTUBE_SCOPES } from "../config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: `${BASE_PATH}/privacy-policy` },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="space-y-3 text-gray-700">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <article className="space-y-8 leading-relaxed">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">{APP_NAME} Privacy Policy</h1>
        <p className="text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>
        <p className="text-gray-700">
          This Privacy Policy explains how {APP_NAME} (&quot;the app&quot;, &quot;we&quot;,
          &quot;us&quot;), operated by {OPERATOR_NAME}, collects, uses, stores, shares and
          protects information when you connect your Google account and YouTube channel to the
          app.
        </p>
      </header>

      <Section title="1. Information we collect">
        <p>When you sign in with Google and authorize the app, we receive:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Your basic Google account profile: name, email address and profile picture.</li>
          <li>
            OAuth access and refresh tokens issued by Google, which let the app act on your
            YouTube channel within the permissions you granted.
          </li>
          <li>
            YouTube channel information: channel ID, channel title and the IDs, titles and
            processing/publishing status of videos uploaded through the app.
          </li>
        </ul>
        <p>Information you provide directly in the app:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Video files you choose to upload.</li>
          <li>Video metadata you enter: title, description, tags, privacy status and schedule.</li>
        </ul>
        <p>
          We do not access your other Google services, contacts, Gmail, Drive files or any YouTube
          data beyond what is listed above.
        </p>
      </Section>

      <Section title="2. Google API scopes we request">
        <ul className="list-disc space-y-2 pl-6">
          {YOUTUBE_SCOPES.map((s) => (
            <li key={s.scope}>
              <code className="break-all rounded bg-gray-100 px-1 text-sm">{s.scope}</code>
              <span> — {s.purpose}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="3. How we use your information">
        <ul className="list-disc space-y-1 pl-6">
          <li>To upload the videos you select to your YouTube channel at the time you choose.</li>
          <li>To show you your connected channel and the result of each upload.</li>
          <li>To keep you signed in and refresh access without asking you to log in each time.</li>
          <li>To respond to your support requests.</li>
        </ul>
        <p>
          We do not use your Google user data for advertising, do not sell it, and do not use it
          to train artificial intelligence or machine learning models.
        </p>
      </Section>

      <Section title="4. Google API Services User Data Policy (Limited Use)">
        <p>
          {APP_NAME}&apos;s use and transfer of information received from Google APIs to any other
          app will adhere to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <p>
          The app also uses YouTube API Services. By using the app you agree to be bound by the{" "}
          <a
            href="https://www.youtube.com/t/terms"
            className="text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            YouTube Terms of Service
          </a>
          , and Google&apos;s handling of your data is described in the{" "}
          <a
            href="https://policies.google.com/privacy"
            className="text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Privacy Policy
          </a>
          .
        </p>
      </Section>

      <Section title="5. Sharing of information">
        <p>We do not sell, rent or trade your information. We share it only:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>With Google/YouTube, when the app sends your videos and metadata to your channel.</li>
          <li>
            With infrastructure providers (hosting and storage) that process data on our behalf
            solely to run the app and under confidentiality obligations.
          </li>
          <li>When required by law, or to protect the rights and safety of users or the public.</li>
        </ul>
      </Section>

      <Section title="6. Storage, security and retention">
        <ul className="list-disc space-y-1 pl-6">
          <li>OAuth tokens are stored encrypted and transmitted only over HTTPS.</li>
          <li>Access to stored data is limited to systems and staff that need it to run the app.</li>
          <li>
            Uploaded video files are kept only until they have been posted to YouTube, then deleted
            from our storage.
          </li>
          <li>
            Account data, tokens and upload history are kept while your account is connected and
            deleted within 30 days after you disconnect or request deletion.
          </li>
        </ul>
      </Section>

      <Section title="7. Your choices and data deletion">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            You can revoke the app&apos;s access at any time from your Google Account at{" "}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              myaccount.google.com/permissions
            </a>
            .
          </li>
          <li>
            You can request access to, correction of, or deletion of your data by emailing{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
              {CONTACT_EMAIL}
            </a>
            . We complete deletion requests within 30 days.
          </li>
        </ul>
      </Section>

      <Section title="8. Children">
        <p>The app is not directed to children under 13 and we do not knowingly collect their data.</p>
      </Section>

      <Section title="9. Changes to this policy">
        <p>
          We may update this policy. The &quot;Last updated&quot; date above shows when it last
          changed. Material changes will be announced on this page.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          {OPERATOR_NAME} — {APP_NAME}
          <br />
          Email:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </Section>
    </article>
  );
}
