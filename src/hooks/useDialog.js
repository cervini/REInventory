import { useEffect, useRef } from 'react';

export default function useDialog({ onClose, busy = false, suspended = false }) {
  const dialogRef = useRef(null);
  const optionsRef = useRef({ onClose, busy, suspended });

  useEffect(() => { optionsRef.current = { onClose, busy, suspended }; }, [onClose, busy, suspended]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const scrollParent = dialog?.closest('.app__body');
    const previousBodyOverflow = document.body.style.overflow;
    const previousParentOverflow = scrollParent?.style.overflow;
    document.body.style.overflow = 'hidden';
    if (scrollParent) scrollParent.style.overflow = 'hidden';
    dialog?.querySelector('[data-dialog-autofocus]')?.focus();

    const handleKeyDown = event => {
      const options = optionsRef.current;
      if (options.suspended) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!options.busy) options.onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex]'))
        .filter(control => !control.matches(':disabled, [hidden], [type="hidden"], [tabindex="-1"], [aria-disabled="true"]'));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (scrollParent) scrollParent.style.overflow = previousParentOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return dialogRef;
}