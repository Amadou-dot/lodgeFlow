import { renderHook } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';

import {
  useCreateDiningCheckoutSession,
  useCreateExperienceCheckoutSession,
} from '@/hooks/usePayment';
import { createTestQueryClient } from '@/__tests__/shared/test-utils';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('useCreateDiningCheckoutSession', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('posts to the dining checkout endpoint and returns the session url', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { url: 'https://checkout.stripe.com/dining-session' },
        success: true,
      }),
    });

    const { result } = renderHook(() => useCreateDiningCheckoutSession(), {
      wrapper,
    });

    const data = await result.current.mutateAsync('reservation-1');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/payments/create-dining-checkout',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: 'reservation-1' }),
      }
    );
    expect(data).toEqual({ url: 'https://checkout.stripe.com/dining-session' });
  });

  it('throws the server-provided error message on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Reservation is already paid' }),
    });

    const { result } = renderHook(() => useCreateDiningCheckoutSession(), {
      wrapper,
    });

    await expect(result.current.mutateAsync('reservation-1')).rejects.toThrow(
      'Reservation is already paid'
    );
  });
});

describe('useCreateExperienceCheckoutSession', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('posts to the experience checkout endpoint and returns the session url', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { url: 'https://checkout.stripe.com/experience-session' },
        success: true,
      }),
    });

    const { result } = renderHook(() => useCreateExperienceCheckoutSession(), {
      wrapper,
    });

    const data = await result.current.mutateAsync('booking-1');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/payments/create-experience-checkout',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: 'booking-1' }),
      }
    );
    expect(data).toEqual({
      url: 'https://checkout.stripe.com/experience-session',
    });
  });

  it('throws the server-provided error message on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Booking is already paid' }),
    });

    const { result } = renderHook(() => useCreateExperienceCheckoutSession(), {
      wrapper,
    });

    await expect(result.current.mutateAsync('booking-1')).rejects.toThrow(
      'Booking is already paid'
    );
  });
});
