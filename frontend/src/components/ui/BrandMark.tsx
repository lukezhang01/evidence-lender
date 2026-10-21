import { CheckIcon } from './icons';
import styles from './BrandMark.module.css';

export function BrandMark({ name }: { name: string }) {
  return (
    <span className={styles.brand}>
      <span className={styles.mark}>
        <CheckIcon size={18} />
      </span>
      <span className={styles.name}>{name}</span>
    </span>
  );
}
