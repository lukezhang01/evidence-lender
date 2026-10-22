import { Card } from '@/components/lender/Card';
import styles from './review.module.css';

export default function ReviewIndexPage() {
  return (
    <Card>
      <p className={styles.hint}>Choose an application.</p>
    </Card>
  );
}
