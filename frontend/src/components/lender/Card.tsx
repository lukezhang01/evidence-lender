import styles from './Card.module.css';

export function Card({ children, labelledBy }: { children: React.ReactNode; labelledBy?: string }) {
  return (
    <section className={styles.card} aria-labelledby={labelledBy}>
      {children}
    </section>
  );
}
