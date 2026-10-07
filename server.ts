import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const DB_FILE_PATH = path.resolve(process.cwd(), 'database', 'runtime-db.json');
const LATE_PENALTY_PER_HOUR = 300;

interface DbUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: 'USER' | 'ADMIN';
  avatarInitials: string;
  city: string;
  rating: number;
  createdAt: string;
}

interface DbToken {
  tokenHash: string;
  userId: string;
  expiresAt: string;
}

interface DbVehicle {
  id: string;
  ownerId: string;
  type: 'Car' | 'SUV' | 'Bike' | 'Van';
  brand: string;
  model: string;
  registrationNumber: string;
  location: string;
  hourlyRate: number;
  dailyRate: number;
  availableFrom: string;
  availableUntil: string;
  status: 'AVAILABLE' | 'DISABLED' | 'MAINTENANCE';
  securityDeposit: number;
  description: string;
  features: string[];
  rules: string[];
  cancellationPolicy: string;
  images: string[];
  transmission: 'Automatic' | 'Manual';
  fuelType: 'Petrol' | 'Diesel' | 'Electric' | 'Hybrid';
  seats: number;
  createdAt: string;
}

interface DbBooking {
  id: string;
  vehicleId: string;
  renterId: string;
  ownerId: string;
  pickupDateTime: string;
  returnDateTime: string;
  actualReturnDateTime: string | null;
  durationHours: number;
  hourlyRate: number;
  rentalAmount: number;
  securityDeposit: number;
  lateHours: number;
  latePenalty: number;
  conditionOnReturn: 'No Damage' | 'Minor Damage' | 'Major Damage' | null;
  damageDescription: string | null;
  damageEvidence: string[];
  estimatedRepairCost: number;
  damageAmount: number;
  damageReviewStatus: 'NONE' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESOLVED';
  damageAdminNotes: string | null;
  status: 'UPCOMING' | 'ACTIVE' | 'OVERDUE' | 'RETURNED' | 'RETURNED_LATE' | 'CANCELLED';
  remindersSent: number;
  lastReminderAt: string | null;
  createdAt: string;
}

interface DbIncident {
  id: string;
  bookingId: string;
  vehicleId: string;
  reportedBy: string;
  reporterRole: 'OWNER' | 'RENTER' | 'ADMIN';
  type: 'Vehicle Not Returned' | 'Suspected Theft' | 'Vehicle Damage' | 'Accident' | 'Other';
  priority: 'STANDARD' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence: string[];
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED';
  adminRemarks: string;
  estimatedDamageCost: number | null;
  approvedDamageAmount: number;
  damageStatus: 'NONE' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESOLVED' | null;
  createdAt: string;
  updatedAt: string;
}

interface DbNotification {
  id: string;
  userId: string;
  targetScope: 'USER' | 'ADMIN' | 'ALL';
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  read: boolean;
  link: string | null;
  createdAt: string;
}

interface RuntimeDatabase {
  schemaVersion: number;
  users: DbUser[];
  tokens: DbToken[];
  vehicles: DbVehicle[];
  bookings: DbBooking[];
  incidents: DbIncident[];
  notifications: DbNotification[];
}

const CURRENT_SCHEMA_VERSION = 2;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const [, salt, originalHex] = parts;
    const derivedHex = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(
      Buffer.from(originalHex, 'hex'),
      Buffer.from(derivedHex, 'hex')
    );
  }
  return false;
}

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.map((p) => p[0].toUpperCase()).join('');
  return (initials || 'U').slice(0, 2);
}

/**
 * Matches `database/schema.sql` seed data 100%.
 */
function createInitialSeedDatabase(): RuntimeDatabase {
  const now = Date.now();
  const isoHours = (h: number) => new Date(now + h * 3600 * 1000).toISOString();
  const isoDays = (d: number) => new Date(now + d * 86400 * 1000).toISOString();

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    users: [
      {
        id: 'usr-1',
        name: 'Arjun Mehta',
        email: 'arjun.mehta@example.in',
        phone: '+91 98201 54321',
        passwordHash: hashPassword('password'),
        role: 'USER',
        avatarInitials: 'AM',
        city: 'Bengaluru',
        rating: 4.9,
        createdAt: isoDays(-140),
      },
      {
        id: 'usr-2',
        name: 'Priya Nair',
        email: 'priya.nair@example.in',
        phone: '+91 98450 11223',
        passwordHash: hashPassword('password'),
        role: 'USER',
        avatarInitials: 'PN',
        city: 'Bengaluru',
        rating: 4.8,
        createdAt: isoDays(-210),
      },
      {
        id: 'usr-3',
        name: 'Rohan Deshmukh',
        email: 'rohan.deshmukh@example.in',
        phone: '+91 97654 32109',
        passwordHash: hashPassword('password'),
        role: 'USER',
        avatarInitials: 'RD',
        city: 'Mumbai',
        rating: 4.6,
        createdAt: isoDays(-95),
      },
      {
        id: 'usr-admin',
        name: 'Vikramaditya Rao',
        email: 'admin@velorent.in',
        phone: '+91 80412 90000',
        passwordHash: hashPassword('password'),
        role: 'ADMIN',
        avatarInitials: 'VR',
        city: 'Bengaluru',
        rating: 5.0,
        createdAt: isoDays(-365),
      },
    ],
    tokens: [],
    vehicles: [
      {
        id: 'veh-1',
        ownerId: 'usr-2',
        type: 'SUV',
        brand: 'Mahindra',
        model: 'XUV700 AX7 Luxury',
        registrationNumber: 'KA-01-MJ-4821',
        location: 'Bengaluru — Indiranagar',
        hourlyRate: 320,
        dailyRate: 6800,
        availableFrom: isoDays(-15),
        availableUntil: isoDays(90),
        status: 'AVAILABLE',
        securityDeposit: 6000,
        description:
          'Top-spec Mahindra XUV700 AX7 Luxury Pack with panoramic Skyroof, ADAS Level 2, Sony 12-speaker 3D audio, and wireless Apple CarPlay. Meticulously maintained for highway and city comfort.',
        features: [
          'Panoramic Sunroof',
          'ADAS Level 2',
          '360° Surround Camera',
          'Wireless CarPlay',
          '7 Seater Captain Config',
          'FASTag Enabled',
        ],
        rules: [
          'Valid Indian Driving Licence (LMV) mandatory at pickup.',
          'Fuel policy: Return at same fuel level as pickup.',
          'Strictly no smoking or off-road trail abuse.',
        ],
        cancellationPolicy:
          '100% full refund of rental & deposit if cancelled before scheduled pickup time.',
        images: ['/assets/suv', '/assets/hero'],
        transmission: 'Automatic',
        fuelType: 'Diesel',
        seats: 7,
        createdAt: isoDays(-60),
      },
      {
        id: 'veh-2',
        ownerId: 'usr-1',
        type: 'SUV',
        brand: 'Hyundai',
        model: 'Creta SX(O) Turbo',
        registrationNumber: 'KA-03-NB-9104',
        location: 'Bengaluru — Koramangala',
        hourlyRate: 260,
        dailyRate: 5400,
        availableFrom: isoDays(-15),
        availableUntil: isoDays(90),
        status: 'AVAILABLE',
        securityDeposit: 5000,
        description:
          'Refined 7-speed DCT Turbo Petrol Hyundai Creta with ventilated front seats, Bose 8-speaker sound system, and dual-zone automatic climate control.',
        features: [
          'Ventilated Front Seats',
          'Bose Premium Audio',
          'Panoramic Sunroof',
          'Paddle Shifters',
          'Air Purifier',
        ],
        rules: [
          'Return with same fuel level.',
          'Late returns incur ₹300/hour penalty beyond scheduled drop time.',
        ],
        cancellationPolicy: 'Free cancellation anytime prior to rental pickup window.',
        images: ['/assets/suv', '/assets/car'],
        transmission: 'Automatic',
        fuelType: 'Petrol',
        seats: 5,
        createdAt: isoDays(-45),
      },
      {
        id: 'veh-3',
        ownerId: 'usr-2',
        type: 'Van',
        brand: 'Toyota',
        model: 'Innova Hycross ZX(O)',
        registrationNumber: 'KA-05-HT-2290',
        location: 'Bengaluru — HSR Layout',
        hourlyRate: 350,
        dailyRate: 7500,
        availableFrom: isoDays(-15),
        availableUntil: isoDays(90),
        status: 'AVAILABLE',
        securityDeposit: 7000,
        description:
          'Strong Hybrid self-charging Toyota Innova Hycross with powered Ottoman second-row captain seats, exceptional 21 km/l fuel efficiency, and whisper-quiet cabin.',
        features: [
          'Powered Ottoman Seats',
          'Strong Hybrid (21 km/l)',
          'Toyota Safety Sense',
          'Dual Zone AC',
          'Rear Sunshades',
        ],
        rules: [
          'No commercial goods transport.',
          'Standard ₹300/hr late return fee applies.',
        ],
        cancellationPolicy: 'Free cancellation before scheduled pickup time.',
        images: ['/assets/van', '/assets/hero'],
        transmission: 'Automatic',
        fuelType: 'Hybrid',
        seats: 7,
        createdAt: isoDays(-50),
      },
      {
        id: 'veh-4',
        ownerId: 'usr-3',
        type: 'SUV',
        brand: 'Tata',
        model: 'Nexon EV Empowered+',
        registrationNumber: 'MH-02-FE-7732',
        location: 'Mumbai — Bandra West',
        hourlyRate: 220,
        dailyRate: 4600,
        availableFrom: isoDays(-15),
        availableUntil: isoDays(90),
        status: 'AVAILABLE',
        securityDeposit: 4500,
        description:
          'Long-range 40.5 kWh Tata Nexon EV with 315 km real-world city range, Arcade.ev 12.3-inch cinematic screen, and zero tailpipe emissions.',
        features: [
          '315 km Real Range',
          'Fast CCS2 Charging',
          '360° Camera',
          'Regenerative Braking',
          'JBL Sound Modes',
        ],
        rules: ['Return with at least 25% battery charge.'],
        cancellationPolicy: 'Full refund if cancelled before rental start time.',
        images: ['/assets/suv', '/assets/car'],
        transmission: 'Automatic',
        fuelType: 'Electric',
        seats: 5,
        createdAt: isoDays(-40),
      },
      {
        id: 'veh-5',
        ownerId: 'usr-2',
        type: 'Car',
        brand: 'Honda',
        model: 'City ZX i-VTEC CVT',
        registrationNumber: 'KA-01-AB-6120',
        location: 'Bengaluru — Whitefield',
        hourlyRate: 200,
        dailyRate: 4200,
        availableFrom: isoDays(-15),
        availableUntil: isoDays(90),
        status: 'AVAILABLE',
        securityDeposit: 4000,
        description:
          'Executive pearl white Honda City ZX sedan with plush leather upholstery, Honda Sensing lane-watch camera, and effortless CVT city drivability.',
        features: [
          'LaneWatch Camera',
          'Leather Upholstery',
          'Electric Sunroof',
          '8-Speaker Surround',
          '506L Boot Space',
        ],
        rules: ['Unleaded petrol only.'],
        cancellationPolicy: 'Full refund prior to scheduled pickup.',
        images: ['/assets/car', '/assets/hero'],
        transmission: 'Automatic',
        fuelType: 'Petrol',
        seats: 5,
        createdAt: isoDays(-35),
      },
      {
        id: 'veh-6',
        ownerId: 'usr-1',
        type: 'Car',
        brand: 'Maruti',
        model: 'Baleno Alpha AGS',
        registrationNumber: 'KA-04-MP-3319',
        location: 'Bengaluru — Indiranagar',
        hourlyRate: 150,
        dailyRate: 3200,
        availableFrom: isoDays(-15),
        availableUntil: isoDays(90),
        status: 'AVAILABLE',
        securityDeposit: 3000,
        description:
          'Agile, fuel-efficient premium hatchback with Head-Up Display (HUD), 360-view camera, and SmartPlay Pro+ 9-inch infotainment.',
        features: [
          'Head-Up Display',
          '360° View Camera',
          '22 km/l Mileage',
          'Auto Climate Control',
          'UV Cut Glass',
        ],
        rules: ['Return on time to avoid ₹300/hr late penalty.'],
        cancellationPolicy: 'Free cancellation before pickup.',
        images: ['/assets/car'],
        transmission: 'Automatic',
        fuelType: 'Petrol',
        seats: 5,
        createdAt: isoDays(-30),
      },
      {
        id: 'veh-7',
        ownerId: 'usr-3',
        type: 'Bike',
        brand: 'Royal Enfield',
        model: 'Classic 350 Stealth Black',
        registrationNumber: 'MH-12-QW-8840',
        location: 'Pune — Koregaon Park',
        hourlyRate: 90,
        dailyRate: 1800,
        availableFrom: isoDays(-15),
        availableUntil: isoDays(90),
        status: 'AVAILABLE',
        securityDeposit: 2000,
        description:
          'J-series Royal Enfield Classic 350 in Matte Stealth Black with dual-channel ABS, Tripper navigation pod, and alloy tubeless wheels. Two BIS-certified helmets included.',
        features: [
          'Dual-Channel ABS',
          '2 Helmets Included',
          'Tripper Navigation',
          'USB Charging Port',
          'Tubeless Alloys',
        ],
        rules: ['Valid MCWG two-wheeler licence mandatory.'],
        cancellationPolicy: 'Free cancellation before pickup.',
        images: ['/assets/bike'],
        transmission: 'Manual',
        fuelType: 'Petrol',
        seats: 2,
        createdAt: isoDays(-28),
      },
      {
        id: 'veh-8',
        ownerId: 'usr-1',
        type: 'Bike',
        brand: 'Honda',
        model: 'CB350RS Hue Edition',
        registrationNumber: 'KA-01-EK-5502',
        location: 'Bengaluru — Jayanagar',
        hourlyRate: 85,
        dailyRate: 1700,
        availableFrom: isoDays(-15),
        availableUntil: isoDays(90),
        status: 'AVAILABLE',
        securityDeposit: 2000,
        description:
          'Smooth neo-retro Honda CB350RS with assist & slipper clutch, Honda Selectable Torque Control (traction control), and crisp exhaust note.',
        features: [
          'Slipper Clutch',
          'Traction Control',
          'All-LED Lighting',
          'Helmet Provided',
          'Phone Mount',
        ],
        rules: ['Valid two-wheeler licence required.'],
        cancellationPolicy: 'Free cancellation prior to scheduled start.',
        images: ['/assets/bike'],
        transmission: 'Manual',
        fuelType: 'Petrol',
        seats: 2,
        createdAt: isoDays(-25),
      },
      {
        id: 'veh-9',
        ownerId: 'usr-3',
        type: 'SUV',
        brand: 'Toyota',
        model: 'Fortuner Legender 4x4 AT',
        registrationNumber: 'DL-01-CA-9901',
        location: 'Delhi — Connaught Place',
        hourlyRate: 450,
        dailyRate: 9500,
        availableFrom: isoDays(-15),
        availableUntil: isoDays(90),
        status: 'AVAILABLE',
        securityDeposit: 10000,
        description:
          'Flagship Toyota Fortuner Legender 2.8L 4x4 Automatic with dual-tone Pearl White & Matte Black roof, quad-LED headlamps, and commanding road presence.',
        features: [
          '4x4 Drivetrain',
          'JBL 11-Speaker Audio',
          'Ventilated Seats',
          'Kick-Sensor Tailgate',
          'Wireless Charger',
        ],
        rules: ['Minimum renter age 24 years with 3+ years driving experience.'],
        cancellationPolicy: 'Full refund if cancelled before pickup.',
        images: ['/assets/suv', '/assets/hero'],
        transmission: 'Automatic',
        fuelType: 'Diesel',
        seats: 7,
        createdAt: isoDays(-22),
      },
      {
        id: 'veh-10',
        ownerId: 'usr-2',
        type: 'Car',
        brand: 'Toyota',
        model: 'Glanza V AMT',
        registrationNumber: 'KA-02-MN-1184',
        location: 'Bengaluru — Malleshwaram',
        hourlyRate: 160,
        dailyRate: 3400,
        availableFrom: isoDays(-15),
        availableUntil: isoDays(90),
        status: 'AVAILABLE',
        securityDeposit: 3000,
        description:
          'Easy-to-park Toyota Glanza V top variant with 6 airbags, 360-degree camera, and Toyota reliability for effortless city errands.',
        features: [
          '6 Airbags',
          '360° Camera',
          'Apple CarPlay & Android Auto',
          'Cruise Control',
          'FASTag Active',
        ],
        rules: ['No smoking inside cabin.'],
        cancellationPolicy: 'Free cancellation prior to pickup.',
        images: ['/assets/car'],
        transmission: 'Automatic',
        fuelType: 'Petrol',
        seats: 5,
        createdAt: isoDays(-20),
      },
      {
        id: 'veh-11',
        ownerId: 'usr-3',
        type: 'Van',
        brand: 'Maruti',
        model: 'Ertiga ZXI+ Smart Hybrid',
        registrationNumber: 'MH-01-DE-4410',
        location: 'Mumbai — Powai',
        hourlyRate: 230,
        dailyRate: 4800,
        availableFrom: isoDays(-15),
        availableUntil: isoDays(90),
        status: 'AVAILABLE',
        securityDeposit: 4500,
        description:
          'Practical 7-seater MPV with roof-mounted rear AC vents, reclining third-row seats, and smooth 6-speed torque converter automatic transmission.',
        features: [
          '7-Seater Family MPV',
          'Roof Rear AC Vents',
          'Cooled Cup Holders',
          'Cruise Control',
          'Luggage Carrier Ready',
        ],
        rules: ['Max 7 occupants including driver.'],
        cancellationPolicy: 'Free cancellation before pickup time.',
        images: ['/assets/van'],
        transmission: 'Automatic',
        fuelType: 'Petrol',
        seats: 7,
        createdAt: isoDays(-18),
      },
      {
        id: 'veh-12',
        ownerId: 'usr-2',
        type: 'Car',
        brand: 'Hyundai',
        model: 'Verna SX(O) 1.5 Turbo',
        registrationNumber: 'TS-09-UB-6021',
        location: 'Hyderabad — Jubilee Hills',
        hourlyRate: 240,
        dailyRate: 5100,
        availableFrom: isoDays(-15),
        availableUntil: isoDays(90),
        status: 'AVAILABLE',
        securityDeposit: 4500,
        description:
          'Horizon LED positioning lamp sedan with 160 PS 1.5L Turbo GDi engine, heated and ventilated seats, and 5-star Global NCAP safety rating.',
        features: [
          '160 PS Turbo Engine',
          '5-Star Safety Rating',
          'Heated & Ventilated Seats',
          'Bose 8-Speaker Audio',
          'Smart Trunk',
        ],
        rules: ['Valid LMV licence required.'],
        cancellationPolicy: 'Free cancellation prior to pickup.',
        images: ['/assets/car', '/assets/hero'],
        transmission: 'Automatic',
        fuelType: 'Petrol',
        seats: 5,
        createdAt: isoDays(-14),
      },
    ],
    bookings: [
      {
        id: 'BK-849201',
        vehicleId: 'veh-3',
        renterId: 'usr-1',
        ownerId: 'usr-2',
        pickupDateTime: isoHours(-4),
        returnDateTime: isoHours(8),
        actualReturnDateTime: null,
        durationHours: 12,
        hourlyRate: 350,
        rentalAmount: 4200,
        securityDeposit: 7000,
        lateHours: 0,
        latePenalty: 0,
        conditionOnReturn: null,
        damageDescription: null,
        damageEvidence: [],
        estimatedRepairCost: 0,
        damageAmount: 0,
        damageReviewStatus: 'NONE',
        damageAdminNotes: null,
        status: 'ACTIVE',
        remindersSent: 0,
        lastReminderAt: null,
        createdAt: isoDays(-1),
      },
      {
        id: 'BK-849202',
        vehicleId: 'veh-1',
        renterId: 'usr-1',
        ownerId: 'usr-2',
        pickupDateTime: isoHours(24),
        returnDateTime: isoHours(32),
        actualReturnDateTime: null,
        durationHours: 8,
        hourlyRate: 320,
        rentalAmount: 2560,
        securityDeposit: 6000,
        lateHours: 0,
        latePenalty: 0,
        conditionOnReturn: null,
        damageDescription: null,
        damageEvidence: [],
        estimatedRepairCost: 0,
        damageAmount: 0,
        damageReviewStatus: 'NONE',
        damageAdminNotes: null,
        status: 'UPCOMING',
        remindersSent: 0,
        lastReminderAt: null,
        createdAt: isoHours(-6),
      },
      {
        id: 'BK-849203',
        vehicleId: 'veh-2',
        renterId: 'usr-3',
        ownerId: 'usr-1',
        pickupDateTime: isoHours(-16),
        returnDateTime: isoHours(-6),
        actualReturnDateTime: null,
        durationHours: 10,
        hourlyRate: 260,
        rentalAmount: 2600,
        securityDeposit: 5000,
        lateHours: 6,
        latePenalty: 1800,
        conditionOnReturn: null,
        damageDescription: null,
        damageEvidence: [],
        estimatedRepairCost: 0,
        damageAmount: 0,
        damageReviewStatus: 'NONE',
        damageAdminNotes: null,
        status: 'OVERDUE',
        remindersSent: 1,
        lastReminderAt: isoHours(-2),
        createdAt: isoDays(-2),
      },
      {
        id: 'BK-849204',
        vehicleId: 'veh-7',
        renterId: 'usr-1',
        ownerId: 'usr-3',
        pickupDateTime: isoHours(-12),
        returnDateTime: isoHours(-4),
        actualReturnDateTime: null,
        durationHours: 8,
        hourlyRate: 90,
        rentalAmount: 720,
        securityDeposit: 2000,
        lateHours: 4,
        latePenalty: 1200,
        conditionOnReturn: null,
        damageDescription: null,
        damageEvidence: [],
        estimatedRepairCost: 0,
        damageAmount: 0,
        damageReviewStatus: 'NONE',
        damageAdminNotes: null,
        status: 'OVERDUE',
        remindersSent: 1,
        lastReminderAt: isoHours(-1),
        createdAt: isoDays(-1),
      },
      {
        id: 'BK-849205',
        vehicleId: 'veh-5',
        renterId: 'usr-1',
        ownerId: 'usr-2',
        pickupDateTime: isoHours(-192),
        returnDateTime: isoHours(-182),
        actualReturnDateTime: isoHours(-183),
        durationHours: 10,
        hourlyRate: 200,
        rentalAmount: 2000,
        securityDeposit: 4000,
        lateHours: 0,
        latePenalty: 0,
        conditionOnReturn: 'No Damage',
        damageDescription: null,
        damageEvidence: [],
        estimatedRepairCost: 0,
        damageAmount: 0,
        damageReviewStatus: 'NONE',
        damageAdminNotes: null,
        status: 'RETURNED',
        remindersSent: 0,
        lastReminderAt: null,
        createdAt: isoDays(-10),
      },
      {
        id: 'BK-849206',
        vehicleId: 'veh-4',
        renterId: 'usr-1',
        ownerId: 'usr-3',
        pickupDateTime: isoHours(-96),
        returnDateTime: isoHours(-88),
        actualReturnDateTime: isoHours(-85),
        durationHours: 8,
        hourlyRate: 220,
        rentalAmount: 1760,
        securityDeposit: 4500,
        lateHours: 3,
        latePenalty: 900,
        conditionOnReturn: 'Minor Damage',
        damageDescription:
          'Rear left bumper paint scuff and reflector crack incurred during tight basement parking.',
        damageEvidence: ['rear_bumper_scuff_01.jpg', 'reflector_closeup_02.jpg'],
        estimatedRepairCost: 2200,
        damageAmount: 0,
        damageReviewStatus: 'PENDING_REVIEW',
        damageAdminNotes: 'Awaiting admin inspection of workshop estimate.',
        status: 'RETURNED_LATE',
        remindersSent: 0,
        lastReminderAt: null,
        createdAt: isoDays(-5),
      },
    ],
    incidents: [
      {
        id: 'INC-5011',
        bookingId: 'BK-849206',
        vehicleId: 'veh-4',
        reportedBy: 'usr-3',
        reporterRole: 'OWNER',
        type: 'Vehicle Damage',
        priority: 'STANDARD',
        description:
          'Minor damage reported upon check-in of Tata Nexon EV (BK-849206): Rear left bumper scuff and cracked reflector. Workshop estimate ₹2,200 submitted for admin deposit review.',
        evidence: ['rear_bumper_scuff_01.jpg', 'reflector_closeup_02.jpg'],
        status: 'UNDER_REVIEW',
        adminRemarks:
          'Evidence photos verified. Reviewing body shop paint & reflector invoice before authorizing deposit adjustment.',
        estimatedDamageCost: 2200,
        approvedDamageAmount: 0,
        damageStatus: 'PENDING_REVIEW',
        createdAt: isoDays(-3),
        updatedAt: isoDays(-2),
      },
      {
        id: 'INC-5012',
        bookingId: 'BK-849203',
        vehicleId: 'veh-2',
        reportedBy: 'usr-1',
        reporterRole: 'OWNER',
        type: 'Vehicle Not Returned',
        priority: 'HIGH',
        description:
          'Hyundai Creta SX(O) (BK-849203) is 6 hours past expected return time. One reminder sent to renter Rohan Deshmukh.',
        evidence: ['booking_timeline_log.pdf'],
        status: 'OPEN',
        adminRemarks: 'Monitoring overdue status. Renter contacted by operations desk.',
        estimatedDamageCost: null,
        approvedDamageAmount: 0,
        damageStatus: 'NONE',
        createdAt: isoHours(-2),
        updatedAt: isoHours(-1),
      },
    ],
    notifications: [
      {
        id: 'notif-1',
        userId: 'usr-1',
        targetScope: 'USER',
        title: 'Overdue Rental Alert',
        message:
          'Your booking BK-849204 (Royal Enfield Classic 350) is past its return time. Late penalty of ₹300/hr applies until returned.',
        type: 'ERROR',
        read: false,
        link: '/bookings/BK-849204',
        createdAt: isoHours(-3),
      },
      {
        id: 'notif-2',
        userId: 'usr-1',
        targetScope: 'USER',
        title: 'Owner Alert: Vehicle Overdue',
        message:
          'Your listed Hyundai Creta SX(O) (Booking BK-849203) has not been returned on schedule by Rohan Deshmukh.',
        type: 'WARNING',
        read: false,
        link: '/bookings/BK-849203',
        createdAt: isoHours(-5),
      },
      {
        id: 'notif-3',
        userId: 'usr-1',
        targetScope: 'USER',
        title: 'Security Deposit Pending Admin Review',
        message:
          'Booking BK-849206 (Tata Nexon EV) has a damage report (est. ₹2,200) under admin review. No deposit deduction occurs until approved.',
        type: 'INFO',
        read: false,
        link: '/bookings/BK-849206',
        createdAt: isoDays(-3),
      },
      {
        id: 'notif-4',
        userId: 'usr-1',
        targetScope: 'USER',
        title: 'Booking Confirmed',
        message:
          'Upcoming reservation BK-849202 for Mahindra XUV700 AX7 Luxury is confirmed.',
        type: 'SUCCESS',
        read: true,
        link: '/bookings/BK-849202',
        createdAt: isoHours(-6),
      },
    ],
  };
}

function loadDb(): RuntimeDatabase {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as RuntimeDatabase;
      if (parsed.schemaVersion === CURRENT_SCHEMA_VERSION) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read runtime-db.json, recreating seed:', err);
  }
  const initial = createInitialSeedDatabase();
  saveDb(initial);
  return initial;
}

function saveDb(db: RuntimeDatabase): void {
  const dir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

function formatUser(u: DbUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    passwordHash: '',
    role: u.role,
    createdAt: u.createdAt,
    avatarInitials: u.avatarInitials || computeInitials(u.name),
    city: u.city || 'Bengaluru',
    rating: u.rating || 5.0,
  };
}

function calculateDynamicBookingStatus(b: DbBooking): DbBooking['status'] {
  if (b.status === 'CANCELLED') return 'CANCELLED';
  const nowMs = Date.now();
  const pickupMs = new Date(b.pickupDateTime).getTime();
  const returnMs = new Date(b.returnDateTime).getTime();

  if (b.actualReturnDateTime) {
    const actualMs = new Date(b.actualReturnDateTime).getTime();
    return actualMs - returnMs > 60 * 1000 ? 'RETURNED_LATE' : 'RETURNED';
  }
  if (nowMs < pickupMs) return 'UPCOMING';
  if (nowMs <= returnMs) return 'ACTIVE';
  return 'OVERDUE';
}

function hydrateVehicles(db: RuntimeDatabase, vehicleId?: string) {
  const list = vehicleId
    ? db.vehicles.filter((v) => v.id === vehicleId)
    : db.vehicles;
  return list.map((v) => {
    const owner = db.users.find((u) => u.id === v.ownerId);
    return {
      ...v,
      ownerName: owner?.name || 'Verified Host',
      ownerPhone: owner?.phone || '+91 98450 11223',
      ownerRating: owner?.rating || 4.9,
    };
  });
}

function hydrateBookings(db: RuntimeDatabase, bookingId?: string) {
  let changed = false;
  const list = bookingId
    ? db.bookings.filter((b) => b.id === bookingId)
    : db.bookings;
  const result = list.map((b) => {
    const computedStatus = calculateDynamicBookingStatus(b);
    if (computedStatus !== b.status) {
      b.status = computedStatus;
      changed = true;
    }
    const renter = db.users.find((u) => u.id === b.renterId);
    const owner = db.users.find((u) => u.id === b.ownerId);
    return {
      ...b,
      renterName: renter?.name || 'Renter',
      renterEmail: renter?.email || '',
      renterPhone: renter?.phone || '',
      ownerName: owner?.name || 'Owner',
    };
  });
  if (changed) saveDb(db);
  return result;
}

function hydrateIncidents(db: RuntimeDatabase, incidentId?: string) {
  const list = incidentId
    ? db.incidents.filter((i) => i.id === incidentId)
    : db.incidents;
  return list.map((inc) => {
    const reporter = db.users.find((u) => u.id === inc.reportedBy);
    return {
      ...inc,
      reporterName: reporter?.name || 'User',
    };
  });
}

function hydrateNotifications(db: RuntimeDatabase, currentUser: DbUser | null) {
  if (!currentUser) return [];
  return db.notifications
    .filter((n) => {
      if (currentUser.role === 'ADMIN') {
        return (
          n.userId === currentUser.id ||
          n.targetScope === 'ADMIN' ||
          n.targetScope === 'ALL'
        );
      }
      return n.userId === currentUser.id || n.targetScope === 'ALL';
    })
    .map((n) => ({
      id: n.id,
      userId:
        n.targetScope === 'ALL'
          ? 'ALL'
          : n.targetScope === 'ADMIN'
            ? 'ADMIN'
            : n.userId,
      title: n.title,
      message: n.message,
      type: n.type,
      read: n.read,
      link: n.link || undefined,
      createdAt: n.createdAt,
    }));
}

function getAuthenticatedUser(req: Request, db: RuntimeDatabase): DbUser | null {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const rawToken = match[1].trim();
  if (!rawToken) return null;
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const found = db.tokens.find(
    (t) =>
      t.tokenHash === tokenHash && new Date(t.expiresAt).getTime() > Date.now()
  );
  if (!found) return null;
  return db.users.find((u) => u.id === found.userId) || null;
}

function createNotification(
  db: RuntimeDatabase,
  userId: string,
  title: string,
  message: string,
  type: DbNotification['type'] = 'INFO',
  link: string | null = null,
  targetScope: DbNotification['targetScope'] = 'USER'
) {
  db.notifications.unshift({
    id: `notif-${crypto.randomBytes(4).toString('hex')}`,
    userId,
    targetScope,
    title,
    message,
    type,
    read: false,
    link,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Automatic XAMPP Apache + PHP + MySQL Proxy Detector:
 * When the user runs XAMPP locally (Apache on port 80), `/api/*` calls
 * are automatically forwarded to the PHP backend in XAMPP `htdocs` if reachable.
 */
let cachedXamppBaseUrl: string | null | undefined = undefined;
let lastXamppCheckMs = 0;

async function detectXamppBackendUrl(): Promise<string | null> {
  const now = Date.now();
  if (cachedXamppBaseUrl !== undefined && now - lastXamppCheckMs < 10000) {
    return cachedXamppBaseUrl;
  }
  lastXamppCheckMs = now;

  const candidates = [
    process.env.XAMPP_API_URL,
    'http://127.0.0.1/OnlineVR/backend/api',
    'http://localhost/OnlineVR/backend/api',
    'http://127.0.0.1/velorent/backend/api',
    'http://127.0.0.1/velorent-api/api',
    'http://127.0.0.1/backend/api',
  ].filter(Boolean) as string[];

  for (const base of candidates) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 400);
      const resp = await fetch(`${base.replace(/\/+$/, '')}/state/bootstrap.php`, {
        method: 'OPTIONS',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.status === 200 || resp.status === 204) {
        cachedXamppBaseUrl = base.replace(/\/+$/, '');
        return cachedXamppBaseUrl;
      }
    } catch {
      // candidate not running on port 80
    }
  }

  cachedXamppBaseUrl = null;
  return null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true }));

  loadDb();

  // Optional automatic proxy to XAMPP PHP backend if running locally on port 80
  app.use('/api', async (req: Request, res: Response, next) => {
    const xamppBase = await detectXamppBackendUrl();
    if (!xamppBase) {
      next();
      return;
    }

    try {
      const targetUrl = `${xamppBase}${req.url}`;
      const headers: Record<string, string> = {};
      if (req.headers['content-type']) {
        headers['Content-Type'] = String(req.headers['content-type']);
      }
      if (req.headers.authorization) {
        headers['Authorization'] = String(req.headers.authorization);
      }
      if (req.headers.cookie) {
        headers['Cookie'] = String(req.headers.cookie);
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const phpRes = await fetch(targetUrl, fetchOptions);
      const text = await phpRes.text();
      res.status(phpRes.status);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.send(text);
    } catch {
      next();
    }
  });

  // ---------------------------------------------------------------------------
  // 1. GET /api/state/bootstrap.php
  // ---------------------------------------------------------------------------
  app.get('/api/state/bootstrap.php', (req: Request, res: Response) => {
    const db = loadDb();
    const authUser = getAuthenticatedUser(req, db);
    res.json({
      success: true,
      currentUser: authUser ? formatUser(authUser) : null,
      users: db.users.map(formatUser),
      vehicles: hydrateVehicles(db),
      bookings: hydrateBookings(db),
      incidents: hydrateIncidents(db),
      notifications: hydrateNotifications(db, authUser),
    });
  });

  // ---------------------------------------------------------------------------
  // 2. POST /api/auth/register.php
  // ---------------------------------------------------------------------------
  app.post('/api/auth/register.php', (req: Request, res: Response) => {
    const db = loadDb();
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');
    const city = String(req.body.city || 'Bengaluru').trim() || 'Bengaluru';

    if (!name || !email || !phone || !password) {
      res.status(400).json({
        success: false,
        error: 'Please complete all required registration fields.',
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({
        success: false,
        error: 'Please enter a valid email address.',
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.',
      });
      return;
    }

    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({
        success: false,
        error: 'An account with this email address is already registered.',
      });
      return;
    }

    const userId = `usr-${crypto.randomBytes(5).toString('hex')}`;
    const newUser: DbUser = {
      id: userId,
      name,
      email,
      phone,
      passwordHash: hashPassword(password),
      role: 'USER',
      avatarInitials: computeInitials(name),
      city,
      rating: 5.0,
      createdAt: new Date().toISOString(),
    };

    db.users.unshift(newUser);
    createNotification(
      db,
      userId,
      'Account Created',
      'Welcome to VeloRent. You can now rent vehicles or list your own vehicle on the marketplace.',
      'SUCCESS',
      '/rent'
    );

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    db.tokens.push({
      tokenHash,
      userId,
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    });

    saveDb(db);
    res.status(201).json({
      success: true,
      token: rawToken,
      user: formatUser(newUser),
    });
  });

  // ---------------------------------------------------------------------------
  // 3. POST /api/auth/login.php
  // ---------------------------------------------------------------------------
  app.post('/api/auth/login.php', (req: Request, res: Response) => {
    const db = loadDb();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Please enter both your email address and password.',
      });
      return;
    }

    const user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password. Please check your credentials.',
      });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    db.tokens.push({
      tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    });

    saveDb(db);
    res.json({
      success: true,
      token: rawToken,
      user: formatUser(user),
    });
  });

  // ---------------------------------------------------------------------------
  // 4. POST /api/auth/logout.php
  // ---------------------------------------------------------------------------
  app.post('/api/auth/logout.php', (req: Request, res: Response) => {
    const db = loadDb();
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      const tokenHash = crypto
        .createHash('sha256')
        .update(match[1].trim())
        .digest('hex');
      db.tokens = db.tokens.filter((t) => t.tokenHash !== tokenHash);
      saveDb(db);
    }
    res.json({
      success: true,
      message: 'Logged out successfully.',
    });
  });

  // ---------------------------------------------------------------------------
  // 5. GET / PUT / POST /api/auth/me.php
  // ---------------------------------------------------------------------------
  app.all('/api/auth/me.php', (req: Request, res: Response) => {
    const db = loadDb();
    const user = getAuthenticatedUser(req, db);
    if (req.method === 'GET') {
      res.json({
        success: true,
        user: user ? formatUser(user) : null,
      });
      return;
    }

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in to continue.',
      });
      return;
    }

    const name = String(req.body.name ?? user.name).trim();
    const phone = String(req.body.phone ?? user.phone).trim();
    const city = String(req.body.city ?? (user.city || 'Bengaluru')).trim();

    if (!name) {
      res.status(400).json({ success: false, error: 'Name cannot be empty.' });
      return;
    }
    if (!phone) {
      res
        .status(400)
        .json({ success: false, error: 'Phone number cannot be empty.' });
      return;
    }

    user.name = name;
    user.phone = phone;
    user.city = city || 'Bengaluru';
    user.avatarInitials = computeInitials(name);
    saveDb(db);

    res.json({
      success: true,
      user: formatUser(user),
    });
  });

  // ---------------------------------------------------------------------------
  // 6. GET / POST /api/vehicles/index.php
  // ---------------------------------------------------------------------------
  app.all('/api/vehicles/index.php', (req: Request, res: Response) => {
    const db = loadDb();
    if (req.method === 'GET') {
      const vehicleId = req.query.id ? String(req.query.id).trim() : undefined;
      res.json({
        success: true,
        vehicles: hydrateVehicles(db, vehicleId),
      });
      return;
    }

    const currentUser = getAuthenticatedUser(req, db);
    if (!currentUser) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in to continue.',
      });
      return;
    }

    const allowedTypes = ['Car', 'SUV', 'Bike', 'Van'] as const;
    const rawType = String(req.body.type || 'Car');
    const type: DbVehicle['type'] = (allowedTypes as readonly string[]).includes(
      rawType
    )
      ? (rawType as DbVehicle['type'])
      : 'Car';

    const brand = String(req.body.brand || '').trim();
    const model = String(req.body.model || '').trim();
    const registrationNumber = String(req.body.registrationNumber || '')
      .trim()
      .toUpperCase();
    const location = String(req.body.location || '').trim();
    const hourlyRate = Number(req.body.hourlyRate || 0);
    const dailyRate =
      req.body.dailyRate && Number(req.body.dailyRate) > 0
        ? Number(req.body.dailyRate)
        : Math.round(hourlyRate * 20);
    const securityDeposit = Number(req.body.securityDeposit || 0);
    const description = String(req.body.description || '').trim();
    const transmission: DbVehicle['transmission'] =
      req.body.transmission === 'Manual' ? 'Manual' : 'Automatic';
    const fuelType: DbVehicle['fuelType'] = [
      'Petrol',
      'Diesel',
      'Electric',
      'Hybrid',
    ].includes(req.body.fuelType)
      ? req.body.fuelType
      : 'Petrol';
    const seats = Math.max(
      1,
      Math.min(15, Number(req.body.seats || (type === 'Bike' ? 2 : 5)))
    );

    if (!brand || !model) {
      res.status(400).json({
        success: false,
        error: 'Vehicle brand and model are required.',
      });
      return;
    }
    if (registrationNumber.length < 6) {
      res.status(400).json({
        success: false,
        error: 'Please enter a valid vehicle registration number.',
      });
      return;
    }
    if (!location) {
      res.status(400).json({
        success: false,
        error: 'Pickup location is required.',
      });
      return;
    }
    if (hourlyRate <= 0) {
      res.status(400).json({
        success: false,
        error: 'Hourly rate must be greater than 0.',
      });
      return;
    }
    if (securityDeposit < 0) {
      res.status(400).json({
        success: false,
        error: 'Security deposit cannot be negative.',
      });
      return;
    }
    if (!description) {
      res.status(400).json({
        success: false,
        error: 'Vehicle description is required.',
      });
      return;
    }

    if (
      db.vehicles.some(
        (v) => v.registrationNumber.toUpperCase() === registrationNumber
      )
    ) {
      res.status(409).json({
        success: false,
        error: `A vehicle with registration number ${registrationNumber} is already listed on the platform.`,
      });
      return;
    }

    const vehicleId = `veh-${crypto.randomBytes(5).toString('hex')}`;
    const features =
      Array.isArray(req.body.features) && req.body.features.length > 0
        ? req.body.features.map((f: any) => String(f).trim()).filter(Boolean)
        : ['Air Conditioning', 'FASTag Active', 'Verified Registration'];
    const rules =
      Array.isArray(req.body.rules) && req.body.rules.length > 0
        ? req.body.rules.map((r: any) => String(r).trim()).filter(Boolean)
        : [
            'Valid Indian Driving Licence mandatory at pickup.',
            'Return with same fuel level as handover.',
            'Late returns beyond scheduled time incur ₹300/hr penalty.',
          ];
    const images =
      Array.isArray(req.body.images) && req.body.images.length > 0
        ? req.body.images.map((i: any) => String(i).trim()).filter(Boolean)
        : [`/assets/${type.toLowerCase()}`];

    const newVehicle: DbVehicle = {
      id: vehicleId,
      ownerId: currentUser.id,
      type,
      brand,
      model,
      registrationNumber,
      location,
      hourlyRate,
      dailyRate,
      availableFrom: req.body.availableFrom
        ? new Date(req.body.availableFrom).toISOString()
        : new Date().toISOString(),
      availableUntil: req.body.availableUntil
        ? new Date(req.body.availableUntil).toISOString()
        : new Date(Date.now() + 60 * 86400 * 1000).toISOString(),
      status: 'AVAILABLE',
      securityDeposit,
      description,
      features,
      rules,
      cancellationPolicy:
        String(req.body.cancellationPolicy || '').trim() ||
        '100% full refund if cancelled before scheduled pickup time.',
      images,
      transmission,
      fuelType,
      seats,
      createdAt: new Date().toISOString(),
    };

    db.vehicles.unshift(newVehicle);
    createNotification(
      db,
      currentUser.id,
      'Vehicle Listed Successfully',
      `${brand} ${model} (${registrationNumber}) is now live in the marketplace.`,
      'SUCCESS',
      `/my-vehicles/${vehicleId}`
    );

    saveDb(db);
    const hydrated = hydrateVehicles(db, vehicleId);
    res.status(201).json({
      success: true,
      vehicle: hydrated[0] || null,
    });
  });

  // ---------------------------------------------------------------------------
  // 7. PUT / POST / DELETE /api/vehicles/manage.php
  // ---------------------------------------------------------------------------
  app.all('/api/vehicles/manage.php', (req: Request, res: Response) => {
    const db = loadDb();
    const currentUser = getAuthenticatedUser(req, db);
    if (!currentUser) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in to continue.',
      });
      return;
    }

    const vehicleId = String(
      req.body.vehicleId || req.query.id || ''
    ).trim();
    if (!vehicleId) {
      res.status(400).json({
        success: false,
        error: 'Vehicle ID is required.',
      });
      return;
    }

    const vehicleIndex = db.vehicles.findIndex((v) => v.id === vehicleId);
    if (vehicleIndex === -1) {
      res.status(404).json({
        success: false,
        error: 'Vehicle not found.',
      });
      return;
    }

    const vehicle = db.vehicles[vehicleIndex];
    const isOwner = vehicle.ownerId === currentUser.id;
    const isAdmin = currentUser.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'You do not have permission to modify this vehicle listing.',
      });
      return;
    }

    const action = String(
      req.body.action || (req.method === 'DELETE' ? 'delete' : 'update')
    ).toLowerCase();
    const vehicleBookings = db.bookings.filter((b) => b.vehicleId === vehicleId);

    if (action === 'toggle_status') {
      for (const b of vehicleBookings) {
        const st = calculateDynamicBookingStatus(b);
        if (
          vehicle.status === 'AVAILABLE' &&
          (st === 'ACTIVE' || st === 'OVERDUE')
        ) {
          res.status(400).json({
            success: false,
            error: `Cannot disable listing while booking ${b.id} is currently ${st}.`,
          });
          return;
        }
      }

      const newStatus =
        vehicle.status === 'AVAILABLE' ? 'DISABLED' : 'AVAILABLE';
      vehicle.status = newStatus;
      saveDb(db);
      const hydrated = hydrateVehicles(db, vehicleId);
      res.json({
        success: true,
        newStatus,
        vehicle: hydrated[0] || null,
      });
      return;
    }

    if (action === 'delete' || req.method === 'DELETE') {
      for (const b of vehicleBookings) {
        const st = calculateDynamicBookingStatus(b);
        if (st === 'ACTIVE' || st === 'OVERDUE' || st === 'UPCOMING') {
          res.status(400).json({
            success: false,
            error: `Cannot delete vehicle with an ${st.toLowerCase()} booking (${b.id}).`,
          });
          return;
        }
      }

      db.vehicles.splice(vehicleIndex, 1);
      saveDb(db);
      res.json({
        success: true,
        message: 'Vehicle removed from fleet.',
      });
      return;
    }

    const updates = req.body.updates || req.body;
    const nextReg = updates.registrationNumber
      ? String(updates.registrationNumber).trim().toUpperCase()
      : vehicle.registrationNumber;

    if (
      nextReg.toUpperCase() !== vehicle.registrationNumber.toUpperCase() &&
      db.vehicles.some(
        (v) =>
          v.id !== vehicleId &&
          v.registrationNumber.toUpperCase() === nextReg.toUpperCase()
      )
    ) {
      res.status(409).json({
        success: false,
        error: `Registration number ${nextReg} is already registered to another vehicle.`,
      });
      return;
    }

    if (updates.brand !== undefined) vehicle.brand = String(updates.brand).trim();
    if (updates.model !== undefined) vehicle.model = String(updates.model).trim();
    if (updates.type !== undefined) vehicle.type = updates.type;
    vehicle.registrationNumber = nextReg;
    if (updates.transmission !== undefined)
      vehicle.transmission = updates.transmission;
    if (updates.fuelType !== undefined) vehicle.fuelType = updates.fuelType;
    if (updates.seats !== undefined)
      vehicle.seats = Math.max(1, Math.min(15, Number(updates.seats)));
    if (updates.location !== undefined)
      vehicle.location = String(updates.location).trim();
    if (updates.hourlyRate !== undefined)
      vehicle.hourlyRate = Number(updates.hourlyRate);
    if (updates.dailyRate !== undefined)
      vehicle.dailyRate = Number(updates.dailyRate);
    if (updates.securityDeposit !== undefined)
      vehicle.securityDeposit = Number(updates.securityDeposit);
    if (updates.availableFrom !== undefined)
      vehicle.availableFrom = new Date(updates.availableFrom).toISOString();
    if (updates.availableUntil !== undefined)
      vehicle.availableUntil = new Date(updates.availableUntil).toISOString();
    if (updates.description !== undefined)
      vehicle.description = String(updates.description).trim();
    if (Array.isArray(updates.features)) {
      vehicle.features = updates.features
        .map((f: any) => String(f).trim())
        .filter(Boolean);
    }
    if (Array.isArray(updates.images) && updates.images.length > 0) {
      vehicle.images = updates.images
        .map((i: any) => String(i).trim())
        .filter(Boolean);
    }

    saveDb(db);
    const hydrated = hydrateVehicles(db, vehicleId);
    res.json({
      success: true,
      vehicle: hydrated[0] || null,
    });
  });

  // ---------------------------------------------------------------------------
  // 8. GET / POST /api/bookings/index.php
  // ---------------------------------------------------------------------------
  app.all('/api/bookings/index.php', (req: Request, res: Response) => {
    const db = loadDb();
    if (req.method === 'GET') {
      const bookingId = req.query.id ? String(req.query.id).trim() : undefined;
      res.json({
        success: true,
        bookings: hydrateBookings(db, bookingId),
      });
      return;
    }

    const currentUser = getAuthenticatedUser(req, db);
    if (!currentUser) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in to continue.',
      });
      return;
    }

    const vehicleId = String(req.body.vehicleId || '').trim();
    const pickupISO = String(
      req.body.pickupISO || req.body.pickupDateTime || ''
    ).trim();
    const returnISO = String(
      req.body.returnISO || req.body.returnDateTime || ''
    ).trim();

    if (!vehicleId || !pickupISO || !returnISO) {
      res.status(400).json({
        success: false,
        error: 'Vehicle ID, pickup date/time, and return date/time are required.',
      });
      return;
    }

    const vehicle = db.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) {
      res.status(404).json({
        success: false,
        error: 'Selected vehicle was not found.',
      });
      return;
    }

    if (vehicle.ownerId === currentUser.id) {
      res.status(400).json({
        success: false,
        error: 'You cannot book your own listed vehicle.',
      });
      return;
    }

    if (vehicle.status === 'DISABLED') {
      res.status(400).json({
        success: false,
        error: 'This vehicle listing has been temporarily paused by the owner.',
      });
      return;
    }

    const blockingIncident = db.incidents.find(
      (inc) =>
        inc.vehicleId === vehicleId &&
        (inc.status === 'OPEN' || inc.status === 'UNDER_REVIEW') &&
        (inc.type === 'Vehicle Not Returned' ||
          inc.type === 'Suspected Theft' ||
          inc.type === 'Accident')
    );
    if (blockingIncident) {
      res.status(400).json({
        success: false,
        error: `Blocked due to open incident (${blockingIncident.type}).`,
      });
      return;
    }

    const pickupMs = new Date(pickupISO).getTime();
    const returnMs = new Date(returnISO).getTime();
    const nowMs = Date.now();

    if (isNaN(pickupMs) || isNaN(returnMs)) {
      res.status(400).json({
        success: false,
        error: 'Invalid pickup or return date/time format.',
      });
      return;
    }

    if (pickupMs < nowMs - 300 * 1000) {
      res.status(400).json({
        success: false,
        error: 'Pickup date and time cannot be in the past.',
      });
      return;
    }

    if (returnMs <= pickupMs) {
      res.status(400).json({
        success: false,
        error: 'Return date and time must be after pickup date and time.',
      });
      return;
    }

    const rawHours = (returnMs - pickupMs) / (1000 * 3600);
    if (rawHours < 1.0) {
      res.status(400).json({
        success: false,
        error: 'Minimum rental duration is 1 hour.',
      });
      return;
    }

    const availFromMs = new Date(vehicle.availableFrom).getTime();
    const availUntilMs = new Date(vehicle.availableUntil).getTime();
    if (pickupMs < availFromMs || returnMs > availUntilMs) {
      res.status(400).json({
        success: false,
        error: 'Requested period must fall within the vehicle availability window.',
      });
      return;
    }

    for (const existing of db.bookings.filter((b) => b.vehicleId === vehicleId)) {
      const st = calculateDynamicBookingStatus(existing);
      if (st === 'OVERDUE') {
        res.status(400).json({
          success: false,
          error:
            'Current rental on this vehicle has passed its return deadline and has not been checked in yet.',
        });
        return;
      }
      if (st === 'CANCELLED' || st === 'RETURNED' || st === 'RETURNED_LATE') {
        continue;
      }
      const exPickupMs = new Date(existing.pickupDateTime).getTime();
      const exReturnMs = new Date(existing.returnDateTime).getTime();
      if (pickupMs < exReturnMs && returnMs > exPickupMs) {
        res.status(409).json({
          success: false,
          error: 'This vehicle is already booked during the selected time.',
        });
        return;
      }
    }

    const durationHours = Math.round(rawHours * 100) / 100;
    const rentalAmount = Math.round(durationHours * vehicle.hourlyRate);
    const bookingId = `BK-${Math.floor(100000 + Math.random() * 900000)}`;
    const initialStatus: DbBooking['status'] =
      pickupMs <= nowMs + 60 * 1000 ? 'ACTIVE' : 'UPCOMING';

    const newBooking: DbBooking = {
      id: bookingId,
      vehicleId,
      renterId: currentUser.id,
      ownerId: vehicle.ownerId,
      pickupDateTime: new Date(pickupMs).toISOString(),
      returnDateTime: new Date(returnMs).toISOString(),
      actualReturnDateTime: null,
      durationHours,
      hourlyRate: vehicle.hourlyRate,
      rentalAmount,
      securityDeposit: vehicle.securityDeposit,
      lateHours: 0,
      latePenalty: 0,
      conditionOnReturn: null,
      damageDescription: null,
      damageEvidence: [],
      estimatedRepairCost: 0,
      damageAmount: 0,
      damageReviewStatus: 'NONE',
      damageAdminNotes: null,
      status: initialStatus,
      remindersSent: 0,
      lastReminderAt: null,
      createdAt: new Date().toISOString(),
    };

    db.bookings.unshift(newBooking);

    createNotification(
      db,
      currentUser.id,
      'Booking confirmed successfully.',
      `Reservation ${bookingId} for ${vehicle.brand} ${vehicle.model} is confirmed.`,
      'SUCCESS',
      `/bookings/${bookingId}`
    );

    createNotification(
      db,
      vehicle.ownerId,
      'New Booking on Your Vehicle',
      `${currentUser.name} booked your ${vehicle.brand} ${vehicle.model} (${bookingId}).`,
      'INFO',
      `/bookings/${bookingId}`
    );

    saveDb(db);
    const hydrated = hydrateBookings(db, bookingId);
    res.status(201).json({
      success: true,
      booking: hydrated[0] || null,
    });
  });

  // ---------------------------------------------------------------------------
  // 9. POST /api/bookings/cancel.php
  // ---------------------------------------------------------------------------
  app.post('/api/bookings/cancel.php', (req: Request, res: Response) => {
    const db = loadDb();
    const currentUser = getAuthenticatedUser(req, db);
    if (!currentUser) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in to continue.',
      });
      return;
    }

    const bookingId = String(req.body.bookingId || '').trim();
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found.',
      });
      return;
    }

    const isRenter = booking.renterId === currentUser.id;
    const isOwner = booking.ownerId === currentUser.id;
    const isAdmin = currentUser.role === 'ADMIN';
    if (!isRenter && !isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'You do not have permission to cancel this booking.',
      });
      return;
    }

    const currentStatus = calculateDynamicBookingStatus(booking);
    if (currentStatus !== 'UPCOMING') {
      res.status(400).json({
        success: false,
        error:
          'Cancellation is only permitted before the scheduled rental pickup time.',
      });
      return;
    }

    booking.status = 'CANCELLED';
    createNotification(
      db,
      booking.renterId,
      'Booking Cancelled',
      `Your upcoming booking ${bookingId} has been cancelled. Full rental amount and security deposit are marked for refund.`,
      'INFO',
      `/bookings/${bookingId}`
    );

    saveDb(db);
    const hydrated = hydrateBookings(db, bookingId);
    res.json({
      success: true,
      booking: hydrated[0] || null,
    });
  });

  // ---------------------------------------------------------------------------
  // 10. POST /api/bookings/return.php
  // ---------------------------------------------------------------------------
  app.post('/api/bookings/return.php', (req: Request, res: Response) => {
    const db = loadDb();
    const currentUser = getAuthenticatedUser(req, db);
    if (!currentUser) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in to continue.',
      });
      return;
    }

    const bookingId = String(req.body.bookingId || '').trim();
    const actualReturnISO = String(
      req.body.actualReturnISO || req.body.actualReturnDateTime || ''
    ).trim();
    const rawCondition = String(
      req.body.condition || req.body.conditionOnReturn || 'No Damage'
    );
    const condition: NonNullable<DbBooking['conditionOnReturn']> = [
      'No Damage',
      'Minor Damage',
      'Major Damage',
    ].includes(rawCondition)
      ? (rawCondition as NonNullable<DbBooking['conditionOnReturn']>)
      : 'No Damage';

    const damageDescription = String(req.body.damageDescription || '').trim();
    const estimatedRepairCost = Number(req.body.estimatedRepairCost || 0);
    const damageEvidence = Array.isArray(req.body.damageEvidence)
      ? req.body.damageEvidence.map((e: any) => String(e).trim()).filter(Boolean)
      : [];

    if (!bookingId || !actualReturnISO) {
      res.status(400).json({
        success: false,
        error: 'Booking ID and actual return date/time are required.',
      });
      return;
    }

    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found.',
      });
      return;
    }

    const isRenter = booking.renterId === currentUser.id;
    const isOwner = booking.ownerId === currentUser.id;
    const isAdmin = currentUser.role === 'ADMIN';
    if (!isRenter && !isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'You do not have permission to process this return.',
      });
      return;
    }

    const currentStatus = calculateDynamicBookingStatus(booking);
    if (
      currentStatus === 'RETURNED' ||
      currentStatus === 'RETURNED_LATE' ||
      currentStatus === 'CANCELLED'
    ) {
      res.status(400).json({
        success: false,
        error: 'This booking has already been returned or closed.',
      });
      return;
    }

    const pickupMs = new Date(booking.pickupDateTime).getTime();
    const expectedMs = new Date(booking.returnDateTime).getTime();
    const actualMs = new Date(actualReturnISO).getTime();

    if (isNaN(actualMs) || actualMs < pickupMs) {
      res.status(400).json({
        success: false,
        error: 'Actual return date/time cannot be earlier than the pickup date/time.',
      });
      return;
    }

    const hasDamage =
      condition === 'Minor Damage' || condition === 'Major Damage';
    if (hasDamage && !damageDescription) {
      res.status(400).json({
        success: false,
        error:
          'Please provide a damage description when reporting Minor or Major Damage.',
      });
      return;
    }

    const isLate = actualMs - expectedMs > 60 * 1000;
    let lateHours = 0;
    let latePenalty = 0;
    if (isLate) {
      const rawLateHours = (actualMs - expectedMs) / (1000 * 3600);
      lateHours = Math.round(rawLateHours * 100) / 100;
      latePenalty = Math.round(lateHours * LATE_PENALTY_PER_HOUR);
    }

    const returnStatus: DbBooking['status'] = isLate
      ? 'RETURNED_LATE'
      : 'RETURNED';
    const estimatedRepair = hasDamage
      ? Math.max(0, Math.round(estimatedRepairCost > 0 ? estimatedRepairCost : 1500))
      : 0;
    const damageReviewStatus: DbBooking['damageReviewStatus'] = hasDamage
      ? 'PENDING_REVIEW'
      : 'NONE';

    booking.actualReturnDateTime = new Date(actualMs).toISOString();
    booking.lateHours = lateHours;
    booking.latePenalty = latePenalty;
    booking.conditionOnReturn = condition;
    booking.damageDescription = hasDamage ? damageDescription : null;
    booking.damageEvidence = hasDamage ? damageEvidence : [];
    booking.estimatedRepairCost = estimatedRepair;
    booking.damageAmount = 0;
    booking.damageReviewStatus = damageReviewStatus;
    booking.damageAdminNotes = hasDamage
      ? 'Damage reported upon return. Awaiting Admin verification before security deposit adjustment.'
      : null;
    booking.status = returnStatus;

    if (hasDamage) {
      const createdIncidentId = `INC-${Math.floor(1000 + Math.random() * 9000)}`;
      const reporterRole: DbIncident['reporterRole'] = isOwner
        ? 'OWNER'
        : isAdmin
          ? 'ADMIN'
          : 'RENTER';
      const priority: DbIncident['priority'] =
        condition === 'Major Damage' ? 'HIGH' : 'STANDARD';

      db.incidents.unshift({
        id: createdIncidentId,
        bookingId,
        vehicleId: booking.vehicleId,
        reportedBy: currentUser.id,
        reporterRole,
        type: 'Vehicle Damage',
        priority,
        description: `${condition} reported on return (${bookingId}): ${damageDescription}`,
        evidence:
          damageEvidence.length > 0
            ? damageEvidence
            : ['return_inspection_photo.jpg'],
        status: 'UNDER_REVIEW',
        adminRemarks:
          'Submitted during vehicle check-in. Pending admin assessment of repair estimate.',
        estimatedDamageCost: estimatedRepair,
        approvedDamageAmount: 0,
        damageStatus: 'PENDING_REVIEW',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      createNotification(
        db,
        booking.renterId,
        'Vehicle damage report submitted.',
        `Your security deposit for booking ${bookingId} is pending admin review. No damage amount is deducted until verified.`,
        'WARNING',
        `/bookings/${bookingId}`
      );

      createNotification(
        db,
        booking.ownerId,
        'Vehicle Returned with Damage Report',
        `Booking ${bookingId} was returned with ${condition} (${createdIncidentId}). Admin review is in progress.`,
        'WARNING',
        `/bookings/${bookingId}`
      );
    } else {
      createNotification(
        db,
        booking.renterId,
        'Vehicle Returned Successfully',
        isLate
          ? `Vehicle returned ${lateHours} hrs late. Late penalty of ₹${latePenalty.toLocaleString('en-IN')} applied.`
          : `Vehicle returned on time in good condition. Security deposit of ₹${booking.securityDeposit.toLocaleString('en-IN')} is cleared for refund.`,
        'SUCCESS',
        `/bookings/${bookingId}`
      );
    }

    saveDb(db);
    const hydrated = hydrateBookings(db, bookingId);
    res.json({
      success: true,
      booking: hydrated[0] || null,
    });
  });

  // ---------------------------------------------------------------------------
  // 11. POST /api/bookings/reminder.php
  // ---------------------------------------------------------------------------
  app.post('/api/bookings/reminder.php', (req: Request, res: Response) => {
    const db = loadDb();
    const currentUser = getAuthenticatedUser(req, db);
    if (!currentUser) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in to continue.',
      });
      return;
    }

    const bookingId = String(req.body.bookingId || '').trim();
    const note = String(req.body.note || '').trim();

    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found.',
      });
      return;
    }

    const isOwner = booking.ownerId === currentUser.id;
    const isAdmin = currentUser.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        error:
          'Only the vehicle owner or an administrator can send return reminders.',
      });
      return;
    }

    booking.remindersSent += 1;
    booking.lastReminderAt = new Date().toISOString();

    createNotification(
      db,
      booking.renterId,
      'Urgent Return Reminder from Owner',
      note ||
        `Your rental ${bookingId} is overdue. Please return the vehicle immediately or contact the owner.`,
      'WARNING',
      `/bookings/${bookingId}`
    );

    saveDb(db);
    const hydrated = hydrateBookings(db, bookingId);
    res.json({
      success: true,
      booking: hydrated[0] || null,
    });
  });

  // ---------------------------------------------------------------------------
  // 12. GET / POST /api/incidents/index.php
  // ---------------------------------------------------------------------------
  app.all('/api/incidents/index.php', (req: Request, res: Response) => {
    const db = loadDb();
    if (req.method === 'GET') {
      const incidentId = req.query.id ? String(req.query.id).trim() : undefined;
      res.json({
        success: true,
        incidents: hydrateIncidents(db, incidentId),
      });
      return;
    }

    const currentUser = getAuthenticatedUser(req, db);
    if (!currentUser) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in to continue.',
      });
      return;
    }

    const bookingId = String(req.body.bookingId || '').trim();
    const vehicleId = String(req.body.vehicleId || '').trim();
    const rawType = String(req.body.type || 'Other');
    const allowedTypes: DbIncident['type'][] = [
      'Vehicle Not Returned',
      'Suspected Theft',
      'Vehicle Damage',
      'Accident',
      'Other',
    ];
    const type: DbIncident['type'] = allowedTypes.includes(
      rawType as DbIncident['type']
    )
      ? (rawType as DbIncident['type'])
      : 'Other';
    const description = String(req.body.description || '').trim();
    const estimatedDamageCost =
      req.body.estimatedDamageCost !== undefined &&
      req.body.estimatedDamageCost !== ''
        ? Number(req.body.estimatedDamageCost)
        : null;
    const evidence =
      Array.isArray(req.body.evidence) && req.body.evidence.length > 0
        ? req.body.evidence.map((e: any) => String(e).trim()).filter(Boolean)
        : ['incident_statement_log.pdf'];

    if (!bookingId || !vehicleId || !description) {
      res.status(400).json({
        success: false,
        error: 'Booking ID, Vehicle ID, and incident description are required.',
      });
      return;
    }

    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Associated booking was not found.',
      });
      return;
    }

    const isRenter = booking.renterId === currentUser.id;
    const isOwner = booking.ownerId === currentUser.id;
    const isAdmin = currentUser.role === 'ADMIN';
    if (!isRenter && !isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'You do not have permission to file an incident on this booking.',
      });
      return;
    }

    const priorityMap: Record<DbIncident['type'], DbIncident['priority']> = {
      'Suspected Theft': 'CRITICAL',
      'Vehicle Not Returned': 'HIGH',
      Accident: 'HIGH',
      'Vehicle Damage': 'STANDARD',
      Other: 'STANDARD',
    };
    const priority = priorityMap[type] || 'STANDARD';
    const reporterRole: DbIncident['reporterRole'] = isAdmin
      ? 'ADMIN'
      : isOwner
        ? 'OWNER'
        : 'RENTER';
    const adminRemarks =
      type === 'Suspected Theft'
        ? 'HIGH PRIORITY ESCALATION: Logged for immediate platform risk review. Owner advised to contact local police authorities.'
        : 'Incident logged and assigned to platform operations queue.';
    const damageStatus: DbIncident['damageStatus'] =
      type === 'Vehicle Damage' ? 'PENDING_REVIEW' : 'NONE';
    const incidentId = `INC-${Math.floor(1000 + Math.random() * 9000)}`;

    const newIncident: DbIncident = {
      id: incidentId,
      bookingId,
      vehicleId,
      reportedBy: currentUser.id,
      reporterRole,
      type,
      priority,
      description,
      evidence,
      status: 'OPEN',
      adminRemarks,
      estimatedDamageCost,
      approvedDamageAmount: 0,
      damageStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.incidents.unshift(newIncident);

    createNotification(
      db,
      currentUser.id,
      'Incident report created.',
      `Incident ${incidentId} (${type}) has been logged for Booking ${bookingId}.`,
      type === 'Suspected Theft' ? 'ERROR' : 'WARNING',
      `/bookings/${bookingId}`
    );

    if (booking.renterId !== currentUser.id) {
      createNotification(
        db,
        booking.renterId,
        `Incident Filed on Booking ${bookingId}`,
        `An incident report (${type}) was filed regarding your rental ${bookingId}.`,
        'ERROR',
        `/bookings/${bookingId}`
      );
    }

    saveDb(db);
    const hydrated = hydrateIncidents(db, incidentId);
    res.status(201).json({
      success: true,
      incident: hydrated[0] || null,
    });
  });

  // ---------------------------------------------------------------------------
  // 13. POST /api/incidents/resolve.php
  // ---------------------------------------------------------------------------
  app.post('/api/incidents/resolve.php', (req: Request, res: Response) => {
    const db = loadDb();
    const currentUser = getAuthenticatedUser(req, db);
    if (!currentUser || currentUser.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Administrator privileges are required for this action.',
      });
      return;
    }

    const incidentId = String(req.body.incidentId || '').trim();
    const status = (req.body.status || 'UNDER_REVIEW') as DbIncident['status'];
    const adminRemarks = String(req.body.adminRemarks || '').trim();
    const damageDecision = req.body.damageDecision as
      | DbIncident['damageStatus']
      | undefined;
    let approvedDamageAmount = Math.max(
      0,
      Math.round(Number(req.body.approvedDamageAmount || 0))
    );

    const incident = db.incidents.find((i) => i.id === incidentId);
    if (!incident) {
      res.status(404).json({
        success: false,
        error: 'Incident not found.',
      });
      return;
    }

    if (damageDecision === 'REJECTED') {
      approvedDamageAmount = 0;
    }

    incident.status = status;
    if (adminRemarks) incident.adminRemarks = adminRemarks;
    if (damageDecision) incident.damageStatus = damageDecision;
    incident.approvedDamageAmount = approvedDamageAmount;
    incident.updatedAt = new Date().toISOString();

    const linkedBooking = db.bookings.find((b) => b.id === incident.bookingId);
    if (linkedBooking && damageDecision) {
      const bookingDamageAmt =
        damageDecision === 'APPROVED' || damageDecision === 'RESOLVED'
          ? approvedDamageAmount
          : 0;
      linkedBooking.damageReviewStatus = damageDecision;
      linkedBooking.damageAmount = bookingDamageAmt;
      linkedBooking.damageAdminNotes = incident.adminRemarks;

      const totalDeductions = linkedBooking.latePenalty + bookingDamageAmt;
      const refundableDeposit = Math.max(
        0,
        linkedBooking.securityDeposit - totalDeductions
      );

      createNotification(
        db,
        linkedBooking.renterId,
        'Security Deposit Review Updated',
        damageDecision === 'REJECTED'
          ? `Admin rejected the damage claim on ${linkedBooking.id}. Refundable deposit: ₹${refundableDeposit.toLocaleString('en-IN')}.`
          : `Admin approved ₹${bookingDamageAmt.toLocaleString('en-IN')} damage adjustment on ${linkedBooking.id}. Refundable deposit: ₹${refundableDeposit.toLocaleString('en-IN')}.`,
        'INFO',
        `/bookings/${linkedBooking.id}`
      );
    }

    saveDb(db);
    const hydratedInc = hydrateIncidents(db, incidentId);
    const hydratedBk = incident.bookingId
      ? hydrateBookings(db, incident.bookingId)
      : [];
    res.json({
      success: true,
      incident: hydratedInc[0] || null,
      booking: hydratedBk[0] || null,
    });
  });

  // ---------------------------------------------------------------------------
  // 14. GET / POST /api/notifications/index.php
  // ---------------------------------------------------------------------------
  app.all('/api/notifications/index.php', (req: Request, res: Response) => {
    const db = loadDb();
    const currentUser = getAuthenticatedUser(req, db);
    if (!currentUser) {
      res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const action = String(req.body.action || 'mark_read');
      if (action === 'mark_all_read') {
        db.notifications.forEach((n) => {
          if (n.userId === currentUser.id || n.targetScope === 'ALL') {
            n.read = true;
          }
        });
      } else {
        const id = String(req.body.id || '').trim();
        const found = db.notifications.find((n) => n.id === id);
        if (found) found.read = true;
      }
      saveDb(db);
    }

    res.json({
      success: true,
      notifications: hydrateNotifications(db, currentUser),
    });
  });

  // ---------------------------------------------------------------------------
  // 15. POST /api/uploads/upload.php
  // ---------------------------------------------------------------------------
  app.post('/api/uploads/upload.php', (req: Request, res: Response) => {
    const db = loadDb();
    const currentUser = getAuthenticatedUser(req, db);
    if (!currentUser) {
      res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
      return;
    }
    res.status(201).json({
      success: true,
      filename: `upload_${Date.now()}.jpg`,
      url: '/assets/car',
    });
  });

  // Mount Vite Dev Server or Static Production Build
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VeloRent server listening on http://localhost:${PORT}`);
  });
}

startServer();
