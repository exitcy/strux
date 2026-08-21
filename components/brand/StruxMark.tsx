import { cn } from '@/lib/utils';

type StruxMarkProps = {
  className?: string;
  /** Accessible name; omit or pass empty string for decorative use. */
  title?: string;
};

/**
 * Branch/fork mark: thick left-opening chevron converging into a
 * right-pointing arrow (matches Strux brand mockup).
 */
export function StruxMark({ className, title = 'Strux' }: StruxMarkProps) {
  const decorative = !title;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : 'img'}
      className={cn('size-4 shrink-0', className)}
    >
      {!decorative ? <title>{title}</title> : null}
      <path d="M1.75 3.5 12 12 1.75 20.5h3.75L13.5 14h3.25v3.25L22.25 12l-5.5-5.25V10H13.5L5.5 3.5H1.75Z" />
    </svg>
  );
}
