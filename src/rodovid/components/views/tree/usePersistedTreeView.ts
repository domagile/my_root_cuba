import { useEffect, useLayoutEffect, useRef } from 'react';
import { saveUserTreeState, type UserTreeState } from '../../../../utils/userTreeState';
import { flushPendingLocalWritesSync } from '../../../../utils/indexedDbStorage';

export interface TreeViewSnapshot { email: string; state: Partial<UserTreeState>; }

/** Save committed camera state even when the view is closed before the debounce. */
export function usePersistedTreeView(snapshot: TreeViewSnapshot | null): void {
  const latest = useRef<TreeViewSnapshot | null>(null);
  useLayoutEffect(() => {
    const previous = latest.current;
    if (previous && previous.email !== snapshot?.email) saveUserTreeState(previous.email, previous.state, true);
    latest.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    const timer = window.setTimeout(() => saveUserTreeState(snapshot.email, snapshot.state), 600);
    return () => window.clearTimeout(timer);
  }, [snapshot]);

  useEffect(() => {
    const save = () => {
      const value = latest.current;
      if (value) saveUserTreeState(value.email, value.state, true);
    };
    const leavingPage = () => { save(); flushPendingLocalWritesSync(); };
    const visibility = () => { if (document.visibilityState === 'hidden') leavingPage(); };
    window.addEventListener('pagehide', leavingPage);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pagehide', leavingPage);
      document.removeEventListener('visibilitychange', visibility);
      save();
    };
  }, []);
}
