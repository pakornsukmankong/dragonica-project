import Script from 'next/script';

// Google Analytics 4 (gtag.js). Loaded only when a Measurement ID is set, so
// dev/preview builds don't pollute production analytics. GA4 enhanced
// measurement auto-tracks SPA route changes via browser-history events, so no
// manual page_view calls are needed for App Router soft navigations.
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GoogleAnalytics() {
  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
