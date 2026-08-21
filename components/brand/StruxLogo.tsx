import { cn } from '@/lib/utils';
import { StruxMark } from '@/components/brand/StruxMark';

type StruxLogoProps = {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
};

/** Horizontal lockup: branch mark + Strux wordmark. */
export function StruxLogo({
  className,
  markClassName,
  wordmarkClassName,
}: StruxLogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <StruxMark className={cn('size-5', markClassName)} title="" />
      <span
        className={cn(
          'text-sm font-semibold tracking-tight text-foreground',
          wordmarkClassName
        )}
      >
        Strux
      </span>
    </div>
  );
}
