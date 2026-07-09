import type { Metadata } from 'next';
import { BuildView } from './build-view';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface BuildMeta {
  name: string;
  description: string | null;
  char_level: number;
  skill_classes: { name: string; base_class: string } | null;
}

// Server-rendered Open Graph tags so shared links unfurl into a card on
// Discord/Facebook/Line. The page itself stays a client component.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const fallback: Metadata = { title: 'Skill Build' };
  try {
    const res = await fetch(`${API_BASE_URL}/skills/builds/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return fallback;
    const build: BuildMeta = await res.json();

    const className = build.skill_classes?.name ?? '';
    const title = className ? `${build.name} — ${className}` : build.name;
    const description =
      build.description?.slice(0, 160) ||
      `Dragonica ${className || 'skill'} build for level ${build.char_level}. Open to view the full skill tree.`;
    // 3rd-job icon doubles as the preview image.
    const lastStage = className
      .split('→')
      .pop()
      ?.trim()
      .toLowerCase()
      .replace(/\s+/g, '-');

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images: lastStage ? [`/class-icons/${lastStage}.webp`] : undefined,
      },
      twitter: { card: 'summary', title, description },
    };
  } catch {
    return fallback;
  }
}

export default function SharedBuildPage() {
  return <BuildView />;
}
