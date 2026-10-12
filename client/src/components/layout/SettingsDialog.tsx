import clsx from 'clsx';
import { DesktopIcon, MoonIcon, SunIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/ui/Dialog';
import { LANGUAGES } from '@/i18n';
import { useUiStore, type ThemePreference } from '@/stores/ui';

const THEMES = [
  { value: 'system', icon: DesktopIcon, label: 'settings.themeSystem' },
  { value: 'light', icon: SunIcon, label: 'settings.themeLight' },
  { value: 'dark', icon: MoonIcon, label: 'settings.themeDark' },
] as const;

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

  return (
    <Dialog open={open} onClose={onClose} title={t('settings.title')} width={480}>
      <div className="space-y-6">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t('settings.theme')}</legend>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map(({ value, icon: Icon, label }) => (
              <label
                key={value}
                className={clsx(
                  'flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-accent',
                  theme === value ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:bg-hover',
                )}
              >
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={theme === value}
                  onChange={() => setTheme(value as ThemePreference)}
                  className="sr-only"
                />
                <Icon className="size-5" aria-hidden="true" />
                {t(label)}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="settings-language" className="mb-2 block text-sm font-semibold">
            {t('settings.language')}
          </label>
          <select
            id="settings-language"
            value={i18n.resolvedLanguage}
            onChange={(e) => void i18n.changeLanguage(e.target.value)}
            className="h-8 w-full rounded-md border border-line bg-input px-2 text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">{t('settings.keyboardShortcuts')}</h3>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
            {[
              [t('settings.shortcutSearch'), `${mod} K`],
              [t('settings.shortcutSend'), 'Enter'],
              [t('settings.shortcutNewLine'), 'Shift Enter'],
            ].map(([label, keys]) => (
              <div key={label} className="contents">
                <dt className="text-muted">{label}</dt>
                <dd>
                  <kbd className="rounded border border-line px-1.5 text-xs">{keys}</kbd>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Dialog>
  );
}
