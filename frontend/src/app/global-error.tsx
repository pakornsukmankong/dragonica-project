'use client';

// Rendered only when the root layout itself crashes, so there is no i18n
// provider or app CSS here — plain English and inline styles by design.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#131110',
          color: '#e8e6e3',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 360, padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 500 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.6 }}>
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p style={{ fontSize: 11, opacity: 0.4 }}>ref: {error.digest}</p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              borderRadius: 6,
              border: 'none',
              background: '#e0a53c',
              color: '#1b1407',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
