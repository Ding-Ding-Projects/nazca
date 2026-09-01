'use client';

import { X } from 'lucide-react';
import { useVisitorState } from '@/components/visitor-state-provider';

export function NotificationToasts() {
  const { notifications, dismissNotification } = useVisitorState();
  const active = notifications
    .filter((notification) => !notification.dismissed)
    .slice(-4);
  if (!active.length) return null;
  return (
    <aside className="notification-stack" aria-label="Current notifications">
      {active.map((notification) => (
        <section
          key={notification.id}
          className={`notification-card notification-${notification.kind}`}
          role={
            notification.kind === 'error' || notification.kind === 'warning'
              ? 'alert'
              : 'status'
          }
        >
          <div>
            <strong>{notification.title}</strong>
            <p>{notification.body}</p>
          </div>
          <button
            type="button"
            aria-label={`Dismiss ${notification.title}`}
            onClick={() => dismissNotification(notification.id)}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </section>
      ))}
    </aside>
  );
}
