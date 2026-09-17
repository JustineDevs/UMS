import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "../../lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer data-[state=checked]:bg-oklch(0.205 0 0) data-[state=unchecked]:bg-oklch(0.922 0 0) focus-visible:border-oklch(0.708 0 0) focus-visible:ring-oklch(0.708 0 0)/50 dark:data-[state=unchecked]:bg-oklch(0.922 0 0)/80 group/switch inline-flex shrink-0 items-center rounded-full border border-oklch(0.922 0 0) border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6 dark:data-[state=checked]:bg-oklch(0.922 0 0) dark:data-[state=unchecked]:bg-oklch(1 0 0 / 15%) dark:focus-visible:border-oklch(0.556 0 0) dark:focus-visible:ring-oklch(0.556 0 0)/50 dark:dark:data-[state=unchecked]:bg-oklch(1 0 0 / 15%)/80 dark:border-oklch(1 0 0 / 10%)",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-oklch(1 0 0) dark:data-[state=unchecked]:bg-oklch(0.145 0 0) dark:data-[state=checked]:bg-oklch(0.985 0 0) pointer-events-none block rounded-full ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 dark:bg-oklch(0.145 0 0) dark:dark:data-[state=unchecked]:bg-oklch(0.985 0 0) dark:dark:data-[state=checked]:bg-oklch(0.205 0 0)"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
