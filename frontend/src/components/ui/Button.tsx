import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'borrower' | 'lender';
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'borrower',
  fullWidth = false,
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], fullWidth && styles.fullWidth, className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}
