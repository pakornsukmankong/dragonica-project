// AdSense publisher id for dgn-grind.dev. Not a secret — it ships in the page
// source of every AdSense site — so it lives here rather than in an env var,
// and site verification works off a plain deploy with no dashboard step.
const CLIENT_ID = 'ca-pub-9774608372358484';

/**
 * Injects the AdSense tag. A plain `<script async>` rather than next/script:
 * React hoists it into the server-rendered `<head>`, which is where AdSense
 * looks when verifying site ownership. next/script's `beforeInteractive` only
 * emits a preload link there and adds the tag after hydration.
 */
export function GoogleAdsense() {
  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT_ID}`}
      crossOrigin="anonymous"
    />
  );
}
