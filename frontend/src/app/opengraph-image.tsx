import { ImageResponse } from 'next/og';

// Default social/link-preview card for the whole site. Individual pages inherit
// this unless they define their own opengraph-image.
export const alt =
  'Dragonica Grind Tracker — Skill Simulator & Item Database';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(1200px 630px at 50% 0%, #16181f 0%, #0b0c0f 70%)',
          color: '#e6e7ea',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 84,
            fontWeight: 800,
            letterSpacing: -2,
            color: '#e0a53c',
          }}
        >
          Dragonica
        </div>
        <div style={{ fontSize: 40, fontWeight: 700, marginTop: 4 }}>
          Grind Tracker
        </div>
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 40,
            fontSize: 26,
            color: '#b8bcc6',
          }}
        >
          <span>Skill Simulator</span>
          <span style={{ color: '#e0a53c' }}>·</span>
          <span>Item Database</span>
          <span style={{ color: '#e0a53c' }}>·</span>
          <span>Monster Drops</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
