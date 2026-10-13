import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/lib/api';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { useToast } from './Toaster';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  /** Maps API error codes to messages; unknown errors show a generic toast. */
  errors?: Record<string, string>;
}

/** "Are you sure?" dialog that stays open (with a toast) when the action fails. */
export function ConfirmDialog({ open, title, children, confirmLabel, danger, onConfirm, onClose, errors = {} }: ConfirmDialogProps) {
  const { t } = useTranslation();
  const showToast = useToast((s) => s.show);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      showToast((e instanceof ApiError && errors[e.code]) || t('auth.errors.generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      width={420}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={busy} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted">{children}</div>
    </Dialog>
  );
}
