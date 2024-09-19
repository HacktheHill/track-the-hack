import { createTRPCRouter, publicProcedure } from "../trpc";

export const metricsRoute = createTRPCRouter({
  getMetrics: publicProcedure.query(async ({ ctx }) => {
    // Overall metrics
    const applied = await ctx.prisma.hacker.count();
    const confirmed = await ctx.prisma.hacker.count({ where: { confirmed: true } });
    const checkedIn = await ctx.prisma.presence.count();
    const walkIn = await ctx.prisma.hacker.count({ where: { walkIn: true } });

    // Gender distribution
    const genderData = await ctx.prisma.hacker.groupBy({
      by: ['gender'],
      _count: { gender: true },
    });

    // Ethnicity distribution
    const ethnicityData = await ctx.prisma.hacker.groupBy({
      by: ['raceEthnicity'],
      _count: { raceEthnicity: true },
    });

    // Age distribution
    const ageData = await ctx.prisma.hacker.groupBy({
      by: ['age'],
      _count: { age: true },
    });

    // Location distribution 
    const locationData = await ctx.prisma.hacker.groupBy({
      by: ['travelOrigin'],
      _count: { travelOrigin: true },
    });

    // Year of Study distribution 
    const yearData = await ctx.prisma.hacker.groupBy({
      by: ['educationLevel'],
      _count: { educationLevel: true },
    });

    // Attendance count 
    const attendanceData = await ctx.prisma.presence.groupBy({
      by: ['label'],
      _sum: { value: true },
    });

    // Referral Source distribution
    const referralSourceData = await ctx.prisma.hacker.groupBy({
      by: ['referralSource'],
      _count: { referralSource: true },
    });

    // Majors distribution
    const majorData = await ctx.prisma.hacker.groupBy({
      by: ['major'],
      _count: { major: true },
    });

    return {
      applied,
      confirmed,
      checkedIn,
      walkIn,
      genderData,
      ethnicityData,
      ageData,
      locationData,
      yearData,
      attendanceData,
      referralSourceData,
      majorData,
    };
  }),
});