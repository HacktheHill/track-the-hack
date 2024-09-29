import { createTRPCRouter, publicProcedure } from "../trpc";

const categorizeAge = (age: number) => {
	if (age >= 15 && age <= 17) return "15-17";
	if (age >= 18 && age <= 20) return "18-20";
	if (age >= 21 && age <= 23) return "21-23";
	if (age >= 24 && age <= 25) return "24-25";
	if (age >= 26 && age <= 30) return "26-30";
	if (age > 30) return "30+";
	return "Unknown";
};

const ORGANIZER_COUNT = 59;
const MENTOR_COUNT = 7;
const SPONSOR_COUNT = 23;
const GUEST_COUNT = 4;

export const metricsRouter = createTRPCRouter({
	getMetrics: publicProcedure.query(async ({ ctx }) => {
		const threshold = 3;

		// Overall metrics
		const applied = await ctx.prisma.hacker.count();
		const confirmed = await ctx.prisma.hacker.count({ where: { confirmed: true } });
		const checkedIn = await ctx.prisma.presence.count({ where: { label: "Check-In" } });
		const walkIn = await ctx.prisma.hacker.count({ where: { walkIn: true } });
		const presences = (
			await ctx.prisma.presence.findMany({
				select: {
					value: true,
				},
			})
		).reduce((sum, presence) => sum + presence.value, 0);
		const attendees =
			(await ctx.prisma.hacker.count({ where: { confirmed: true } })) +
			(await ctx.prisma.hacker.count({ where: { walkIn: true } })) +
			ORGANIZER_COUNT +
			MENTOR_COUNT +
			SPONSOR_COUNT +
			GUEST_COUNT;

		// Attendance distribution
		const attendanceData = await ctx.prisma.presence.groupBy({
			by: ["label"],
			_sum: { value: true },
			having: {
				label: { _count: { gte: threshold * 10 } },
			},
		});

		// Gender distribution
		const genderData = await ctx.prisma.hacker.groupBy({
			by: ["gender"],
			_count: { gender: true },
			having: {
				gender: { _count: { gte: threshold } },
			},
		});

		// Ethnicity distribution
		const ethnicityData = await ctx.prisma.hacker.groupBy({
			by: ["raceEthnicity"],
			_count: { raceEthnicity: true },
			having: {
				raceEthnicity: { _count: { gte: threshold } },
			},
		});

		// Age distribution
		const rawAgeData = await ctx.prisma.hacker.groupBy({
			by: ["age"],
			_count: { age: true },
		});
		const ageData = rawAgeData
			.reduce<{ _count: Record<string, number>; age: string }[]>((acc, item) => {
				const age = item.age || 0;
				const category = categorizeAge(age);
				const existingCategory = acc.find(i => i.age === category);
				if (existingCategory?._count.age) {
					existingCategory._count.age += item._count.age;
				} else {
					acc.push({ _count: { age: item._count.age }, age: category });
				}
				return acc;
			}, [])
			.filter(item => (item._count.age || 0) >= threshold);

		// Location distribution
		const locationData = await ctx.prisma.hacker.groupBy({
			by: ["travelOrigin"],
			_count: { travelOrigin: true },
			having: {
				travelOrigin: { _count: { gte: threshold } },
			},
		});

		// Education Level distribution
		const levelData = await ctx.prisma.hacker.groupBy({
			by: ["educationLevel"],
			_count: { educationLevel: true },
			having: {
				educationLevel: { _count: { gte: threshold } },
			},
		});

		// Referral Source distribution
		const referralSourceData = await ctx.prisma.hacker.groupBy({
			by: ["referralSource"],
			_count: { referralSource: true },
			having: {
				referralSource: { _count: { gte: threshold } },
			},
		});

		// Majors distribution
		const majorData = await ctx.prisma.hacker.groupBy({
			by: ["major"],
			_count: { major: true },
			having: {
				major: { _count: { gte: threshold } },
			},
		});

		return {
			applied,
			attendees,
			confirmed,
			checkedIn,
			walkIn,
			presences,
			genderData,
			ethnicityData,
			ageData,
			locationData,
			levelData,
			attendanceData,
			referralSourceData,
			majorData,
		};
	}),
});
