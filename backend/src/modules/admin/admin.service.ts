import { Injectable } from '@nestjs/common';
import { Role, RideStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [riders, activeDrivers, ridesToday, completedRevenue, recentRides] = await Promise.all([
      this.prisma.user.count({ where: { role: Role.RIDER } }),
      this.prisma.user.count({
        where: { role: Role.DRIVER, driverProfile: { isOnline: true } },
      }),
      this.prisma.ride.count({ where: { createdAt: { gte: today } } }),
      this.prisma.ride.aggregate({
        where: { status: RideStatus.COMPLETED, createdAt: { gte: today } },
        _sum: { finalFare: true },
      }),
      this.prisma.ride.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        select: { createdAt: true },
      }),
    ]);

    const ridesPerDay = new Map<string, number>();
    for (const ride of recentRides) {
      const day = ride.createdAt.toISOString().slice(0, 10);
      ridesPerDay.set(day, (ridesPerDay.get(day) ?? 0) + 1);
    }

    return {
      totalRiders: riders,
      activeDrivers,
      ridesToday,
      revenueToday: Number(completedRevenue._sum.finalFare ?? 0),
      ridesByDay: [...ridesPerDay.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([day, total]) => ({ day, total })),
    };
  }

  async users(role?: Role) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  }

  async rides() {
    const rides = await this.prisma.ride.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        rider: { select: { name: true, phone: true } },
        driver: { select: { name: true, phone: true } },
      },
    });
    return rides.map((ride) => ({
      id: ride.id,
      status: ride.status,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      fare: Number(ride.finalFare ?? ride.estimatedFare),
      createdAt: ride.createdAt,
      rider: ride.rider,
      driver: ride.driver,
    }));
  }

  async payments() {
    const transactions = await this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { name: true, phone: true } } },
    });
    return transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: Number(transaction.amount),
      method: transaction.method,
      reference: transaction.reference,
      createdAt: transaction.createdAt,
      user: transaction.user,
    }));
  }
}
