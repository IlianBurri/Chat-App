import { CaretLeftIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { IconButton } from '@/components/ui/IconButton';

/** Back to the section's list; only below 768px, where list and detail do not fit side by side. */
export function MobileBack({ to }: { to: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return <IconButton label={t('nav.back')} icon={CaretLeftIcon} className="-ml-2 shrink-0 md:hidden" onClick={() => navigate(to)} />;
}
