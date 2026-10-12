import { Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { IconButton } from '@/components/ui/IconButton';
import { useToast } from '@/components/ui/Toaster';
import { useMessagesStore } from '@/stores/messages';

const MAX_OPTIONS = 10;

export function PollDialog({ chatId, open, onClose }: { chatId: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const createPoll = useMessagesStore((s) => s.createPoll);
  const showToast = useToast((s) => s.show);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [busy, setBusy] = useState(false);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const valid = question.trim().length > 0 && filled.length >= 2;

  const close = () => {
    setQuestion('');
    setOptions(['', '']);
    setMultiple(false);
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await createPoll(chatId, { question: question.trim(), options: filled, multiple });
      close();
    } catch {
      showToast(t('auth.errors.generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} title={t('poll.create')} width={460}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="poll-question" className="mb-1 block text-sm font-medium">
            {t('poll.question')}
          </label>
          <input
            id="poll-question"
            autoFocus
            required
            maxLength={300}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="h-9 w-full rounded-md border border-line bg-input px-3 text-sm outline-none focus:border-accent"
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">{t('poll.options')}</legend>
          {options.map((option, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                aria-label={t('poll.option', { number: i + 1 })}
                placeholder={t('poll.option', { number: i + 1 })}
                maxLength={200}
                value={option}
                onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
                className="h-9 flex-1 rounded-md border border-line bg-input px-3 text-sm outline-none focus:border-accent"
              />
              <IconButton
                label={t('poll.removeOption', { number: i + 1 })}
                icon={X}
                size="sm"
                disabled={options.length <= 2}
                onClick={() => setOptions(options.filter((_, j) => j !== i))}
              />
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <Button size="sm" variant="ghost" icon={Plus} onClick={() => setOptions([...options, ''])}>
              {t('poll.addOption')}
            </Button>
          )}
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} className="size-4 accent-[var(--ui-accent)]" />
          {t('poll.allowMultiple')}
        </label>
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={!valid || busy}>
            {t('poll.send')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
