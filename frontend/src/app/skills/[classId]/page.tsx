'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, m } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Loader2,
  LogIn,
  RotateCcw,
  Share2,
  Save,
  Trash2,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { SkillTree } from '@/components/skill-tree';
import {
  availableSkillPoints,
  decodeBuild,
  encodeBuild,
  spBaseForClass,
  spSpent,
  validateBuild,
  type Allocations,
} from '@/lib/skill-build';
import type { SkillBuild, SkillClassTree } from '@/types';

function SimulatorInner() {
  const t = useTranslations('skills');
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const classId = Number(params.classId);

  const { data: tree, isLoading } = useQuery<SkillClassTree>({
    queryKey: ['skills', 'class', classId],
    queryFn: () => api.get(`/skills/classes/${classId}`),
    staleTime: Infinity,
  });

  // Editing an existing saved build? (?edit=<slug>) — loads it for in-place edit.
  const editSlug = searchParams.get('edit');
  const { data: editing } = useQuery<SkillBuild>({
    queryKey: ['skills', 'build', editSlug],
    queryFn: () => api.get(`/skills/builds/${editSlug}`),
    enabled: !!editSlug,
    staleTime: Infinity,
  });

  // Seed from a shared/cloned build in the URL (?b=...), else a blank sheet.
  const seed = useMemo(() => {
    const code = searchParams.get('b');
    return code ? decodeBuild(code) : null;
  }, [searchParams]);

  const [charLevel, setCharLevel] = useState(seed?.charLevel ?? 1);
  // raw text for the level field so it can be cleared/typed freely
  const [levelText, setLevelText] = useState(String(seed?.charLevel ?? 1));
  const [bonusSp, setBonusSp] = useState(seed?.bonusSp ?? 0);
  const [allocations, setAllocations] = useState<Allocations>(
    seed?.allocations ?? {},
  );
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Populate the editor once from the build being edited.
  const seededRef = useRef(false);
  useEffect(() => {
    if (editing && !seededRef.current) {
      seededRef.current = true;
      setCharLevel(editing.char_level);
      setLevelText(String(editing.char_level));
      setBonusSp(editing.bonus_sp ?? 0);
      setAllocations(editing.allocations);
      setName(editing.name);
      setDescription(editing.description ?? '');
      setIsPublic(editing.visibility === 'public');
    }
  }, [editing]);

  const { data: me } = useQuery<{ id: string; username: string | null }>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me'),
    retry: false,
  });

  // Only the owner gets in-place editing; opening someone else's ?edit= link
  // degrades to a clone (the form still seeds, but saving creates a new build).
  const isEditMode = !!editing && !!me && me.id === editing.user_id;

  const skills = tree?.skills ?? [];
  const spBase = spBaseForClass(classId);
  const validation = useMemo(
    () => validateBuild(skills, charLevel, allocations, spBase, bonusSp),
    [skills, charLevel, allocations, spBase, bonusSp],
  );
  const spUsed = spSpent(skills, allocations);
  const spAvail = availableSkillPoints(charLevel, spBase, bonusSp);

  const saveMut = useMutation<SkillBuild>({
    mutationFn: () => {
      const body = {
        classId,
        name: name.trim() || 'My Build',
        description,
        charLevel,
        bonusSp,
        allocations,
        visibility: isPublic ? 'public' : 'unlisted',
      };
      return isEditMode
        ? api.patch(`/skills/builds/${editing!.id}`, body)
        : api.post('/skills/builds', body);
    },
    onSuccess: (build) => {
      queryClient.invalidateQueries({ queryKey: ['skills', 'me', 'builds'] });
      queryClient.invalidateQueries({ queryKey: ['skills', 'build'] });
      queryClient.invalidateQueries({ queryKey: ['skills', 'community'] });
      const url = `${window.location.origin}/skills/build/${build.share_slug}`;
      navigator.clipboard?.writeText(url).catch(() => {});
      toast({
        title: isEditMode ? t('updated') : t('saved'),
        description: t('linkCopied'),
        variant: 'success',
      });
    },
    onError: (e) =>
      toast({
        title: t('saveError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/skills/builds/${editing!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', 'me', 'builds'] });
      toast({ title: t('deleted'), variant: 'success' });
      router.push('/skills');
    },
    onError: (e) =>
      toast({
        title: t('deleteError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const copyLink = () => {
    const code = encodeBuild({ classId, charLevel, allocations, bonusSp });
    const url = `${window.location.origin}/skills/${classId}?b=${code}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    toast({ title: t('linkCopied'), variant: 'success' });
  };

  // Guests who try to save are sent to login; the in-progress build rides
  // along in ?next= (as a ?b= snapshot) so it survives the round trip.
  const loginToSave = () => {
    const code = encodeBuild({ classId, charLevel, allocations, bonusSp });
    router.push(
      `/login?next=${encodeURIComponent(`/skills/${classId}?b=${code}`)}`,
    );
  };

  if (isLoading || !tree) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-container px-4 py-8 sm:px-7">
      <Link
        href="/skills"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t('backToClasses')}
      </Link>

      {/* title row: class name left, tree actions right */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {isEditMode && (
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-raised px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gold">
              <Pencil className="h-3 w-3" /> {t('editingBuild')}
            </div>
          )}
          <h1 className="text-xl font-medium text-foreground laptop:text-2xl">
            {tree.class.name}
          </h1>
          <p className="mt-1 text-sm text-muted">{tree.class.base_class}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAllocations({})}
            className="flex items-center gap-1.5 rounded-base border border-border px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> {t('reset')}
          </button>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 rounded-base border border-border px-3 py-2 text-sm text-foreground transition-colors hover:border-gold/50"
          >
            <Share2 className="h-3.5 w-3.5" /> {t('copyLink')}
          </button>
        </div>
      </div>

      {/* control bar: SP budget + level inputs in one panel */}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-base border border-border bg-raised p-3 sm:p-4">
        <div className="min-w-[88px] rounded-base bg-surface px-4 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted">
            {t('spUsed')}
          </div>
          <div
            className={`text-lg font-bold tabular-nums ${
              spUsed > spAvail ? 'text-[var(--fg-danger)]' : 'text-gold'
            }`}
          >
            {spUsed}
            <span className="text-sm text-muted">/{spAvail}</span>
          </div>
        </div>

        <div className="hidden h-10 w-px bg-border sm:block" />

        {/* char level (typed) */}
        <div>
          <label htmlFor="char-level" className="mb-1 block text-xs text-muted">
            {t('charLevel')}
          </label>
          <input
            id="char-level"
            type="number"
            min={1}
            max={200}
            value={levelText}
            onChange={(e) => {
              const t = e.target.value;
              setLevelText(t);
              const n = Math.floor(Number(t));
              if (t !== '' && Number.isFinite(n) && n > 0) {
                setCharLevel(Math.min(200, n));
              }
            }}
            onBlur={() => {
              const n = Math.floor(Number(levelText));
              const v =
                levelText === '' || !Number.isFinite(n) || n < 1
                  ? 1
                  : Math.min(200, n);
              setCharLevel(v);
              setLevelText(String(v));
            }}
            className="w-16 rounded-base border border-border bg-surface px-2 py-2 text-sm font-bold tabular-nums text-foreground outline-none focus:border-gold/50"
          />
        </div>

        {/* bonus SP (typed) */}
        <div>
          <label htmlFor="bonus-sp" className="mb-1 block text-xs text-muted">
            {t('bonusSp')}
          </label>
          <div className="flex items-center rounded-base border border-border bg-surface focus-within:border-gold/50">
            <span className="pl-2 text-sm font-bold text-gold">+</span>
            <input
              id="bonus-sp"
              type="number"
              min={0}
              value={bonusSp}
              onChange={(e) =>
                setBonusSp(Math.max(0, Math.floor(Number(e.target.value) || 0)))
              }
              className="w-14 bg-transparent px-1 py-2 text-sm font-bold tabular-nums text-foreground outline-none"
            />
            <span className="pr-2 text-xs text-muted">SP</span>
          </div>
        </div>
      </div>

      {/* validation banner */}
      <AnimatePresence>
        {!validation.valid && (
          <m.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mt-4 flex items-start gap-2 rounded-base border border-[var(--border-danger)] bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--fg-danger)]"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{validation.errors[0]}</span>
          </m.div>
        )}
      </AnimatePresence>

      {/* save panel */}
      <div className="mt-4 space-y-2 rounded-base border border-border bg-raised p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('buildName')}
            maxLength={60}
            className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50 sm:w-64"
          />
          {me ? (
            <>
              <label
                className={`ml-auto flex cursor-pointer items-center gap-2 rounded-base border px-3 py-2 text-xs transition-colors ${
                  isPublic
                    ? 'border-gold/40 bg-gold-soft text-gold'
                    : 'border-border text-muted'
                }`}
                title={t('shareToCommunityHint')}
              >
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="accent-[var(--gold)]"
                />
                {isPublic ? t('sharedToCommunity') : t('shareToCommunity')}
              </label>
              <m.button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !validation.valid || spUsed === 0}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className="flex items-center gap-1.5 rounded-base bg-gold px-4 py-2 text-sm font-semibold text-[#1b1407] shadow-button transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {saveMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {isEditMode ? t('saveChanges') : t('saveShare')}
              </m.button>
              {isEditMode && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleteMut.isPending}
                  className="flex items-center gap-1.5 rounded-base border border-[var(--border-danger)] px-3 py-2 text-sm text-[var(--fg-danger)] transition-colors hover:bg-[var(--danger-soft)] disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t('delete')}
                </button>
              )}
            </>
          ) : (
            <m.button
              onClick={loginToSave}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className="ml-auto flex items-center gap-1.5 rounded-base bg-gold px-4 py-2 text-sm font-semibold text-[#1b1407] shadow-button transition-opacity hover:opacity-90"
            >
              <LogIn className="h-3.5 w-3.5" />
              {t('loginToSave')}
            </m.button>
          )}
        </div>
        {me && (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('descriptionPlaceholder')}
            maxLength={2000}
            rows={2}
            className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
          />
        )}
      </div>

      <div className="mt-6 overflow-x-auto pb-4">
        <SkillTree
          skills={skills}
          classId={classId}
          charLevel={charLevel}
          bonusSp={bonusSp}
          allocations={allocations}
          onChange={setAllocations}
          tierLabels={[
            tree.class.base_class,
            ...tree.class.name.split('→').map((s) => s.trim()),
          ]}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('deleteBuildTitle')}
        description={t('deleteBuildConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        danger
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
      />
    </main>
  );
}

export default function SkillSimulatorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      }
    >
      <SimulatorInner />
    </Suspense>
  );
}
