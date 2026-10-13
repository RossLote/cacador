import type { VariantProps } from 'class-variance-authority';
import { Link, type LinkProps } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * A router link drawn as a button: an anchor, so it keeps link semantics,
 * with the button's variant and size classes merged with `className`.
 */
export function LinkButton({ variant, size, className, ...props }: LinkProps & VariantProps<typeof buttonVariants>) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
