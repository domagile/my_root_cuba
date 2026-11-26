import { useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react';
import type React from 'react';

/** A non-modal disclosure: Escape/close return focus; Tab/outside clicks do not. */
export function useTreePopover(open: boolean, onClose: () => void, externalRef?: React.Ref<HTMLDivElement>) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const setPopupRef = useCallback((node: HTMLDivElement | null) => {
    popupRef.current = node;
    if (typeof externalRef === 'function') {
      const cleanup = externalRef(node);
      if (node) return () => {
        popupRef.current = null;
        if (typeof cleanup === 'function') cleanup(); else externalRef(null);
      };
    } else if (externalRef) externalRef.current = node;
  }, [externalRef]);
  useLayoutEffect(() => {
    if (open) popupRef.current?.focus({ preventScroll: true });
  }, [open]);
  const close = () => {
    onClose();
    if (triggerRef.current?.isConnected) triggerRef.current.focus({ preventScroll: true });
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation(); close();
  };
  const onBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    // A click on non-focusable text inside the popup can have no relatedTarget.
    if (!event.relatedTarget) return;
    if (event.relatedTarget === triggerRef.current) return;
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
  };
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault(); close();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open, onClose]);
  return { id, triggerId: `${id}-trigger`, triggerRef, setPopupRef, close, onKeyDown, onBlur };
}
