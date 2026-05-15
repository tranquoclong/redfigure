import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",

        nsfw: "bg-magenta text-white [font-family:var(--font-jetbrains-mono)] uppercase tracking-wider px-2.5 py-1 h-auto",

        studio:
          "bg-white/[0.04] border-white/10 text-white [font-family:var(--font-jetbrains-mono)] uppercase tracking-wider px-3 py-1 h-auto before:content-[''] before:size-2 before:rounded-full before:bg-magenta before:mr-1.5 before:[box-shadow:0_0_8px_rgba(255,0,122,0.7)]",

        "free-shipping":
          "bg-lime/10 border-lime/40 text-lime [font-family:var(--font-jetbrains-mono)] uppercase tracking-wider px-2.5 py-1 h-auto",

        production:
          "bg-cyan/10 border-cyan/35 text-cyan [font-family:var(--font-jetbrains-mono)] tracking-wide px-2 py-0.5 h-auto",

        "in-cart":
          "bg-cyan/10 border-cyan/40 text-cyan [font-family:var(--font-jetbrains-mono)] uppercase tracking-wide px-2 py-0.5 h-auto",

        eyebrow:
          "bg-transparent text-cyan/85 [font-family:var(--font-jetbrains-mono)] uppercase tracking-wider px-0 py-0 h-auto rounded-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

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
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
