'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { Select } from '@/components/select';
import type { Character, GameClass } from '@/types';

export default function CharactersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);

  const { data: characters, isLoading } = useQuery<Character[]>({
    queryKey: ['characters'],
    queryFn: () => api.get('/characters'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/characters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters'] });
      toast({ title: 'Character deleted', variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: 'Could not delete character',
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-root flex items-center justify-center">
        <p className="text-sm text-muted">Loading characters...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-root">
      <section className="relative overflow-hidden py-[60px] laptop:py-[90px]">
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: 'url(/texture.png)',
            backgroundRepeat: 'repeat',
            opacity: 0.05,
            mixBlendMode: 'multiply',
          }}
        />
        <div className="relative z-10 mx-auto max-w-container px-4 sm:px-7">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-xl laptop:text-2xl font-medium text-foreground">
                Characters
              </h1>
              <p className="text-sm text-muted mt-2">
                Manage your Dragonica characters
              </p>
            </div>
            <button
              onClick={() => {
                setEditingChar(null);
                setIsCreating(true);
              }}
              className="rounded-base px-4 py-2.5 text-sm font-medium text-[#1b1407] bg-[var(--blue)] shadow-button transition-colors duration-150 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
            >
              + New Character
            </button>
          </div>

          {(isCreating || editingChar) && (
            <CharacterForm
              key={editingChar?.id ?? 'new'}
              character={editingChar ?? undefined}
              onClose={() => {
                setIsCreating(false);
                setEditingChar(null);
              }}
            />
          )}

          {characters && characters.length === 0 ? (
            <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-10 text-center">
              <p className="text-sm text-muted">
                No characters yet. Create your first one!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 laptop:grid-cols-3 gap-6">
              {characters?.map((char) => (
                <div
                  key={char.id}
                  className="group relative overflow-hidden bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5 transition-all duration-200 hover:outline-[rgba(224,165,60,0.35)] hover:shadow-gold"
                >
                  {/* Gold top accent on hover */}
                  <span className="absolute inset-x-0 top-0 h-[2px] bg-gold opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-base bg-gold-soft text-base font-bold uppercase text-gold">
                      {char.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-sm font-semibold text-foreground">
                          {char.name}
                        </h3>
                        <span className="inline-flex shrink-0 items-center rounded-full border border-[rgba(224,165,60,0.35)] bg-gold-soft px-2 py-0.5 text-[11px] font-bold text-gold tabular-nums">
                          Lv.{char.level}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {char.classes?.name ?? 'Unknown'}
                        {char.classes?.parent_class && (
                          <span> · {char.classes.parent_class}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-1 border-t border-border pt-3">
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        setEditingChar(char);
                      }}
                      className="rounded-base px-3 py-1.5 text-xs font-medium text-muted hover:text-gold transition-colors duration-150 focus:outline-none"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(char.id)}
                      disabled={deleteMutation.isPending}
                      className="rounded-base px-3 py-1.5 text-xs font-medium text-muted hover:text-[var(--fg-danger)] transition-colors duration-150 focus:outline-none disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function CharacterForm({
  character,
  onClose,
}: {
  character?: Character;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!character;
  const [name, setName] = useState(character?.name ?? '');
  const [classId, setClassId] = useState(character?.class_id ?? '');
  const [level, setLevel] = useState(character?.level ?? 1);

  const { data: classes } = useQuery<GameClass[]>({
    queryKey: ['classes'],
    queryFn: () => api.get('/game-data/classes'),
  });

  const saveMutation = useMutation({
    mutationFn: (body: { name: string; classId: string; level: number }) =>
      isEdit
        ? api.patch(`/characters/${character.id}`, body)
        : api.post('/characters', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({
        title: isEdit ? 'Character updated' : 'Character created',
        variant: 'success',
      });
      onClose();
    },
    onError: (e) =>
      toast({
        title: isEdit ? 'Could not update character' : 'Could not create character',
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !classId) return;
    saveMutation.mutate({ name, classId, level });
  };

  return (
    <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6 mb-6">
      <h3 className="text-sm font-medium text-foreground mb-4">
        {isEdit ? 'Edit Character' : 'Create Character'}
      </h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="char-name" className="text-xs font-medium text-foreground">
              Name
            </label>
            <input
              id="char-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
              placeholder="Character name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="char-class" className="text-xs font-medium text-foreground">
              Class
            </label>
            <Select
              id="char-class"
              value={classId}
              onChange={setClassId}
              placeholder="Select class"
              options={(classes ?? []).map((cls) => ({
                value: cls.id,
                label: cls.parent_class
                  ? `${cls.name} (${cls.parent_class})`
                  : cls.name,
              }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="char-level" className="text-xs font-medium text-foreground">
              Level
            </label>
            <input
              id="char-level"
              type="number"
              min={1}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-base px-4 py-2 text-sm font-medium text-[#1b1407] bg-[var(--blue)] shadow-button transition-colors duration-150 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2 disabled:opacity-50"
          >
            {saveMutation.isPending
              ? isEdit
                ? 'Saving...'
                : 'Creating...'
              : isEdit
                ? 'Save'
                : 'Create'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-base px-4 py-2 text-sm font-medium text-foreground border border-border hover:bg-raised transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
        {saveMutation.isError && (
          <p className="text-xs text-[var(--fg-danger)]">
            {(saveMutation.error as Error).message}
          </p>
        )}
      </form>
    </div>
  );
}
