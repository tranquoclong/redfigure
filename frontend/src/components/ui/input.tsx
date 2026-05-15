import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(

        "h-10 w-full min-w-0 rounded-xl border border-purple/15 bg-black/40 px-3 py-2 text-sm text-white transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white placeholder:text-white/30 focus-visible:border-cyan/70 focus-visible:shadow-[0_0_0_3px_rgba(0,240,255,0.15)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-magenta aria-invalid:shadow-[0_0_0_3px_rgba(255,0,122,0.20)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
