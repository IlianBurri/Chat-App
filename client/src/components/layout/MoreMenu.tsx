import { Ellipsis, Languages, Monitor, Moon, Settings, Sun } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Menu';
import { LANGUAGES } from '@/i18n';
import { useUiStore } from '@/stores/ui';
import { SettingsDialog } from './SettingsDialog';

/** Title bar ⋯ menu: settings, theme and language. */
export function MoreMenu() {
  const { t, i18n } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <Menu
        label={t('settings.menu')}
        width={220}
        trigger={({ ref, ...props }) => <IconButton ref={ref} label={t('settings.menu')} icon={Ellipsis} {...props} />}
      >
        <MenuItem icon={Settings} onSelect={() => setSettingsOpen(true)}>
          {t('settings.title')}
        </MenuItem>
        <MenuSeparator />
        <MenuLabel>{t('settings.theme')}</MenuLabel>
        <MenuItem icon={Monitor} checked={theme === 'system'} onSelect={() => setTheme('system')}>
          {t('settings.themeSystem')}
        </MenuItem>
        <MenuItem icon={Sun} checked={theme === 'light'} onSelect={() => setTheme('light')}>
          {t('settings.themeLight')}
        </MenuItem>
        <MenuItem icon={Moon} checked={theme === 'dark'} onSelect={() => setTheme('dark')}>
          {t('settings.themeDark')}
        </MenuItem>
        <MenuSeparator />
        <MenuLabel>{t('settings.language')}</MenuLabel>
        {LANGUAGES.map((l) => (
          <MenuItem
            key={l.code}
            icon={Languages}
            checked={i18n.resolvedLanguage === l.code}
            onSelect={() => void i18n.changeLanguage(l.code)}
          >
            {l.label}
          </MenuItem>
        ))}
      </Menu>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
