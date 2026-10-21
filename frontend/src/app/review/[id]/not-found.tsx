import Link from 'next/link';
import { Card } from '@/components/lender/Card';
import styles from '../review.module.css';

export default function ApplicationNotFound() {
  return (
    <Card>
      <h1 className={styles.title}>No application with that id</h1>
      <p className={styles.hint}>It may have been typed wrong. Choose one from the queue instead.</p>
      <Link href="/review" className={styles.back}>
        Back to the queue
      </Link>
    </Card>
  );
}
