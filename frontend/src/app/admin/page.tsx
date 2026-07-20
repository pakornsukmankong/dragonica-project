'use client';

import { useTranslations } from 'next-intl';
import * as Tabs from '@radix-ui/react-tabs';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { DungeonsTab } from './tabs/dungeons';
import { ItemsTab } from './tabs/items';
import { ClassesTab } from './tabs/classes';
import { UsersTab } from './tabs/users';
import { SkillBuildsTab } from './tabs/skill-builds';
import { ItemCodesTab } from './tabs/item-codes';
import { DonationsTab } from './tabs/donations';
import { TicketsTab } from './tabs/tickets';

const TABS = [
  { value: 'dungeons', Tab: DungeonsTab },
  { value: 'items', Tab: ItemsTab },
  { value: 'classes', Tab: ClassesTab },
  { value: 'users', Tab: UsersTab },
  { value: 'skillBuilds', Tab: SkillBuildsTab },
  { value: 'itemCodes', Tab: ItemCodesTab },
  { value: 'donations', Tab: DonationsTab },
  { value: 'tickets', Tab: TicketsTab },
] as const;

export default function AdminPage() {
  const t = useTranslations('admin');
  const { isAdmin, isLoading: isRoleLoading } = useIsAdmin();

  if (isRoleLoading) {
    return (
      <div className="min-h-screen bg-root flex items-center justify-center">
        <p className="text-sm text-muted">{t('checkingPermissions')}</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-root flex items-center justify-center">
        <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-8 text-center max-w-sm">
          <p className="text-sm font-medium text-foreground mb-2">{t('accessDenied')}</p>
          <p className="text-xs text-muted">{t('accessDeniedDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-root">
      <section className="relative overflow-hidden py-[40px] laptop:py-[60px]">
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
          <div className="mb-8">
            <h1 className="text-xl laptop:text-2xl font-medium text-foreground">
              {t('title')}
            </h1>
            <p className="text-sm text-muted mt-2">
              {t('subtitle')}
            </p>
          </div>

          <Tabs.Root defaultValue="dungeons">
            <Tabs.List className="mb-8 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-base border border-border bg-raised p-2">
              {TABS.map(({ value }) => (
                <Tabs.Trigger
                  key={value}
                  value={value}
                  className="rounded-sm px-5 py-2.5 text-xs font-semibold tracking-wide text-muted outline-none transition-all duration-150 hover:bg-surface hover:text-foreground data-[state=active]:bg-gold-soft data-[state=active]:text-gold data-[state=active]:shadow-[inset_0_0_0_1px_rgba(224,165,60,0.35)]"
                >
                  {t(`tab${value.charAt(0).toUpperCase()}${value.slice(1)}`)}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {TABS.map(({ value, Tab }) => (
              <Tabs.Content key={value} value={value} className="outline-none">
                <Tab />
              </Tabs.Content>
            ))}
          </Tabs.Root>
        </div>
      </section>
    </main>
  );
}
