'use client';

import { Button } from '@heroui/button';
import { addToast } from '@heroui/toast';
import { CreditCard } from 'lucide-react';

import {
  useCreateCheckoutSession,
  useCreateDiningCheckoutSession,
  useCreateExperienceCheckoutSession,
} from '@/hooks/usePayment';

type ResourceType = 'cabin' | 'dining' | 'experience';

interface PaymentButtonProps {
  resourceId: string;
  amount: number;
  resourceType?: ResourceType;
  isDeposit?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function PaymentButton({
  resourceId,
  amount,
  resourceType = 'cabin',
  isDeposit = false,
  size = 'md',
  className,
}: PaymentButtonProps) {
  const cabinCheckout = useCreateCheckoutSession();
  const diningCheckout = useCreateDiningCheckoutSession();
  const experienceCheckout = useCreateExperienceCheckoutSession();

  const mutation =
    resourceType === 'dining'
      ? diningCheckout
      : resourceType === 'experience'
        ? experienceCheckout
        : cabinCheckout;

  const handlePayment = async () => {
    try {
      const { url } = await mutation.mutateAsync(resourceId);
      window.location.href = url;
    } catch (error) {
      addToast({
        title: 'Payment Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to initiate payment. Please try again.',
        color: 'danger',
      });
    }
  };

  return (
    <Button
      className={className}
      color='success'
      isLoading={mutation.isPending}
      size={size}
      startContent={!mutation.isPending && <CreditCard className='w-4 h-4' />}
      onPress={handlePayment}
    >
      {isDeposit ? `Pay Deposit ($${amount})` : `Pay Now ($${amount})`}
    </Button>
  );
}
