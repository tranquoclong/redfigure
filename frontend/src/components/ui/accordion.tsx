"use client"

import * as React from "react"
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Accordion({ ...props }: AccordionPrimitive.Root.Props) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({
  className,
  ...props
}: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn(
        "border-b border-white/10 last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group flex flex-1 items-center justify-between gap-4 py-5 text-left text-base font-semibold text-white transition-colors",
          "[font-family:var(--font-inter)]",
          "hover:text-cyan focus-visible:outline-none focus-visible:text-cyan",
          "data-[panel-open]:text-cyan",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon
          aria-hidden
          className="size-5 shrink-0 text-magenta transition-transform duration-200 group-data-[panel-open]:rotate-180"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionPanel({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-panel"
      className={cn(
        "overflow-hidden text-white/80 text-sm leading-relaxed",
        "data-[starting-style]:h-0 data-[ending-style]:h-0",
        "h-[var(--accordion-panel-height)] transition-[height] duration-200 ease-out",
        className
      )}
      {...props}
    >
      <div className="pb-5 pr-8">{children}</div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionPanel }
