import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FreeShippingPromise } from './free-shipping-promise';

describe('FreeShippingPromise', () => {
  it('locked: shows how much is missing + "Add more" message', () => {
    render(
      <FreeShippingPromise
        subtotal={50}
        minOrderValue={100}
        remaining={50}
        eligible={false}
      />,
    );
    expect(screen.getByText(/Add more/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 50,00/)).toBeInTheDocument();

    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('unlocked: celebration message', () => {
    render(
      <FreeShippingPromise
        subtotal={150}
        minOrderValue={100}
        remaining={0}
        eligible
      />,
    );
    expect(
      screen.getByText(/You've earned FREE SHIPPING/i),
    ).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('does not render when minOrderValue=0 (free shipping off)', () => {
    const { container } = render(
      <FreeShippingPromise
        subtotal={50}
        minOrderValue={0}
        remaining={0}
        eligible={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('caps percentage at 100 when subtotal > minOrderValue', () => {
    render(
      <FreeShippingPromise
        subtotal={500}
        minOrderValue={100}
        remaining={0}
        eligible
      />,
    );
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
