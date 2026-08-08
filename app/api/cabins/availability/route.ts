import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { connectDB, Booking, Cabin } from '@/models';
import type { ApiResponse, AvailableCabin } from '@/types';
import {
  validateRequest,
  validationErrorResponse,
} from '@/lib/validations/utils';

const availabilityQuerySchema = z
  .object({
    checkInDate: z.coerce.date(),
    checkOutDate: z.coerce.date(),
    guests: z.coerce.number().int().min(1).max(50),
  })
  .refine(data => data.checkOutDate > data.checkInDate, {
    message: 'Check-out date must be after check-in date',
    path: ['checkOutDate'],
  });

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();

    const validation = validateRequest(availabilityQuerySchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const {
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guests,
    } = validation.data;

    // Find cabins that can accommodate the guests
    const cabins = await Cabin.find({
      status: 'active',
      capacity: { $gte: guests },
    }).sort({ price: 1 });

    // Fetch all overlapping bookings for these cabins in a single query
    // instead of one query per cabin.
    const overlappingBookings = await Booking.find({
      cabin: { $in: cabins.map(cabin => cabin._id) },
      status: { $nin: ['cancelled'] },
      checkInDate: { $lt: checkOut },
      checkOutDate: { $gt: checkIn },
    })
      .select('cabin')
      .lean();

    const bookedCabinIds = new Set(
      overlappingBookings.map(booking => String(booking.cabin))
    );

    // Note: booking IDs of conflicting reservations are intentionally not
    // returned — this is a public endpoint and those belong to other users.
    const availableCabins: AvailableCabin[] = cabins.map(cabin => ({
      ...cabin.toObject(),
      isAvailable: !bookedCabinIds.has(cabin._id.toString()),
    }));

    const response: ApiResponse<AvailableCabin[]> = {
      success: true,
      data: availableCabins,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error checking availability:', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to check availability',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
