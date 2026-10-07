'use client';

import { useEffect, useRef } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  busyLabel: string;
  cancelLabel?: string;
  isBusy?: boolean;
  errorMessage?: string;
  tone?: 'danger' | 'warning';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  busyLabel,
  cancelLabel = 'No, go back',
  isBusy = false,
  errorMessage,
  tone = 'warning',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const isBusyRef = useRef(isBusy);
  onCancelRef.current = onCancel;
  isBusyRef.current = isBusy;

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusyRef.current) onCancelRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={styles.overlay} onMouseDown={(event) => event.target === event.currentTarget && !isBusy && onCancel()}>
      <section
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <button type="button" className={styles.closeButton} onClick={onCancel} disabled={isBusy} aria-label="Close dialog">
          <FiX />
        </button>
        <div className={`${styles.icon} ${tone === 'danger' ? styles.danger : styles.warning}`}>
          <FiAlertTriangle />
        </div>
        <div className={styles.copy}>
          <h2 id="confirm-dialog-title">{title}</h2>
          <p id="confirm-dialog-description">{description}</p>
        </div>
        {errorMessage && <div className={styles.error} role="alert">{errorMessage}</div>}
        <div className={styles.actions}>
          <button ref={cancelRef} type="button" className={styles.cancelButton} onClick={onCancel} disabled={isBusy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.confirmButton} ${tone === 'danger' ? styles.dangerButton : styles.warningButton}`}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? busyLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
