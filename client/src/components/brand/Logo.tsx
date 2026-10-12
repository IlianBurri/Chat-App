import { useTranslation } from 'react-i18next';

/** Speech bubble rising from a line of three people. */
const BUBBLE =
  'M11.5 5H20.5A3.5 3.5 0 0 1 24 8.5V11.5A3.5 3.5 0 0 1 20.5 15H18L16 18L14 15H11.5A3.5 3.5 0 0 1 8 11.5V8.5A3.5 3.5 0 0 1 11.5 5Z';

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path d={BUBBLE} fill="#fff" />
      <path d="M8 23H24" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <circle cx="8" cy="23" r="2.6" fill="#fff" />
      <circle cx="16" cy="23" r="2.6" fill="#fff" />
      <circle cx="24" cy="23" r="2.6" fill="#fff" />
    </svg>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="font-semibold tracking-tight text-fg" style={{ fontSize: size * 0.62 }}>
        {t('app.name')}
      </span>
    </span>
  );
}
