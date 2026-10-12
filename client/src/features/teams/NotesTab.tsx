import { NotebookIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Markdown } from '@/components/chat/Markdown';
import { EmptyState } from '@/components/layout/PlaceholderView';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toaster';
import { usePostsStore } from '@/stores/posts';
import { useChannelContext } from './channelContext';

/** Shared markdown notes of a channel; guests can read but not edit. */
export function NotesTab() {
  const { t } = useTranslation();
  const { workspace, channel, mentionTargets, meId } = useChannelContext();
  const showToast = useToast((s) => s.show);
  const notes = usePostsStore((s) => s.details[channel.id]?.notes);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = workspace.permissions.editNotes;

  if (notes === undefined) return <p className="p-6 text-sm text-muted">{t('common.loading')}</p>;

  const save = async () => {
    if (draft === null) return;
    setSaving(true);
    try {
      await usePostsStore.getState().saveNotes(channel.id, draft);
      setDraft(null);
    } catch {
      showToast(t('auth.errors.generic'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (draft !== null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-6">
        <textarea
          autoFocus
          aria-label={t('teams.notes.label')}
          value={draft}
          maxLength={20_000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDraft(null);
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save();
          }}
          className="min-h-0 flex-1 resize-none rounded-lg border border-line bg-input p-3 font-mono text-sm leading-relaxed outline-none focus:border-accent"
        />
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-xs text-subtle">{t('teams.notes.hint')}</span>
          <Button onClick={() => setDraft(null)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={saving} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {notes.trim() ? (
        <div className="mx-auto max-w-3xl p-6">
          {canEdit && (
            <div className="mb-3 flex justify-end">
              <Button size="sm" icon={PencilSimpleIcon} onClick={() => setDraft(notes)}>
                {t('message.edit')}
              </Button>
            </div>
          )}
          <Markdown source={notes} mentions={mentionTargets} meId={meId} className="text-sm leading-relaxed" />
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <EmptyState icon={NotebookIcon} title={t('teams.notes.emptyTitle')} text={canEdit ? t('teams.notes.emptyText') : t('teams.notes.emptyReadOnly')} />
          {canEdit && (
            <div className="-mt-16 flex justify-center pb-10">
              <Button variant="primary" icon={PencilSimpleIcon} onClick={() => setDraft('')}>
                {t('teams.notes.start')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
