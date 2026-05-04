import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, DiningReservation } from '@/models';
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

    const { reservationId } = await request.json();

    if (!reservationId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Reservation ID is required',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const reservation =
      await DiningReservation.findById(reservationId).populate('dining');

    if (!reservation) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Dining reservation not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (reservation.customer !== userId) {
      // 404 not 403 — see CLAUDE.md auth conventions
      const response: ApiResponse<never> = {
        success: false,
        error: 'Dining reservation not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (reservation.isPaid) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Reservation is already paid',
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (
      reservation.status === 'cancelled' ||
      reservation.status === 'no-show'
    ) {
      const response: ApiResponse<never> = {
        success: false,
        error: `Cannot pay for a ${reservation.status} reservation`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (reservation.totalPrice <= 0) {
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
              name: reservation.dining.name,
              description: `Dining reservation for ${reservation.numGuests} guest${reservation.numGuests === 1 ? '' : 's'}`,
            },
            unit_amount: Math.round(reservation.totalPrice * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        diningReservationId: reservation._id.toString(),
        userId,
      },
      payment_intent_data: {
        metadata: {
          diningReservationId: reservation._id.toString(),
          userId,
        },
      },
      mode: 'payment',
      success_url: `${baseUrl}/dining/confirmation/${reservation._id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dining/confirmation/${reservation._id}`,
    });

    await DiningReservation.findByIdAndUpdate(reservationId, {
      stripeSessionId: session.id,
    });

    const response: ApiResponse<{ url: string }> = {
      success: true,
      data: { url: session.url! },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error creating dining checkout session:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to create checkout session',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
