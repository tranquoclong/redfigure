import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheckoutStepper, CHECKOUT_STEPS } from "./checkout-stepper";

describe("CheckoutStepper", () => {
  it("exposes the 4 steps of the flow in the correct order", () => {
    expect(CHECKOUT_STEPS).toEqual([
      { id: 1, label: "Cart" },
      { id: 2, label: "Sign in" },
      { id: 3, label: "Checkout" },
      { id: 4, label: "Confirmation" },
    ]);
  });

  it("renders the 4 labels", () => {
    render(<CheckoutStepper currentStep={1} />);
    expect(screen.getByText("Cart")).toBeInTheDocument();
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.getByText("Checkout")).toBeInTheDocument();
    expect(screen.getByText("Confirmation")).toBeInTheDocument();
  });

  it("marks step 1 as current when currentStep=1", () => {
    const { container } = render(<CheckoutStepper currentStep={1} />);
    const buttons = container.querySelectorAll("[data-step]");
    expect(buttons[0].getAttribute("data-state")).toBe("current");
    expect(buttons[1].getAttribute("data-state")).toBe("upcoming");
    expect(buttons[2].getAttribute("data-state")).toBe("upcoming");
    expect(buttons[3].getAttribute("data-state")).toBe("upcoming");
  });

  it("marks previous steps as done when currentStep=2", () => {
    const { container } = render(<CheckoutStepper currentStep={2} />);
    const buttons = container.querySelectorAll("[data-step]");
    expect(buttons[0].getAttribute("data-state")).toBe("done");
    expect(buttons[1].getAttribute("data-state")).toBe("current");
    expect(buttons[2].getAttribute("data-state")).toBe("upcoming");
    expect(buttons[3].getAttribute("data-state")).toBe("upcoming");
  });

  it("marks Cart+Sign in as done when currentStep=3", () => {
    const { container } = render(<CheckoutStepper currentStep={3} />);
    const buttons = container.querySelectorAll("[data-step]");
    expect(buttons[0].getAttribute("data-state")).toBe("done");
    expect(buttons[1].getAttribute("data-state")).toBe("done");
    expect(buttons[2].getAttribute("data-state")).toBe("current");
    expect(buttons[3].getAttribute("data-state")).toBe("upcoming");
  });

  it("marks all previous steps as done when currentStep=4", () => {
    const { container } = render(<CheckoutStepper currentStep={4} />);
    const buttons = container.querySelectorAll("[data-step]");
    expect(buttons[0].getAttribute("data-state")).toBe("done");
    expect(buttons[1].getAttribute("data-state")).toBe("done");
    expect(buttons[2].getAttribute("data-state")).toBe("done");
    expect(buttons[3].getAttribute("data-state")).toBe("current");
  });

  it("accepts currentStep=3 for the QR screen (Method 1 of the plan)", () => {
    const { container } = render(<CheckoutStepper currentStep={3} />);
    const buttons = container.querySelectorAll("[data-step]");
    expect(buttons[2].getAttribute("data-state")).toBe("current");
  });
});
