/**
 * Development seed data for VetNexa.
 *
 * Creates a realistic set of users, pets, clinics, health records, consultations, reviews,
 * rescue reports and adoption listings so every dashboard has meaningful content.
 * All people, clinics and animals are fictional.
 *
 * Run with: npm run db:seed -w @vetnexa/api   (wipes existing data first)
 *
 * Every demo account uses the password in DEMO_PASSWORD below.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createPrismaClient } from '../src/lib/prisma';

const prisma = createPrismaClient();

export const DEMO_PASSWORD = 'VetNexa@2026';

// Dates are relative to "today" so reminders and upcoming appointments always look current.
const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number, hour = 10) => {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date;
};
const yearsAgo = (years: number, months = 0) =>
  new Date(Date.now() - (years * 365 + months * 30) * DAY);

async function clearDatabase() {
  // Delete children before parents so foreign keys are never violated.
  await prisma.contactMessage.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.adoptionApplication.deleteMany();
  await prisma.adoptionListing.deleteMany();
  await prisma.rescueReport.deleteMany();
  await prisma.review.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.woundAssessment.deleteMany();
  await prisma.healthRecord.deleteMany();
  await prisma.pet.deleteMany();
  await prisma.vetProfile.deleteMany();
  await prisma.clinic.deleteMany();
  await prisma.user.deleteMany();
}

const weekdayHours = (open: string, close: string, saturday?: string, sunday?: string) => ({
  mon: `${open}-${close}`,
  tue: `${open}-${close}`,
  wed: `${open}-${close}`,
  thu: `${open}-${close}`,
  fri: `${open}-${close}`,
  sat: saturday ?? `${open}-${close}`,
  sun: sunday ?? 'Closed',
});
const allDay = weekdayHours('00:00', '23:59', '00:00-23:59', '00:00-23:59');

const clinicsData = [
  {
    name: 'Harbourview Animal Hospital',
    slug: 'harbourview-animal-hospital-colombo',
    description:
      'A full-service small animal hospital with in-house laboratory, digital X-ray and a dedicated intensive care ward. Open around the clock for emergencies.',
    addressLine: '214 Galle Road, Kollupitiya',
    city: 'Colombo',
    district: 'Colombo',
    latitude: 6.9108,
    longitude: 79.8507,
    phone: '0112574410',
    email: 'care@harbourview.lk',
    services: ['Emergency care', 'Surgery', 'Vaccination', 'Diagnostics', 'Dental care', 'ICU'],
    openingHours: allDay,
    hasEmergency: true,
    isOpen24Hours: true,
  },
  {
    name: 'Green Paws Veterinary Clinic',
    slug: 'green-paws-veterinary-clinic-nugegoda',
    description:
      'Friendly neighbourhood clinic focused on preventive care, vaccinations and nutrition advice for dogs and cats.',
    addressLine: '38 Stanley Thilakaratne Mawatha',
    city: 'Nugegoda',
    district: 'Colombo',
    latitude: 6.8721,
    longitude: 79.8897,
    phone: '0112812236',
    email: 'hello@greenpaws.lk',
    services: ['Vaccination', 'General check-up', 'Nutrition advice', 'Microchipping', 'Grooming'],
    openingHours: weekdayHours('08:30', '20:00', '09:00-17:00'),
    hasEmergency: false,
    isOpen24Hours: false,
  },
  {
    name: 'Hillside Pet Care Centre',
    slug: 'hillside-pet-care-centre-kandy',
    description:
      'Serving Kandy pet owners for over fifteen years with surgery, dermatology and senior pet care.',
    addressLine: '72 Peradeniya Road',
    city: 'Kandy',
    district: 'Kandy',
    latitude: 7.2843,
    longitude: 80.6271,
    phone: '0812234567',
    email: 'info@hillsidepetcare.lk',
    services: ['Surgery', 'Dermatology', 'Vaccination', 'Senior pet care', 'Diagnostics'],
    openingHours: weekdayHours('08:00', '19:00', '08:00-14:00'),
    hasEmergency: true,
    isOpen24Hours: false,
  },
  {
    name: 'Southern Coast Veterinary Hospital',
    slug: 'southern-coast-veterinary-hospital-galle',
    description:
      'Modern veterinary hospital near Galle Fort offering orthopaedic surgery, ultrasound and boarding.',
    addressLine: '15 Wakwella Road',
    city: 'Galle',
    district: 'Galle',
    latitude: 6.0412,
    longitude: 80.2178,
    phone: '0912245890',
    email: 'contact@southerncoastvet.lk',
    services: ['Orthopaedic surgery', 'Ultrasound', 'Vaccination', 'Boarding', 'Dental care'],
    openingHours: weekdayHours('08:00', '20:00', '08:00-18:00', '09:00-13:00'),
    hasEmergency: true,
    isOpen24Hours: false,
  },
  {
    name: 'Lagoon Side Animal Clinic',
    slug: 'lagoon-side-animal-clinic-negombo',
    description:
      'Compact, well-equipped clinic for routine care, vaccinations and minor procedures.',
    addressLine: '9 Lewis Place',
    city: 'Negombo',
    district: 'Gampaha',
    latitude: 7.2195,
    longitude: 79.8436,
    phone: '0312238471',
    email: null,
    services: ['Vaccination', 'General check-up', 'Minor surgery', 'Deworming'],
    openingHours: weekdayHours('09:00', '18:00', '09:00-13:00'),
    hasEmergency: false,
    isOpen24Hours: false,
  },
  {
    name: 'Northern Star Veterinary Centre',
    slug: 'northern-star-veterinary-centre-jaffna',
    description:
      'Veterinary centre caring for pets and working animals in the Northern Province, with mobile visits on request.',
    addressLine: '120 Hospital Road',
    city: 'Jaffna',
    district: 'Jaffna',
    latitude: 9.6643,
    longitude: 80.0122,
    phone: '0212223344',
    email: 'northernstarvet@gmail.com',
    services: ['Vaccination', 'General check-up', 'Mobile visits', 'Surgery'],
    openingHours: weekdayHours('08:00', '17:30', '08:00-12:30'),
    hasEmergency: false,
    isOpen24Hours: false,
  },
  {
    name: 'Wayamba Pet Hospital',
    slug: 'wayamba-pet-hospital-kurunegala',
    description: 'Pet hospital with laboratory testing, X-ray and an inpatient ward.',
    addressLine: '45 Colombo Road',
    city: 'Kurunegala',
    district: 'Kurunegala',
    latitude: 7.4818,
    longitude: 80.3609,
    phone: '0372221198',
    email: 'wayambapet@outlook.com',
    services: ['Diagnostics', 'X-ray', 'Vaccination', 'Inpatient care', 'Surgery'],
    openingHours: weekdayHours('08:00', '20:00', '08:00-20:00', '09:00-14:00'),
    hasEmergency: true,
    isOpen24Hours: false,
  },
  {
    name: 'Kelani Cat & Dog Clinic',
    slug: 'kelani-cat-dog-clinic-kiribathgoda',
    description:
      'Cat-friendly certified clinic with separate waiting areas for cats and dogs to reduce stress.',
    addressLine: '301 Kandy Road',
    city: 'Kiribathgoda',
    district: 'Gampaha',
    latitude: 6.9806,
    longitude: 79.9294,
    phone: '0112911425',
    email: 'appointments@kelanipets.lk',
    services: ['Feline medicine', 'Vaccination', 'Dental care', 'Spay and neuter'],
    openingHours: weekdayHours('09:00', '19:00', '09:00-15:00'),
    hasEmergency: false,
    isOpen24Hours: false,
  },
];

async function main() {
  console.warn('Seeding VetNexa database...');
  await clearDatabase();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // ── Clinics ──
  const clinics = await Promise.all(
    clinicsData.map((clinic) => prisma.clinic.create({ data: clinic })),
  );
  const clinicBySlug = Object.fromEntries(clinics.map((c) => [c.slug, c]));
  const harbourview = clinicBySlug['harbourview-animal-hospital-colombo']!;
  const greenPaws = clinicBySlug['green-paws-veterinary-clinic-nugegoda']!;
  const hillside = clinicBySlug['hillside-pet-care-centre-kandy']!;

  // ── Users ──
  const admin = await prisma.user.create({
    data: {
      email: 'admin@vetnexa.lk',
      passwordHash,
      firstName: 'Pradeesha',
      lastName: 'Baskaran',
      phone: '0785503592',
      role: 'ADMIN',
      city: 'Colombo',
    },
  });

  const makeOwner = (
    firstName: string,
    lastName: string,
    email: string,
    phone: string,
    city: string,
  ) =>
    prisma.user.create({
      data: { email, passwordHash, firstName, lastName, phone, city, role: 'OWNER' },
    });
  const nimali = await makeOwner(
    'Nimali',
    'Perera',
    'nimali.perera@example.com',
    '0771234567',
    'Colombo',
  );
  const kasun = await makeOwner(
    'Kasun',
    'Jayawardena',
    'kasun.j@example.com',
    '0712345678',
    'Kandy',
  );
  const tharushi = await makeOwner(
    'Tharushi',
    'Fernando',
    'tharushi.f@example.com',
    '0769876543',
    'Negombo',
  );

  const makeVet = async (
    firstName: string,
    lastName: string,
    email: string,
    phone: string,
    city: string,
    profile: {
      licenseNumber: string;
      specialization: string;
      yearsExperience: number;
      bio: string;
      clinicId: string;
      isVerified: boolean;
    },
  ) =>
    prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        city,
        role: 'VET',
        vetProfile: {
          create: { ...profile, verifiedAt: profile.isVerified ? daysFromNow(-120) : null },
        },
      },
    });
  const drAnjali = await makeVet(
    'Anjali',
    'Wickramasinghe',
    'dr.anjali@example.com',
    '0773456789',
    'Colombo',
    {
      licenseNumber: 'SLVC-2014-0457',
      specialization: 'Small animal surgery',
      yearsExperience: 11,
      bio: 'Graduate of the University of Peradeniya Faculty of Veterinary Medicine with a special interest in soft-tissue surgery and wound management.',
      clinicId: harbourview.id,
      isVerified: true,
    },
  );
  const drRuwan = await makeVet(
    'Ruwan',
    'Senanayake',
    'dr.ruwan@example.com',
    '0718765432',
    'Nugegoda',
    {
      licenseNumber: 'SLVC-2017-0812',
      specialization: 'Preventive care and nutrition',
      yearsExperience: 8,
      bio: 'Focuses on vaccination programmes, nutrition and long-term wellness plans for dogs and cats.',
      clinicId: greenPaws.id,
      isVerified: true,
    },
  );
  await makeVet('Shalini', 'Rajendran', 'dr.shalini@example.com', '0754321987', 'Kandy', {
    licenseNumber: 'SLVC-2023-1290',
    specialization: 'Dermatology',
    yearsExperience: 2,
    bio: 'Recently joined Hillside Pet Care Centre. Interested in skin and allergy conditions.',
    clinicId: hillside.id,
    isVerified: false, // waiting for admin verification – shows up in the admin queue
  });

  const rescuerHelping = await prisma.user.create({
    data: {
      email: 'rescue@helpingpaws.example.com',
      passwordHash,
      firstName: 'Dilan',
      lastName: 'Gunasekara',
      phone: '0779988776',
      city: 'Colombo',
      role: 'RESCUER',
    },
  });
  const rescuerKandy = await prisma.user.create({
    data: {
      email: 'hillcountry.rescue@example.com',
      passwordHash,
      firstName: 'Malsha',
      lastName: 'Herath',
      phone: '0716655443',
      city: 'Kandy',
      role: 'RESCUER',
    },
  });

  // ── Pets ──
  const bruno = await prisma.pet.create({
    data: {
      ownerId: nimali.id,
      name: 'Bruno',
      species: 'DOG',
      breed: 'Labrador Retriever',
      sex: 'MALE',
      dateOfBirth: yearsAgo(4, 3),
      weightKg: 31.4,
      color: 'Golden',
      microchipId: '900164000123456',
      isNeutered: true,
      notes: 'Loves swimming. Mild chicken allergy.',
    },
  });
  const luna = await prisma.pet.create({
    data: {
      ownerId: nimali.id,
      name: 'Luna',
      species: 'CAT',
      breed: 'Domestic Shorthair',
      sex: 'FEMALE',
      dateOfBirth: yearsAgo(2, 1),
      weightKg: 3.8,
      color: 'Tabby',
      isNeutered: true,
    },
  });
  const rocky = await prisma.pet.create({
    data: {
      ownerId: kasun.id,
      name: 'Rocky',
      species: 'DOG',
      breed: 'Sri Lankan Mixed Breed',
      sex: 'MALE',
      dateOfBirth: yearsAgo(6),
      weightKg: 18.2,
      color: 'Brown and white',
      isNeutered: false,
      notes: 'Rescued from Peradeniya in 2021. Nervous around loud noises.',
    },
  });
  const kitty = await prisma.pet.create({
    data: {
      ownerId: kasun.id,
      name: 'Mimi',
      species: 'CAT',
      breed: 'Persian',
      sex: 'FEMALE',
      dateOfBirth: yearsAgo(8, 6),
      weightKg: 4.4,
      color: 'White',
      isNeutered: true,
      notes: 'Senior cat. Needs regular grooming and kidney checks.',
    },
  });
  const max = await prisma.pet.create({
    data: {
      ownerId: tharushi.id,
      name: 'Max',
      species: 'DOG',
      breed: 'German Shepherd',
      sex: 'MALE',
      dateOfBirth: yearsAgo(1, 4),
      weightKg: 27.0,
      color: 'Black and tan',
      microchipId: '900164000987654',
    },
  });

  // ── Health records ──
  await prisma.healthRecord.createMany({
    data: [
      {
        petId: bruno.id,
        type: 'VACCINATION',
        title: 'DHPPi + Leptospirosis booster',
        recordDate: daysFromNow(-340),
        nextDueDate: daysFromNow(25),
        vetName: 'Dr. Ruwan Senanayake',
        clinicName: greenPaws.name,
        createdById: drRuwan.id,
      },
      {
        petId: bruno.id,
        type: 'VACCINATION',
        title: 'Anti-rabies vaccine',
        recordDate: daysFromNow(-200),
        nextDueDate: daysFromNow(165),
        vetName: 'Dr. Ruwan Senanayake',
        clinicName: greenPaws.name,
        createdById: drRuwan.id,
      },
      {
        petId: bruno.id,
        type: 'ALLERGY',
        title: 'Chicken protein allergy',
        description:
          'Itchy skin and ear infections after chicken-based food. Switched to fish-based diet.',
        recordDate: daysFromNow(-500),
        createdById: nimali.id,
      },
      {
        petId: bruno.id,
        type: 'MEDICATION',
        title: 'Monthly tick and flea prevention',
        description: 'Fluralaner chewable, 1 tablet every 12 weeks.',
        recordDate: daysFromNow(-70),
        nextDueDate: daysFromNow(14),
        createdById: nimali.id,
      },
      {
        petId: bruno.id,
        type: 'TREATMENT',
        title: 'Paw pad laceration cleaned and dressed',
        description:
          'Small cut on left front pad from broken glass. Cleaned, dressed, antibiotics for 5 days. Healed well.',
        recordDate: daysFromNow(-45),
        vetName: 'Dr. Anjali Wickramasinghe',
        clinicName: harbourview.name,
        createdById: drAnjali.id,
      },
      {
        petId: luna.id,
        type: 'VACCINATION',
        title: 'Feline tricat (FVRCP)',
        recordDate: daysFromNow(-355),
        nextDueDate: daysFromNow(10),
        vetName: 'Dr. Ruwan Senanayake',
        clinicName: greenPaws.name,
        createdById: drRuwan.id,
      },
      {
        petId: luna.id,
        type: 'SURGERY',
        title: 'Spay surgery',
        description: 'Routine ovariohysterectomy, uneventful recovery.',
        recordDate: daysFromNow(-600),
        vetName: 'Dr. Anjali Wickramasinghe',
        clinicName: harbourview.name,
        createdById: drAnjali.id,
      },
      {
        petId: rocky.id,
        type: 'VACCINATION',
        title: 'Anti-rabies vaccine',
        recordDate: daysFromNow(-390),
        nextDueDate: daysFromNow(-25),
        clinicName: hillside.name,
        createdById: kasun.id,
      },
      {
        petId: rocky.id,
        type: 'CHECKUP',
        title: 'Annual health check',
        description: 'Healthy weight. Mild tartar on back teeth – dental cleaning suggested.',
        recordDate: daysFromNow(-120),
        clinicName: hillside.name,
        createdById: kasun.id,
      },
      {
        petId: kitty.id,
        type: 'CHECKUP',
        title: 'Senior wellness blood panel',
        description: 'Kidney values slightly elevated. Recheck in 6 months, renal diet started.',
        recordDate: daysFromNow(-160),
        nextDueDate: daysFromNow(20),
        clinicName: hillside.name,
        createdById: kasun.id,
      },
      {
        petId: max.id,
        type: 'VACCINATION',
        title: 'Puppy vaccination – final dose',
        recordDate: daysFromNow(-300),
        nextDueDate: daysFromNow(65),
        clinicName: 'Lagoon Side Animal Clinic',
        createdById: tharushi.id,
      },
      {
        petId: max.id,
        type: 'MEDICATION',
        title: 'Deworming',
        description: 'Broad-spectrum dewormer.',
        recordDate: daysFromNow(-80),
        nextDueDate: daysFromNow(10),
        createdById: tharushi.id,
      },
    ],
  });

  // ── Consultations ──
  await prisma.consultation.createMany({
    data: [
      {
        petId: bruno.id,
        ownerId: nimali.id,
        vetId: drRuwan.id,
        clinicId: greenPaws.id,
        status: 'CONFIRMED',
        scheduledAt: daysFromNow(3, 16),
        reason: 'Annual vaccination booster and general check-up.',
      },
      {
        petId: luna.id,
        ownerId: nimali.id,
        vetId: drRuwan.id,
        clinicId: greenPaws.id,
        type: 'VIDEO',
        status: 'REQUESTED',
        scheduledAt: daysFromNow(6, 18),
        reason: 'Reduced appetite for two days, otherwise active.',
      },
      {
        petId: bruno.id,
        ownerId: nimali.id,
        vetId: drAnjali.id,
        clinicId: harbourview.id,
        status: 'COMPLETED',
        scheduledAt: daysFromNow(-45, 11),
        reason: 'Bleeding cut on front paw after a walk.',
        diagnosis: 'Superficial laceration of left front paw pad, no foreign body.',
        treatment: 'Wound flushed and dressed. Amoxicillin-clavulanate for 5 days.',
        vetNotes: 'Owner to keep dressing dry and return if swelling appears.',
        followUpAt: daysFromNow(-38, 11),
      },
      {
        petId: max.id,
        ownerId: tharushi.id,
        vetId: drAnjali.id,
        clinicId: harbourview.id,
        status: 'CONFIRMED',
        scheduledAt: daysFromNow(1, 9),
        reason: 'Limping on right hind leg after playing.',
      },
      {
        petId: rocky.id,
        ownerId: kasun.id,
        vetId: drAnjali.id,
        clinicId: harbourview.id,
        status: 'CANCELLED',
        scheduledAt: daysFromNow(-10, 14),
        reason: 'Dental cleaning consultation.',
      },
    ],
  });

  // No AI wound assessments are seeded: every stored result must come from the model.

  // ── Reviews (and cached rating totals on each clinic) ──
  const reviews = [
    {
      clinicId: harbourview.id,
      authorId: nimali.id,
      rating: 5,
      title: 'Calm and caring at midnight',
      comment:
        'Brought Bruno in late at night with a bleeding paw. Dr. Anjali explained everything clearly and the bill was itemised. Highly recommend.',
    },
    {
      clinicId: harbourview.id,
      authorId: tharushi.id,
      rating: 4,
      title: 'Excellent but busy',
      comment: 'Very professional team. Waiting time on a Saturday was about 45 minutes.',
    },
    {
      clinicId: greenPaws.id,
      authorId: nimali.id,
      rating: 5,
      title: 'Our regular clinic',
      comment:
        'Dr. Ruwan always remembers our pets and sends vaccination reminders. Clean and friendly.',
    },
    {
      clinicId: greenPaws.id,
      authorId: kasun.id,
      rating: 4,
      comment: 'Good advice on diet for my senior cat. Parking is limited.',
    },
    {
      clinicId: hillside.id,
      authorId: kasun.id,
      rating: 5,
      title: 'Fifteen years of trust',
      comment: 'They have looked after Rocky since we rescued him. Reasonable prices.',
    },
    {
      clinicId: clinicBySlug['lagoon-side-animal-clinic-negombo']!.id,
      authorId: tharushi.id,
      rating: 3,
      comment: 'Fine for vaccinations. Limited opening hours on weekends.',
    },
  ];
  await prisma.review.createMany({ data: reviews });
  for (const clinic of clinics) {
    const stats = await prisma.review.aggregate({
      where: { clinicId: clinic.id, status: 'APPROVED' },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.clinic.update({
      where: { id: clinic.id },
      data: { averageRating: stats._avg.rating ?? 0, reviewCount: stats._count },
    });
  }

  // ── Rescue reports ──
  await prisma.rescueReport.createMany({
    data: [
      {
        reporterId: tharushi.id,
        species: 'DOG',
        title: 'Injured puppy near bus stand',
        description:
          'Small brown puppy limping, appears to have a wound on the back leg. Staying under a parked tuk-tuk.',
        locationText: 'Negombo main bus stand, near the fruit stalls',
        city: 'Negombo',
        latitude: 7.2091,
        longitude: 79.8389,
        urgency: 'HIGH',
        status: 'OPEN',
        contactPhone: '0769876543',
      },
      {
        reporterId: nimali.id,
        assignedToId: rescuerHelping.id,
        species: 'CAT',
        title: 'Kittens abandoned in a box',
        description:
          'Three kittens, around 4 weeks old, left in a cardboard box beside the temple wall.',
        locationText: 'Behind Gangaramaya Temple car park',
        city: 'Colombo',
        latitude: 6.9167,
        longitude: 79.8565,
        urgency: 'CRITICAL',
        status: 'IN_PROGRESS',
      },
      {
        reporterId: kasun.id,
        assignedToId: rescuerKandy.id,
        species: 'DOG',
        title: 'Dog with skin infection',
        description: 'Adult female dog with severe hair loss and scratching, friendly with people.',
        locationText: 'Near Kandy Lake, Sangaraja Mawatha',
        city: 'Kandy',
        urgency: 'MEDIUM',
        status: 'RESCUED',
      },
      {
        reporterId: kasun.id,
        species: 'BIRD',
        title: 'Kingfisher with injured wing',
        description: 'Cannot fly, sitting on the ground near the river bank.',
        locationText: 'Peradeniya Botanical Gardens river side',
        city: 'Kandy',
        urgency: 'HIGH',
        status: 'OPEN',
      },
    ],
  });

  // ── Adoption listings ──
  const listings = await Promise.all(
    [
      {
        rescuerId: rescuerHelping.id,
        name: 'Coco',
        species: 'DOG' as const,
        breed: 'Mixed breed',
        sex: 'FEMALE' as const,
        ageGroup: 'YOUNG' as const,
        approxAgeMonths: 10,
        size: 'Medium',
        city: 'Colombo',
        description:
          'Coco is a playful, affectionate young dog who loves car rides and belly rubs. Walks well on a lead.',
        healthSummary: 'Vaccinated, dewormed and spayed. Healthy.',
        isVaccinated: true,
        isNeutered: true,
        goodWithChildren: true,
        goodWithPets: true,
      },
      {
        rescuerId: rescuerHelping.id,
        name: 'Shadow',
        species: 'CAT' as const,
        breed: 'Domestic Shorthair',
        sex: 'MALE' as const,
        ageGroup: 'ADULT' as const,
        approxAgeMonths: 36,
        size: 'Small',
        city: 'Colombo',
        description:
          'A calm black cat who enjoys quiet homes and sunny windowsills. Litter trained.',
        healthSummary: 'Neutered and vaccinated. FIV negative.',
        isVaccinated: true,
        isNeutered: true,
        goodWithChildren: true,
        goodWithPets: false,
      },
      {
        rescuerId: rescuerKandy.id,
        name: 'Sudu',
        species: 'DOG' as const,
        breed: 'Sri Lankan Mixed Breed',
        sex: 'FEMALE' as const,
        ageGroup: 'ADULT' as const,
        approxAgeMonths: 48,
        size: 'Medium',
        city: 'Kandy',
        description:
          'Rescued from the streets near Kandy Lake. Gentle and loyal, recovering well from a skin condition.',
        healthSummary: 'Mange treatment completed, coat regrowing. Vaccinated.',
        isVaccinated: true,
        isNeutered: true,
        goodWithChildren: true,
        goodWithPets: true,
      },
      {
        rescuerId: rescuerKandy.id,
        name: 'Pepper and Salt',
        species: 'CAT' as const,
        breed: 'Mixed',
        sex: 'UNKNOWN' as const,
        ageGroup: 'BABY' as const,
        approxAgeMonths: 3,
        size: 'Small',
        city: 'Kandy',
        description:
          'Two inseparable kittens looking to be adopted together. Curious, playful and very social.',
        healthSummary: 'First vaccination done. Second due in 3 weeks.',
        isVaccinated: false,
        isNeutered: false,
        goodWithChildren: true,
        goodWithPets: true,
      },
      {
        rescuerId: rescuerHelping.id,
        name: 'Tiger',
        species: 'DOG' as const,
        breed: 'Mixed breed',
        sex: 'MALE' as const,
        ageGroup: 'SENIOR' as const,
        approxAgeMonths: 108,
        size: 'Large',
        city: 'Dehiwala',
        description:
          'Tiger is a dignified senior who loves slow walks and naps. Perfect for a quiet household.',
        healthSummary: 'Mild arthritis managed with supplements.',
        isVaccinated: true,
        isNeutered: true,
        goodWithChildren: true,
        goodWithPets: false,
      },
      {
        rescuerId: rescuerHelping.id,
        name: 'Bella',
        species: 'DOG' as const,
        breed: 'Labrador mix',
        sex: 'FEMALE' as const,
        ageGroup: 'YOUNG' as const,
        approxAgeMonths: 14,
        size: 'Large',
        city: 'Colombo',
        description: 'Energetic and smart. Already knows sit and stay.',
        healthSummary: 'Vaccinated and spayed.',
        isVaccinated: true,
        isNeutered: true,
        goodWithChildren: true,
        goodWithPets: true,
        status: 'ADOPTED' as const,
      },
    ].map((listing) => prisma.adoptionListing.create({ data: listing })),
  );
  const [coco, shadow] = listings;

  await prisma.adoptionApplication.createMany({
    data: [
      {
        listingId: coco!.id,
        applicantId: tharushi.id,
        message:
          'We have a large garden and Max would love a companion. I work from home three days a week.',
        homeType: 'House with garden',
        hasOtherPets: true,
        hasChildren: false,
        contactPhone: '0769876543',
        status: 'UNDER_REVIEW',
      },
      {
        listingId: shadow!.id,
        applicantId: kasun.id,
        message: 'Looking for a calm cat to keep Mimi company in her senior years.',
        homeType: 'House',
        hasOtherPets: true,
        hasChildren: true,
        contactPhone: '0712345678',
        status: 'SUBMITTED',
      },
    ],
  });
  await prisma.adoptionListing.update({ where: { id: coco!.id }, data: { status: 'PENDING' } });

  // No chat history is seeded: every assistant answer must come from the knowledge base.

  const counts = {
    users: await prisma.user.count(),
    clinics: await prisma.clinic.count(),
    pets: await prisma.pet.count(),
    healthRecords: await prisma.healthRecord.count(),
    consultations: await prisma.consultation.count(),
    reviews: await prisma.review.count(),
    rescueReports: await prisma.rescueReport.count(),
    adoptionListings: await prisma.adoptionListing.count(),
  };
  console.warn('Seed complete:', counts);
  console.warn(
    `Admin login: ${admin.email} (all demo accounts share the documented demo password)`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
