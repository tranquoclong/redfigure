import { cn } from "@/lib/utils";

export interface CheckoutStep {
  id: 1 | 2 | 3 | 4;
  label: string;
}

export const CHECKOUT_STEPS: ReadonlyArray<CheckoutStep> = [
  { id: 1, label: "Giỏ hàng" },
  { id: 2, label: "Xác định thông tin" },
  { id: 3, label: "Thanh toán" },
  { id: 4, label: "Xác nhận" },
];

export type StepState = "done" | "current" | "upcoming";

interface CheckoutStepperProps {
  currentStep: 1 | 2 | 3 | 4;
  className?: string;
}

export function CheckoutStepper({
  currentStep,
  className,
}: CheckoutStepperProps) {
  return (
    <div className={cn("flex flex-nowrap items-center gap-3", className)}>
      {CHECKOUT_STEPS.map((step, idx) => {
        const state: StepState =
          step.id < currentStep
            ? "done"
            : step.id === currentStep
              ? "current"
              : "upcoming";
        const isLast = idx === CHECKOUT_STEPS.length - 1;

        const lineActive = state !== "upcoming";

        return (
          <div
            key={step.id}
            data-step={step.id}
            data-state={state}
            className="flex flex-shrink-0 items-center gap-3"
          >
            <div className="flex flex-shrink-0 items-center gap-2">
              <span
                className={cn(
                  "grid size-[26px] place-items-center rounded-full text-[11px] font-bold transition-all duration-[var(--dur-base)]",
                  state === "current" &&
                    "text-white [box-shadow:var(--glow-purple-sm)]",
                  state === "done" &&
                    "border border-cyan/55 bg-cyan/10 text-cyan",
                  state === "upcoming" &&
                    "border border-white/10 text-white/55",
                )}
                style={
                  state === "current"
                    ? { background: "var(--grad-cta)" }
                    : undefined
                }
              >
                {state === "done" ? "✓" : step.id}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[16px] uppercase tracking-[0.08em]",
                  state === "current" && "text-white",
                  state === "done" && "text-cyan",
                  state === "upcoming" && "text-white/55",
                  state !== "current" && "max-[1100px]:hidden",
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "h-px min-w-4 max-w-20 flex-1 transition-colors duration-[var(--dur-base)]",
                  lineActive ? "" : "bg-white/10",
                )}
                style={
                  lineActive ? { background: "var(--grad-rule)" } : undefined
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
