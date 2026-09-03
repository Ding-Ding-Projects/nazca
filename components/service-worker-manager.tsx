'use client';

import { useEffect } from 'react';
import { useVisitorState } from '@/components/visitor-state-provider';
import { publicPath } from '@/lib/public-path';

export function ServiceWorkerManager() {
  const { notify } = useVisitorState();
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator)
    )
      return undefined;
    let active = true;
    const announcedWorkers = new WeakSet<ServiceWorker>();
    let registration: ServiceWorkerRegistration | undefined;

    const announceUpdate = (worker: ServiceWorker | null) => {
      if (
        !active ||
        !worker ||
        announcedWorkers.has(worker) ||
        !navigator.serviceWorker.controller
      )
        return;
      announcedWorkers.add(worker);
      notify({
        kind: 'info',
        title: 'Update ready',
        body: 'Reload when convenient to use the newest static reader.',
        action: { kind: 'reload', label: 'Reload now' },
      });
    };

    const watchWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') announceUpdate(worker);
      });
    };

    const checkForUpdate = () => {
      if (active && registration && document.visibilityState === 'visible') {
        void registration.update().catch(() => undefined);
      }
    };

    navigator.serviceWorker
      .register(publicPath('/sw.js'), {
        scope: publicPath('/'),
        updateViaCache: 'none',
      })
      .then((nextRegistration) => {
        if (!active) return;
        registration = nextRegistration;
        nextRegistration.addEventListener('updatefound', () => {
          watchWorker(nextRegistration.installing);
        });
        watchWorker(nextRegistration.installing);
        announceUpdate(nextRegistration.waiting);
        // Ask the browser to compare the script immediately, without reusing
        // an HTTP-cached worker script from an older deployment.
        checkForUpdate();
        document.addEventListener('visibilitychange', checkForUpdate);
        window.addEventListener('focus', checkForUpdate);
      })
      .catch((error) => {
        if (!active) return;
        notify({
          kind: 'warning',
          title: 'Offline support unavailable',
          body:
            error instanceof Error
              ? error.message
              : 'Service worker registration failed.',
        });
      });
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', checkForUpdate);
      window.removeEventListener('focus', checkForUpdate);
    };
  }, [notify]);
  return null;
}
