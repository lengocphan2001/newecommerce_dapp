// Public details for the "Auto Posting Video" app shown on its home page,
// privacy policy and terms. Google OAuth branding verification compares the
// app name and links on these pages against the OAuth consent screen, so keep
// them identical to what is configured in Google Cloud.
export const APP_NAME = "Auto Posting Video";
export const OPERATOR_NAME = "Shoplife";
export const SITE_URL = "https://shoplife.vn";
export const BASE_PATH = "/auto-posting-video";
export const CONTACT_EMAIL = "lengocphan503@gmail.com";
export const LAST_UPDATED = "October 2, 2026";

// Must match the scopes requested on the OAuth consent screen.
export const YOUTUBE_SCOPES = [
  {
    scope: "https://www.googleapis.com/auth/youtube.upload",
    purpose: "Upload the videos you choose to your YouTube channel.",
  },
  {
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    purpose:
      "Read your channel name and the status of videos uploaded through the app so you can confirm each post succeeded.",
  },
];
