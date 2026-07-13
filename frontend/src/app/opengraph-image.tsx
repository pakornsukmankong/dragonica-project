import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

// Default social/link-preview card for the whole site. Individual pages inherit
// this unless they define their own opengraph-image.
export const alt =
  'Dragonica Grind Tracker — Skill Simulator & Item Database';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  // The real app logo (866x288), inlined so satori can rasterize it.
  const logo = await readFile(join(process.cwd(), 'public', 'logo.png'));
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

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
        <img src={logoSrc} width={780} height={259} alt="" />
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 48,
            fontSize: 28,
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
