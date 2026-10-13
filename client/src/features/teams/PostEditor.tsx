import clsx from 'clsx';
import { PaperPlaneRightIcon, PaperclipIcon, SmileyIcon, TextAaIcon } from '@phosphor-icons/react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FormatToolbar, MentionSuggestions } from '@/components/editor/EditorParts';
import { useTextEditor, type MentionCandidate } from '@/components/editor/useTextEditor';
import { Button } from '@/components/ui/Button';
import { useComingSoon } from '@/components/ui/ComingSoon';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { IconButton } from '@/components/ui/IconButton';
import { Popover } from '@/components/ui/Popover';
import { useToast } from '@/components/ui/Toaster';

interface PostEditorProps {
  label: string;
  candidates: MentionCandidate[];
  onSubmit: (content: string, subject: string) => Promise<void>;
  onCancel?: () => void;
  initialText?: string;
  initialSubject?: string;
  /** Shows the subject field (new posts and post edits) */
  withSubject?: boolean;
  /** Opens with the formatting toolbar visible */
  richByDefault?: boolean;
  /** Enter sends (replies); otherwise Ctrl+Enter sends and Enter adds a line */
  enterSends?: boolean;
  submitLabel?: string;
  autoFocus?: boolean;
}

/** Editor for channel posts, replies and edits: formatting, emoji and @mentions. */
export function PostEditor({
  label,
  candidates,
  onSubmit,
  onCancel,
  initialText = '',
  initialSubject = '',
  withSubject = false,
  richByDefault = false,
  enterSends = false,
  submitLabel,
  autoFocus = true,
}: PostEditorProps) {
  const { t } = useTranslation();
  const showToast = useToast((s) => s.show);
  const showComingSoon = useComingSoon((s) => s.show);
  const [text, setText] = useState(initialText);
  const [subject, setSubject] = useState(initialSubject);
  const [rich, setRich] = useState(richByDefault);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editor = useTextEditor({ text, onTextChange: setText, candidates, textareaRef });

  useEffect(() => {
    if (!autoFocus) return;
    const el = textareaRef.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, [autoFocus]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
  }, [text, rich]);

  const submit = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    // Clear right away; the text comes back if saving fails.
    const previous = { text, subject };
    setText('');
    setSubject('');
    try {
      await onSubmit(content, previous.subject.trim());
    } catch {
      setText(previous.text);
      setSubject(previous.subject);
      showToast(t('composer.sendFailed'), 'error');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (editor.handleKeyDown(e)) return;
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      const sendNow = enterSends && !rich ? !e.shiftKey : e.ctrlKey || e.metaKey;
      if (sendNow) {
        e.preventDefault();
        void submit();
      }
    } else if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  const hint = enterSends && !rich ? undefined : t('composer.ctrlEnterHint');

  return (
    <div className="relative">
      <MentionSuggestions mentions={editor.mentions} className="left-0" />
      <div className="rounded-lg border border-line bg-input focus-within:border-b-accent focus-within:shadow-[inset_0_-2px_0_var(--ui-accent)]">
        {(withSubject || rich) && (
          <div className="border-b border-line px-3 pt-2">
            {withSubject && (
              <input
                aria-label={t('composer.subject')}
                placeholder={t('composer.subject')}
                value={subject}
                maxLength={200}
                onChange={(e) => setSubject(e.target.value)}
                className="h-9 w-full bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-subtle focus-visible:outline-none"
              />
            )}
            {rich && <FormatToolbar onFormat={editor.format} hint={hint} />}
          </div>
        )}
        <textarea
          ref={textareaRef}
          rows={1}
          aria-label={label}
          placeholder={label}
          {...editor.textareaProps}
          onKeyDown={onKeyDown}
          className={clsx(
            'block w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-subtle focus-visible:outline-none',
            (withSubject || rich) && 'min-h-20',
          )}
        />
        <div className="flex items-center gap-0.5 px-2 pb-1.5">
          <IconButton
            label={rich ? t('composer.collapse') : t('composer.format')}
            icon={TextAaIcon}
            size="sm"
            active={rich}
            aria-pressed={rich}
            onClick={() => setRich((v) => !v)}
          />
          <Popover
            label={t('composer.emoji')}
            placement="top-start"
            trigger={({ ref, ...props }) => <IconButton ref={ref} label={t('composer.emoji')} icon={SmileyIcon} size="sm" {...props} />}
          >
            <EmojiPicker onSelect={editor.insertText} />
          </Popover>
          <IconButton label={t('composer.attach')} icon={PaperclipIcon} size="sm" onClick={() => showComingSoon(t('composer.attach'))} />
          <div className="ml-auto flex items-center gap-1.5">
            {onCancel && (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
            )}
            {submitLabel ? (
              <Button size="sm" variant="primary" disabled={!text.trim() || sending} onClick={() => void submit()}>
                {submitLabel}
              </Button>
            ) : (
              <IconButton
                label={t('composer.send')}
                icon={PaperPlaneRightIcon}
                size="sm"
                className={clsx(text.trim() && 'text-accent hover:text-accent')}
                disabled={!text.trim() || sending}
                onClick={() => void submit()}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
