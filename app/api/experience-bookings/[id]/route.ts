import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, Experience, ExperienceBooking } from '@/models';
import type { ApiResponse } from '@/types';
import { updateExperienceBookingDetailsSchema } from '@/lib/validations';
import {
  validateRequest,
  validationErrorResponse,
} from '@/lib/validations/utils';

type Params = Promise<{ id: string }>;

export async function GET(
  _request: NextRequest,
  { params }: { params: Params }
) {
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

    const { id } = await params;
    const booking = await ExperienceBooking.findById(id).populate('experience');

    if (!booking) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Experience booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (booking.customer !== userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Experience booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<typeof booking> = {
      success: true,
      data: booking,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching experience booking:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch experience booking',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params }
) {
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

    const { id } = await params;
    const booking = await ExperienceBooking.findById(id);

    if (!booking) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Experience booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (booking.customer !== userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Experience booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (booking.status === 'cancelled' || booking.status === 'completed') {
      const response: ApiResponse<never> = {
        success: false,
        error: `Cannot update a ${booking.status} booking`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    const body = await request.json();

    // Validate request body with Zod
    const validation = validateRequest(
      updateExperienceBookingDetailsSchema,
      body
    );
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const filteredUpdates: Record<string, unknown> = { ...validation.data };

    // Load the experience to re-validate capacity and pricing
    const experience = await Experience.findById(booking.experience);
    if (!experience) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Associated experience not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const effectiveDate = validation.data.date ?? booking.date;
    const effectiveParticipants =
      validation.data.numParticipants ?? booking.numParticipants;

    // Re-check capacity when the date or participant count changes
    if (
      experience.maxParticipants &&
      (validation.data.date || validation.data.numParticipants)
    ) {
      if (effectiveParticipants > experience.maxParticipants) {
        const response: ApiResponse<never> = {
          success: false,
          error: `Maximum ${experience.maxParticipants} participants allowed`,
        };
        return NextResponse.json(response, { status: 400 });
      }

      const dayStart = new Date(effectiveDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(effectiveDate);
      dayEnd.setHours(23, 59, 59, 999);

      const otherBookings = await ExperienceBooking.find({
        _id: { $ne: id },
        experience: booking.experience,
        date: { $gte: dayStart, $lt: dayEnd },
        status: { $nin: ['cancelled'] },
      });

      const totalParticipants = otherBookings.reduce(
        (sum, b) => sum + b.numParticipants,
        0
      );

      if (
        totalParticipants + effectiveParticipants >
        experience.maxParticipants
      ) {
        const remaining = experience.maxParticipants - totalParticipants;
        const response: ApiResponse<never> = {
          success: false,
          error: `Not enough spots available. Only ${Math.max(0, remaining)} spot${remaining !== 1 ? 's' : ''} remaining.`,
        };
        return NextResponse.json(response, { status: 409 });
      }
    }

    // Recalculate totalPrice when the participant count changes
    if (validation.data.numParticipants) {
      filteredUpdates.totalPrice = experience.price * effectiveParticipants;
    }

    const updated = await ExperienceBooking.findByIdAndUpdate(
      id,
      filteredUpdates,
      { new: true, runValidators: true }
    ).populate('experience');

    const response: ApiResponse<typeof updated> = {
      success: true,
      data: updated,
      message: 'Experience booking updated successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating experience booking:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to update experience booking',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Params }
) {
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

    const { id } = await params;
    const booking = await ExperienceBooking.findById(id);

    if (!booking) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Experience booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (booking.customer !== userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Experience booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (booking.status === 'cancelled' || booking.status === 'completed') {
      const response: ApiResponse<never> = {
        success: false,
        error: `Cannot cancel a ${booking.status} booking`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    await ExperienceBooking.findByIdAndUpdate(id, { status: 'cancelled' });

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: 'Experience booking cancelled successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error cancelling experience booking:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to cancel experience booking',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
