import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-2 text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3.5! [&>svg]:stroke-[1.75]",
  {
    variants: {
      variant: {
        // The rust fill's hover keeps the on-fill text at 4.5:1 (RUST_HOVER in components/styles.ts).
        default: "bg-primary text-primary-foreground [a]:hover:bg-[color-mix(in_srgb,var(--color-primary)_90%,var(--color-ink))]",
        secondary:
          "border-border bg-secondary text-secondary-foreground [a]:hover:bg-muted",
        // Text on clay is ink, never rust (DESIGN.md § 8.5): the rust is the hairline only.
        destructive:
          "border-destructive bg-clay text-ink focus-visible:ring-destructive/30",
        success: "bg-accent text-success",
        outline:
          "border-border text-foreground [a]:hover:bg-muted",
        ghost:
          "hover:bg-muted",
        link: "text-forest underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
