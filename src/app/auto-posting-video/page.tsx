import Link from "next/link";
import { APP_NAME, BASE_PATH, CONTACT_EMAIL, OPERATOR_NAME } from "./config";

const features = [
  {
    title: "Connect your YouTube channel",
    body: "Sign in with Google and grant access to your own channel. You can revoke access at any time.",
  },
  {
    title: "Upload and schedule videos",
    body: "Pick a video, set its title, description, tags and privacy status, and choose when it should be published.",
  },
  {
    title: "Track each post",
    body: "See whether every upload succeeded and open it directly on YouTube.",
  },
];

export default function AutoPostingVideoHome() {
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">{APP_NAME}</h1>
        <p className="text-lg text-gray-600">
          {APP_NAME} is a tool operated by {OPERATOR_NAME} that uploads and schedules videos to
          your own YouTube channel using the YouTube Data API. It only acts on the channel you
          authorize and only posts the videos you select.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-lg border border-gray-200 p-5">
            <h2 className="mb-2 font-semibold text-gray-900">{f.title}</h2>
            <p className="text-sm text-gray-600">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">How {APP_NAME} uses Google data</h2>
        <p className="text-gray-600">
          {APP_NAME} requests access to your YouTube account only to upload videos you choose and
          to read your channel name and the status of those uploads. We do not sell your data, use
          it for advertising, or share it with third parties. Read our{" "}
          <Link href={`${BASE_PATH}/privacy-policy`} className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href={`${BASE_PATH}/terms`} className="text-blue-600 hover:underline">
            Terms of Service
          </Link>{" "}
          for details.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">Contact</h2>
        <p className="text-gray-600">
          Questions about {APP_NAME}? Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </div>
  );
}
