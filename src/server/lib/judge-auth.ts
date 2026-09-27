import type { PrismaClient } from "@prisma/client";
import { normalizeOrganizerEmail } from "@/server/lib/organizer-auth";

type JudgeAccessPrisma = Pick<PrismaClient, "judgingJudge" | "user">;

export type JudgeAccessContext = {
	id: string;
	roundId: string;
	name: string;
	email: string;
};

export const isJudgeEmailAllowed = async (prisma: Pick<PrismaClient, "judgingJudge">, rawEmail: string) => {
	const email = normalizeOrganizerEmail(rawEmail);
	return (
		(await prisma.judgingJudge.findFirst({
			where: { email, round: { state: { in: ["OPEN", "LOCKED"] } } },
			select: { id: true },
		})) !== null
	);
};

export const getJudgeAccess = async (prisma: JudgeAccessPrisma, userId: string): Promise<JudgeAccessContext | null> => {
	const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, disabledAt: true } });
	if (!user?.email || user.disabledAt) return null;
	const judges = await prisma.judgingJudge.findMany({
		where: { email: normalizeOrganizerEmail(user.email), round: { state: { in: ["OPEN", "LOCKED"] } } },
		select: {
			id: true,
			roundId: true,
			name: true,
			email: true,
			round: { select: { state: true, openedAt: true } },
		},
		orderBy: { createdAt: "desc" },
	});
	const judge = judges.sort((a, b) => {
		if (a.round.state !== b.round.state) return a.round.state === "OPEN" ? -1 : 1;
		return (b.round.openedAt?.getTime() ?? 0) - (a.round.openedAt?.getTime() ?? 0);
	})[0];
	return judge ? { ...judge, email: normalizeOrganizerEmail(judge.email) } : null;
};
