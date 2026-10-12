import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toaster';
import type { MessageDto } from '@/lib/types';
import { useMessagesStore } from '@/stores/messages';

/** Inline editor for one's own message: Enter saves, Escape cancels. */
export function MessageEditor({ message, onDone }: { message: MessageDto; onDone: () => void }) {
  const { t } = useTranslation();
  const edit = useMessagesStore((s) => s.edit);
  const showToast = useToast((s) => s.show);
  const [value, setValue] = useState(message.content);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value]);

  const save = async () => {
    const content = value.trim();
    if (!content || content === message.content) return onDone();
    setSaving(true);
    try {
      await edit(message.id, content, message.subject);
      onDone();
    } catch {
      showToast(t('auth.errors.generic'), 'error');
      setSaving(false);
    }
  };

  return (
    <div className="w-[min(560px,60vw)] space-y-2 not-italic">
      <textarea
        ref={ref}
        aria-label={t('message.edit')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void save();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onDone();
          }
        }}
        className="block w-full resize-none rounded-md border border-line bg-input p-2 text-sm outline-none focus:border-accent"
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button size="sm" variant="primary" disabled={saving || !value.trim()} onClick={() => void save()}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}
