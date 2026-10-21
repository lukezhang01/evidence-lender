'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import type { Tone } from '@/lib/labels';
import styles from './Queue.module.css';

export interface QueueItem {
  id: string;
  name: string;
  meta: string;
  statusLabel: string;
  tone: Tone;
}

// Client component only to know which application is open.
export function QueueList({ items, labelledBy }: { items: QueueItem[]; labelledBy: string }) {
  const openId = useSelectedLayoutSegment();

  return (
    <nav aria-labelledby={labelledBy}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/review/${encodeURIComponent(item.id)}`}
              className={styles.item}
              aria-current={item.id === openId ? 'page' : undefined}
            >
              <span className={styles.row}>
                <span className={styles.name}>{item.name}</span>
                <span className={styles.id}>#{item.id}</span>
              </span>
              <span className={styles.meta}>{item.meta}</span>
              <Badge tone={item.tone}>{item.statusLabel}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
