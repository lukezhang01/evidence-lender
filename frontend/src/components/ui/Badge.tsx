import type { Tone } from '@/lib/labels';
import styles from './Badge.module.css';

interface BadgeProps {
  tone: Tone | 'demo';
  title?: string;
  children: React.ReactNode;
}

export function Badge({ tone, title, children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`} title={title}>
      {children}
    </span>
  );
}
