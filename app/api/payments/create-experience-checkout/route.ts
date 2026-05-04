import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, ExperienceBooking } from '@/models';
import { getStripe } from '@/lib/stripe';
import type { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Authentication required',
      };
      return NextResponse.json(response, { status: 401 });
    }

    await connectDB();

    const { bookingId } = await request.json();

    if (!bookingId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Booking ID is required',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const booking =
      await ExperienceBooking.findById(bookingId).populate('experience');

    if (!booking) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Experience booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (booking.customer !== userId) {
      // 404 not 403 — see CLAUDE.md auth conventions
      const response: ApiResponse<never> = {
        success: false,
        error: 'Experience booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (booking.isPaid) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Booking is already paid',
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (booking.status === 'cancelled') {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Cannot pay for a cancelled booking',
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (booking.totalPrice <= 0) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Payment amount must be greater than zero',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: booking.experience.name,
              description: `Experience booking for ${booking.numParticipants} participant${booking.numParticipants === 1 ? '' : 's'}`,
            },
            unit_amount: Math.round(booking.totalPrice * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        experienceBookingId: booking._id.toString(),
        userId,
      },
      payment_intent_data: {
        metadata: {
          experienceBookingId: booking._id.toString(),
          userId,
        },
      },
      mode: 'payment',
      success_url: `${baseUrl}/experiences/confirmation/${booking._id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/experiences/confirmation/${booking._id}`,
    });

    await ExperienceBooking.findByIdAndUpdate(bookingId, {
      stripeSessionId: session.id,
    });

    const response: ApiResponse<{ url: string }> = {
      success: true,
      data: { url: session.url! },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error creating experience checkout session:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to create checkout session',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
