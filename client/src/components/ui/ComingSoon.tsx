import { SparkleIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { Button } from './Button';
import { Dialog } from './Dialog';

interface ComingSoonState {
  feature: string | null;
  show: (feature: string) => void;
  hide: () => void;
}

/** Global "coming soon" notice for features that are planned but not built yet. */
export const useComingSoon = create<ComingSoonState>((set) => ({
  feature: null,
  show: (feature) => set({ feature }),
  hide: () => set({ feature: null }),
}));

export function ComingSoonDialog() {
  const { t } = useTranslation();
  const { feature, hide } = useComingSoon();
  return (
    <Dialog
      open={feature !== null}
      onClose={hide}
      title={t('common.comingSoon')}
      width={380}
      footer={
        <Button variant="primary" onClick={hide}>
          {t('common.close')}
        </Button>
      }
    >
      <div className="flex items-start gap-3">
        <SparkleIcon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
        <p className="text-sm text-muted">{t('common.comingSoonText', { feature })}</p>
      </div>
    </Dialog>
  );
}
