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
    navigator.serviceWorker
      .register(publicPath('/sw.js'), { scope: publicPath('/') })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (
              active &&
              worker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              notify({
                kind: 'info',
                title: 'Update ready',
                body: 'Reload when convenient to use the newest static reader.',
              });
            }
          });
        });
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
    };
  }, [notify]);
  return null;
}
