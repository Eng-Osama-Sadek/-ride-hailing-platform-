/**
 * Dev seed:  npm run seed
 * 5 riders + 5 drivers + 2 admins + pricing + a welcome coupon. Safe to run repeatedly (upserts).
 * ⚠️ للتطوير فقط — لا تشغّله على قاعدة إنتاج.
 */
import { DocumentStatus, DocumentType, PrismaClient, Role, UserStatus, VehicleClass } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CAIRO = { lat: 30.0444, lng: 31.2357 };

const riders = [
  { phone: '+201000000001', name: 'أحمد علي' },
  { phone: '+201000000002', name: 'منى حسن' },
  { phone: '+201000000003', name: 'محمود سمير' },
  { phone: '+201000000004', name: 'سارة إبراهيم' },
  { phone: '+201000000005', name: 'يوسف خالد' },
];

const drivers = [
  { phone: '+201000000101', name: 'كريم محمد', model: 'Hyundai Elantra', year: 2020, plate: 'أ ب ج 1234', color: 'White', cls: VehicleClass.ECONOMY },
  { phone: '+201000000102', name: 'عمرو فتحي', model: 'Kia Cerato', year: 2021, plate: 'د هـ و 2345', color: 'Black', cls: VehicleClass.ECONOMY },
  { phone: '+201000000103', name: 'هاني مصطفى', model: 'Toyota Corolla', year: 2022, plate: 'ز ح ط 3456', color: 'Silver', cls: VehicleClass.COMFORT },
  { phone: '+201000000104', name: 'طارق عادل', model: 'Nissan Sunny', year: 2019, plate: 'ي ك ل 4567', color: 'Grey', cls: VehicleClass.ECONOMY },
  { phone: '+201000000105', name: 'ياسر نبيل', model: 'Mercedes C200', year: 2023, plate: 'م ن س 5678', color: 'Black', cls: VehicleClass.VIP },
];

const documentTypes = Object.values(DocumentType);

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database');
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345!';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // --- Admins -------------------------------------------------------------
  const admins = [
    { phone: '+201000000900', name: 'Super Admin', email: 'admin@ridehailing.local' },
    { phone: '+201000000901', name: 'Support Admin', email: 'support@ridehailing.local' },
  ];
  for (const a of admins) {
    await prisma.user.upsert({
      where: { phone_role: { phone: a.phone, role: Role.ADMIN } },
      update: { passwordHash },
      create: { ...a, role: Role.ADMIN, status: UserStatus.ACTIVE, passwordHash },
    });
  }

  // --- Riders -------------------------------------------------------------
  for (const r of riders) {
    await prisma.user.upsert({
      where: { phone_role: { phone: r.phone, role: Role.RIDER } },
      update: {},
      create: {
        ...r,
        role: Role.RIDER,
        status: UserStatus.ACTIVE,
        riderProfile: {
          create: {
            addresses: [{ label: 'Home', address: 'Nasr City, Cairo', lat: 30.0626, lng: 31.3219 }],
            emergencyContactName: 'Emergency Contact',
            emergencyContactPhone: '+201200000000',
          },
        },
      },
    });
  }

  // --- Drivers (KYC already approved, online around Cairo) -------------------
  for (const [i, d] of drivers.entries()) {
    const user = await prisma.user.upsert({
      where: { phone_role: { phone: d.phone, role: Role.DRIVER } },
      update: {},
      create: {
        phone: d.phone,
        name: d.name,
        role: Role.DRIVER,
        status: UserStatus.ACTIVE,
        driverProfile: {
          create: {
            licenseNumber: `LIC-${100000 + i}`,
            carModel: d.model,
            carYear: d.year,
            carPlate: d.plate,
            carColor: d.color,
            vehicleClass: d.cls,
            documentsStatus: DocumentStatus.APPROVED,
            isOnline: true,
            currentLat: CAIRO.lat + (i - 2) * 0.01,
            currentLng: CAIRO.lng + (i - 2) * 0.01,
            lastLocationAt: new Date(),
          },
        },
      },
    });

    for (const type of documentTypes) {
      await prisma.driverDocument.upsert({
        where: { driverId_type: { driverId: user.id, type } },
        update: {},
        create: {
          driverId: user.id,
          type,
          imageUrl: `seed/${user.id}/${type.toLowerCase()}.jpg`, // placeholder key (no real file)
          status: DocumentStatus.APPROVED,
          verifiedAt: new Date(),
        },
      });
    }
  }

  // --- Pricing (EGP) ----------------------------------------------------------
  const pricing = [
    { vehicleClass: VehicleClass.ECONOMY, baseFare: 15, perKm: 5, perMinute: 0.75, minimumFare: 30, serviceFee: 3, commissionRate: 0.2, cancellationFee: 15 },
    { vehicleClass: VehicleClass.COMFORT, baseFare: 20, perKm: 6.5, perMinute: 1, minimumFare: 40, serviceFee: 4, commissionRate: 0.2, cancellationFee: 20 },
    { vehicleClass: VehicleClass.VIP, baseFare: 30, perKm: 9, perMinute: 1.5, minimumFare: 70, serviceFee: 5, commissionRate: 0.18, cancellationFee: 30 },
  ];
  for (const p of pricing) {
    await prisma.pricingConfig.upsert({ where: { vehicleClass: p.vehicleClass }, update: p, create: p });
  }

  // --- Coupon -------------------------------------------------------------------
  await prisma.coupon.upsert({
    where: { code: 'WELCOME20' },
    update: {},
    create: {
      code: 'WELCOME20',
      description: '20% off your first ride (max 30 EGP)',
      discountType: 'PERCENT',
      value: 20,
      maxDiscount: 30,
      perUserLimit: 1,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✅ Seed complete');
  console.log('   Riders  : +201000000001 … 005   (OTP: MOCK_OTP_CODE, default 123456)');
  console.log('   Drivers : +201000000101 … 105   (OTP: MOCK_OTP_CODE, default 123456)');
  console.log('   Admins  : admin@ridehailing.local / support@ridehailing.local  (password: SEED_ADMIN_PASSWORD)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
