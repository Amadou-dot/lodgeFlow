import { Resend } from 'resend';

import { PaymentConfirmationEmail } from '@/components/EmailTemplates';
import { Booking, connectDB } from '@/models';
import type { PopulatedBooking } from '@/types';
import { auth, currentUser } from '@clerk/nextjs/server';

const resend = new Resend(process.env.RESEND_API_KEY);

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { bookingId, amountPaid, isDeposit } = await request.json();

  try {
    if (!bookingId) {
      return Response.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const booking = (await Booking.findById(bookingId).populate(
      'cabin'
    )) as unknown as PopulatedBooking | null;
    if (!booking) {
      return Response.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.customer !== userId) {
      return Response.json(
        { error: 'Not authorized to send this confirmation' },
        { status: 403 }
      );
    }

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;
    const firstName = user?.firstName || 'Guest';

    if (!email || !validateEmail(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const safeAmountPaid =
      typeof amountPaid === 'number' && amountPaid > 0
        ? amountPaid
        : isDeposit
          ? booking.depositAmount
          : booking.totalPrice;

    const { data, error } = await resend.emails.send({
      from: 'LodgeFlow <onboarding@resend.dev>',
      react: PaymentConfirmationEmail({
        amountPaid: safeAmountPaid,
        bookingData: booking,
        cabinData: booking.cabin,
        firstName,
        isDeposit: isDeposit || false,
      }),
      subject: 'Payment Confirmation - LodgeFlow',
      to: `${email}`,
    });

    if (error) {
      console.error('Email send failed:', error);
      return Response.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error('Email send failed:', error);
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
