'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { m } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, Pencil, Eye, Heart, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { SkillTree } from '@/components/skill-tree';
import { BuildComments } from '@/components/build-comments';
import {
  availableSkillPoints,
  encodeBuild,
  spBaseForClass,
  spSpent,
} from '@/lib/skill-build';
import type { SkillBuild, SkillClassTree } from '@/types';

export function BuildView() {
  const t = useTranslations('skills');
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const slug = String(params.slug);
  const loginNext = `/login?next=${encodeURIComponent(`/skills/build/${slug}`)}`;

  const { data: build, isLoading, isError } = useQuery<SkillBuild>({
    queryKey: ['skills', 'build', slug],
    queryFn: () => api.get(`/skills/builds/${slug}`),
    retry: false,
  });

  const { data: tree } = useQuery<SkillClassTree>({
    queryKey: ['skills', 'class', build?.class_id],
    queryFn: () => api.get(`/skills/classes/${build!.class_id}`),
    enabled: !!build,
    staleTime: Infinity,
  });

  const { data: me } = useQuery<{
    id: string;
    username: string | null;
    role?: string;
  }>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me'),
    retry: false,
  });

  const { data: likedData } = useQuery<{ liked: boolean }>({
    queryKey: ['skills', 'build', slug, 'liked'],
    queryFn: () => api.get(`/skills/builds/${slug}/liked`),
    enabled: !!me,
    retry: false,
  });
  const liked = likedData?.liked ?? false;

  // Count the view once per browser session. The key is set before the POST so
  // React strict mode's double effect in dev does not count twice.
  useEffect(() => {
    const key = `build_viewed_${slug}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      api.post(`/skills/builds/${slug}/view`, {}).catch(() => {});
    }
  }, [slug]);

  const likeMut = useMutation<{ liked: boolean; likeCount: number }>({
    mutationFn: () => api.post(`/skills/builds/${slug}/like`, {}),
    onSuccess: (res) => {
      queryClient.setQueryData(['skills', 'build', slug, 'liked'], {
        liked: res.liked,
      });
      queryClient.setQueryData<SkillBuild | undefined>(
        ['skills', 'build', slug],
        (prev) => (prev ? { ...prev, like_count: res.likeCount } : prev),
      );
    },
    onError: (e) =>
      toast({
        title: t('commentError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (isError || !build) {
    return (
      <main className="mx-auto max-w-container px-4 py-16 text-center sm:px-7">
        <p className="text-muted">{t('buildNotFound')}</p>
        <Link href="/skills" className="mt-4 inline-block text-sm text-gold">
          {t('backToClasses')}
        </Link>
      </main>
    );
  }

  const cloneHref = `/skills/${build.class_id}?b=${encodeBuild({
    classId: build.class_id,
    charLevel: build.char_level,
    allocations: build.allocations,
    bonusSp: build.bonus_sp ?? 0,
  })}`;

  const spBase = spBaseForClass(build.class_id);
  const spUsed = spSpent(tree?.skills ?? [], build.allocations);

  return (
    <main className="mx-auto max-w-container px-4 py-8 sm:px-7">
      <Link
        href="/skills"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t('backToClasses')}
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-raised px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
            <Eye className="h-3 w-3" /> {t('viewOnly')}
          </div>
          <h1 className="text-xl font-medium text-foreground laptop:text-2xl">
            {build.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {tree?.class.name ?? ''} · {t('charLevel')} {build.char_level} ·{' '}
            {spUsed}/
            {availableSkillPoints(build.char_level, spBase, build.bonus_sp ?? 0)}{' '}
            {t('spUsed')}
          </p>
          {build.description && (
            <p className="mt-2 max-w-xl whitespace-pre-line text-sm leading-relaxed text-foreground/80">
              {build.description}
            </p>
          )}
          {/* social stats */}
          <div className="mt-3 flex items-center gap-3 text-sm text-muted">
            <m.button
              // guests are sent to login and come straight back here after
              onClick={() => (me ? likeMut.mutate() : router.push(loginNext))}
              disabled={likeMut.isPending}
              title={me ? undefined : t('loginToLike')}
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className={`inline-flex items-center gap-1.5 rounded-base border px-3 py-1.5 transition-colors ${
                liked
                  ? 'border-gold/40 bg-gold-soft text-gold'
                  : 'border-border text-muted hover:text-foreground'
              }`}
            >
              {/* re-mounts on toggle so the heart pops both ways */}
              <m.span
                key={String(liked)}
                initial={{ scale: 1.4 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              >
                <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
              </m.span>
              <span className="tabular-nums">{build.like_count ?? 0}</span>
            </m.button>
            <span className="inline-flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              <span className="tabular-nums">{build.view_count ?? 0}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              <span className="tabular-nums">{build.comment_count ?? 0}</span>
            </span>
          </div>
        </div>
        <Link
          href={cloneHref}
          className="inline-flex items-center gap-1.5 self-start rounded-base bg-gold px-4 py-2 text-sm font-semibold text-[#1b1407] shadow-button transition-opacity hover:opacity-90"
        >
          <Pencil className="h-3.5 w-3.5" /> {t('cloneToEdit')}
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto">
        {tree ? (
          <SkillTree
            skills={tree.skills}
            classId={build.class_id}
            charLevel={build.char_level}
            bonusSp={build.bonus_sp ?? 0}
            allocations={build.allocations}
            readOnly
            tierLabels={[
              tree.class.base_class,
              ...tree.class.name.split('→').map((s) => s.trim()),
            ]}
          />
        ) : (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        )}
      </div>

      <BuildComments slug={slug} me={me} />
    </main>
  );
}
