// Renders a schema.org JSON-LD block. Server-safe; drop into any page/layout
// to give crawlers structured data (WebSite, SoftwareApplication, Dataset…).
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Data is authored in-repo (no user input), so this is safe to inline.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
