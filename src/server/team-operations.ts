import { AcceptanceStatus, Prisma, TeamRequestStatus, type PrismaClient } from "@prisma/client";

export class TeamOperationError extends Error {}

type Context = { prisma: PrismaClient | Db };
type Db = Prisma.TransactionClient;
type Side = "requester" | "owner";
const openStatuses: TeamRequestStatus[] = [TeamRequestStatus.INTERESTED, TeamRequestStatus.OFFERED];

const hackerSelect = {
	id: true,
	firstName: true,
	lastName: true,
	acceptanceStatus: true,
	Team: {
		select: {
			id: true,
			name: true,
			captainHackerId: true,
			hackers: { select: { id: true } },
		},
	},
} satisfies Prisma.HackerSelect;

export async function resolveAcceptedHacker(db: Db, discordId: string) {
	const account = await db.account.findUnique({
		where: { provider_providerAccountId: { provider: "discord", providerAccountId: discordId } },
		select: { user: { select: { Hacker: { select: hackerSelect } } } },
	});
	const hacker = account?.user.Hacker;
	if (!hacker || hacker.acceptanceStatus !== AcceptanceStatus.ACCEPTED) {
		throw new TeamOperationError("Discord account does not identify an accepted hacker");
	}
	return hacker;
}

async function authorizedParty(db: Db, discordId: string) {
	const hacker = await resolveAcceptedHacker(db, discordId);
	if (!hacker.Team) return { hacker, teamId: null };
	if (!hacker.Team.captainHackerId) {
		throw new TeamOperationError("Team does not have an assigned captain");
	}
	if (hacker.Team.captainHackerId !== hacker.id)
		throw new TeamOperationError("Only the team captain can do this action");
	return { hacker, teamId: hacker.Team.id };
}

function sourceWhere(hackerId: string, teamId: string | null) {
	return teamId ? { sourceTeamId: teamId } : { sourceTeamId: null, createdByHackerId: hackerId };
}

function targetWhere(hackerId: string, teamId: string | null) {
	return teamId ? { targetTeamId: teamId } : { targetTeamId: null, targetHackerId: hackerId };
}

function assertParty(
	request: {
		createdByHackerId: string;
		sourceTeamId: string | null;
		targetHackerId: string;
		targetTeamId: string | null;
	},
	actor: { hacker: { id: string }; teamId: string | null },
	side: Side,
) {
	const allowed = partyMatches(request, actor, side);
	if (!allowed) throw new TeamOperationError(`Only the ${side} party can do this action`);
}

function partyMatches(
	request: {
		createdByHackerId: string;
		sourceTeamId: string | null;
		targetHackerId: string;
		targetTeamId: string | null;
	},
	actor: { hacker: { id: string }; teamId: string | null },
	side: Side,
) {
	return side === "requester"
		? request.sourceTeamId
			? request.sourceTeamId === actor.teamId
			: actor.teamId === null && request.createdByHackerId === actor.hacker.id
		: request.targetTeamId
			? request.targetTeamId === actor.teamId
			: actor.teamId === null && request.targetHackerId === actor.hacker.id;
}

async function inTransaction<T>(ctx: Context, action: (db: Db) => Promise<T>) {
	if (!("$transaction" in ctx.prisma)) return action(ctx.prisma);
	return ctx.prisma.$transaction(action, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createOrReuseInterest(
	ctx: Context,
	input: {
		actorDiscordId: string;
		targetDiscordId: string;
		listingDiscordThreadId: string;
		conversationDiscordThreadId: string;
	},
) {
	return inTransaction(ctx, async db => {
		const actor = await authorizedParty(db, input.actorDiscordId);
		const target = await resolveAcceptedHacker(db, input.targetDiscordId);
		const targetTeamId = target.Team?.id ?? null;
		if (actor.hacker.id === target.id || (actor.teamId && actor.teamId === targetTeamId)) {
			throw new TeamOperationError("A party cannot contact itself");
		}
		const party = { ...sourceWhere(actor.hacker.id, actor.teamId), ...targetWhere(target.id, targetTeamId) };
		const existingConversation = await db.teamRequest.findUnique({
			where: { conversationDiscordThreadId: input.conversationDiscordThreadId },
		});
		if (existingConversation) {
			if (
				existingConversation.listingDiscordThreadId !== input.listingDiscordThreadId ||
				!Object.entries(party).every(
					([key, value]) => existingConversation[key as keyof typeof existingConversation] === value,
				)
			) {
				throw new TeamOperationError("Conversation thread belongs to a different request");
			}
			return existingConversation;
		}
		const existingPartyRequest = await db.teamRequest.findFirst({
			where: { listingDiscordThreadId: input.listingDiscordThreadId, ...party, status: { in: openStatuses } },
		});
		return (
			existingPartyRequest ??
			db.teamRequest.create({
				data: {
					listingDiscordThreadId: input.listingDiscordThreadId,
					conversationDiscordThreadId: input.conversationDiscordThreadId,
					createdByHackerId: actor.hacker.id,
					sourceTeamId: actor.teamId,
					targetHackerId: target.id,
					targetTeamId,
				},
			})
		);
	});
}

function rankingWhere(actor: { hacker: { id: string }; teamId: string | null }, side: Side) {
	return side === "requester"
		? sourceWhere(actor.hacker.id, actor.teamId)
		: targetWhere(actor.hacker.id, actor.teamId);
}

function sortByRank<T extends { createdAt: Date; requesterRank: number | null; ownerRank: number | null }>(
	requests: T[],
	side: Side,
) {
	const field = side === "requester" ? "requesterRank" : "ownerRank";
	return requests.sort((left, right) => {
		const rankDifference = (left[field] ?? Number.MAX_SAFE_INTEGER) - (right[field] ?? Number.MAX_SAFE_INTEGER);
		return rankDifference || left.createdAt.getTime() - right.createdAt.getTime();
	});
}

type RequestParty = {
	createdByHackerId: string;
	sourceTeamId: string | null;
	targetHackerId: string;
	targetTeamId: string | null;
};

function requestPartyWhere(request: RequestParty, side: Side) {
	return side === "requester"
		? sourceWhere(request.createdByHackerId, request.sourceTeamId)
		: targetWhere(request.targetHackerId, request.targetTeamId);
}

async function compactActiveRanks(db: Db, request: RequestParty) {
	for (const side of ["requester", "owner"] as const) {
		const requests = sortByRank(
			await db.teamRequest.findMany({
				where: { ...requestPartyWhere(request, side), status: { in: openStatuses } },
				orderBy: { createdAt: "asc" },
			}),
			side,
		);
		const field = side === "requester" ? "requesterRank" : "ownerRank";
		for (const [index, item] of requests.entries()) {
			if (item[field] !== index + 1) {
				await db.teamRequest.update({ where: { id: item.id }, data: { [field]: index + 1 } });
			}
		}
	}
}

async function closeOpenRequestsForParty(
	db: Db,
	party: { hackerId: string; teamId: string | null },
	exceptRequestId: string,
) {
	const [asRequester, asOwner] = await Promise.all([
		db.teamRequest.findMany({
			where: { ...sourceWhere(party.hackerId, party.teamId), status: { in: openStatuses } },
		}),
		db.teamRequest.findMany({
			where: { ...targetWhere(party.hackerId, party.teamId), status: { in: openStatuses } },
		}),
	]);
	const requesterIds = new Set(asRequester.map(item => item.id));
	const affected = new Map([...asRequester, ...asOwner].map(item => [item.id, item]));
	for (const request of affected.values()) {
		if (request.id === exceptRequestId) continue;
		const status = requesterIds.has(request.id) ? TeamRequestStatus.DECLINED : TeamRequestStatus.REJECTED;
		const changed = await db.teamRequest.updateMany({
			where: { id: request.id, status: { in: openStatuses } },
			data: { status },
		});
		if (changed.count === 1) await compactActiveRanks(db, request);
	}
}

export async function setRank(
	ctx: Context,
	input: {
		actorDiscordId: string;
		requestId: string;
		position: number;
	},
) {
	return inTransaction(ctx, async db => {
		const actor = await authorizedParty(db, input.actorDiscordId);
		const request = await db.teamRequest.findUnique({ where: { id: input.requestId } });
		if (!request) throw new TeamOperationError("Team request not found");
		const requester = partyMatches(request, actor, "requester");
		const owner = partyMatches(request, actor, "owner");
		if (requester === owner) throw new TeamOperationError("Actor must match exactly one request party");
		const actorSide: Side = requester ? "requester" : "owner";
		if (!openStatuses.includes(request.status)) throw new TeamOperationError("Only open requests can be ranked");
		const requests = sortByRank(
			await db.teamRequest.findMany({
				where: { ...rankingWhere(actor, actorSide), status: { in: openStatuses } },
				orderBy: { createdAt: "asc" },
			}),
			actorSide,
		);
		if (input.position < 1 || input.position > requests.length)
			throw new TeamOperationError("Rank is outside the request list");
		const ordered = requests.filter(item => item.id !== request.id);
		ordered.splice(input.position - 1, 0, request);
		const field = actorSide === "requester" ? "requesterRank" : "ownerRank";
		for (const [index, item] of ordered.entries()) {
			await db.teamRequest.update({ where: { id: item.id }, data: { [field]: index + 1 } });
		}
		return ordered.map((item, index) => ({ id: item.id, rank: index + 1 }));
	});
}

const rankingInclude = {
	createdByHacker: { select: { id: true, firstName: true, lastName: true } },
	sourceTeam: { select: { id: true, name: true } },
	targetHacker: { select: { id: true, firstName: true, lastName: true } },
	targetTeam: { select: { id: true, name: true } },
} satisfies Prisma.TeamRequestInclude;

export async function listRankings(ctx: Context, input: { actorDiscordId: string; side: Side }) {
	return inTransaction(ctx, async db => {
		const actor = await authorizedParty(db, input.actorDiscordId);
		const requests = await db.teamRequest.findMany({
			where: { ...rankingWhere(actor, input.side), status: { in: openStatuses } },
			include: rankingInclude,
			orderBy: { createdAt: "asc" },
		});
		return sortByRank(requests, input.side);
	});
}

async function changeStatus(
	ctx: Context,
	input: {
		actorDiscordId: string;
		requestId: string;
		side: Side;
		from: TeamRequestStatus[];
		to: TeamRequestStatus;
	},
) {
	return inTransaction(ctx, async db => {
		const actor = await authorizedParty(db, input.actorDiscordId);
		const request = await db.teamRequest.findUnique({ where: { id: input.requestId } });
		if (!request) throw new TeamOperationError("Team request not found");
		assertParty(request, actor, input.side);
		const changed = await db.teamRequest.updateMany({
			where: { id: request.id, status: { in: input.from } },
			data: { status: input.to },
		});
		if (changed.count !== 1) throw new TeamOperationError("Request is no longer open");
		await compactActiveRanks(db, request);
		return db.teamRequest.findUniqueOrThrow({ where: { id: request.id } });
	});
}

export const offerRequest = (ctx: Context, input: { actorDiscordId: string; requestId: string }) =>
	changeStatus(ctx, { ...input, side: "owner", from: [TeamRequestStatus.INTERESTED], to: TeamRequestStatus.OFFERED });
export const rejectRequest = (ctx: Context, input: { actorDiscordId: string; requestId: string }) =>
	changeStatus(ctx, { ...input, side: "owner", from: openStatuses, to: TeamRequestStatus.REJECTED });
export const declineRequest = (ctx: Context, input: { actorDiscordId: string; requestId: string }) =>
	changeStatus(ctx, { ...input, side: "requester", from: openStatuses, to: TeamRequestStatus.DECLINED });

const memberSelect = {
	id: true,
	firstName: true,
	lastName: true,
	User: { select: { accounts: { where: { provider: "discord" }, select: { providerAccountId: true } } } },
} satisfies Prisma.HackerSelect;

async function teamResult(db: Db, teamId: string) {
	const team = await db.team.findUniqueOrThrow({
		where: { id: teamId },
		select: { id: true, name: true, captainHackerId: true, hackers: { select: memberSelect } },
	});
	return {
		id: team.id,
		name: team.name,
		captainHackerId: team.captainHackerId,
		members: team.hackers.map(member => ({
			id: member.id,
			firstName: member.firstName,
			lastName: member.lastName,
			name: `${member.firstName} ${member.lastName}`,
			discordId: member.User?.accounts[0]?.providerAccountId ?? null,
		})),
	};
}

export async function resolveParty(ctx: Context, discordId: string) {
	return inTransaction(ctx, async db => {
		const hacker = await resolveAcceptedHacker(db, discordId);
		return {
			hacker: { id: hacker.id, name: `${hacker.firstName} ${hacker.lastName}`, discordId },
			team: hacker.Team ? await teamResult(db, hacker.Team.id) : null,
		};
	});
}

export async function acceptRequest(
	ctx: Context,
	input: {
		actorDiscordId: string;
		requestId: string;
		teamName?: string;
	},
) {
	return inTransaction(ctx, async db => {
		const actor = await authorizedParty(db, input.actorDiscordId);
		const request = await db.teamRequest.findUnique({
			where: { id: input.requestId },
			include: { targetHacker: { select: hackerSelect } },
		});
		if (!request) throw new TeamOperationError("Team request not found");
		assertParty(request, actor, "requester");
		if (request.status !== TeamRequestStatus.OFFERED) throw new TeamOperationError("Request must be OFFERED");
		if (request.sourceTeamId !== actor.teamId) throw new TeamOperationError("Requester party changed teams");
		if (request.targetTeamId !== (request.targetHacker.Team?.id ?? null)) {
			throw new TeamOperationError("Listing owner party changed teams");
		}

		const sourceTeam = actor.hacker.Team;
		const targetTeam = request.targetHacker.Team;
		const memberIds = new Set([
			...(sourceTeam?.hackers.map(member => member.id) ?? [actor.hacker.id]),
			...(targetTeam?.hackers.map(member => member.id) ?? [request.targetHacker.id]),
		]);
		if (memberIds.size > 4) throw new TeamOperationError("A team cannot have more than four hackers");
		const changed = await db.teamRequest.updateMany({
			where: { id: request.id, status: TeamRequestStatus.OFFERED },
			data: { status: TeamRequestStatus.ACCEPTED },
		});
		if (changed.count !== 1) throw new TeamOperationError("Request was already processed");
		await compactActiveRanks(db, request);

		if (sourceTeam && targetTeam) {
			await closeOpenRequestsForParty(db, { hackerId: actor.hacker.id, teamId: sourceTeam.id }, request.id);
		} else if (sourceTeam) {
			await closeOpenRequestsForParty(db, { hackerId: request.targetHacker.id, teamId: null }, request.id);
		} else if (targetTeam) {
			await closeOpenRequestsForParty(db, { hackerId: actor.hacker.id, teamId: null }, request.id);
		} else {
			await closeOpenRequestsForParty(db, { hackerId: actor.hacker.id, teamId: null }, request.id);
			await closeOpenRequestsForParty(db, { hackerId: request.targetHacker.id, teamId: null }, request.id);
		}

		let teamId: string;
		if (targetTeam) {
			teamId = targetTeam.id;
			if (sourceTeam && sourceTeam.id !== targetTeam.id) {
				await db.team.update({ where: { id: sourceTeam.id }, data: { captainHackerId: null } });
				await db.hacker.updateMany({ where: { teamId: sourceTeam.id }, data: { teamId } });
				await db.team.delete({ where: { id: sourceTeam.id } });
			} else if (!sourceTeam) {
				await db.hacker.update({ where: { id: actor.hacker.id }, data: { teamId } });
			}
		} else if (sourceTeam) {
			teamId = sourceTeam.id;
			await db.hacker.update({ where: { id: request.targetHacker.id }, data: { teamId } });
		} else {
			const name = input.teamName?.trim();
			if (!name || name.length < 3 || name.length > 50) {
				throw new TeamOperationError("A new team name must have 3 to 50 characters");
			}
			const team = await db.team.create({
				data: {
					name,
					captainHackerId: request.targetHacker.id,
					hackers: { connect: [...memberIds].map(id => ({ id })) },
				},
			});
			teamId = team.id;
		}
		return { requestId: request.id, status: TeamRequestStatus.ACCEPTED, team: await teamResult(db, teamId) };
	});
}

export async function assignHackerToTeam(ctx: Context, hackerId: string, rawName: string) {
	const name = rawName.trim();
	if (name.length < 3 || name.length > 50) throw new TeamOperationError("A team name must have 3 to 50 characters");
	return inTransaction(ctx, async db => {
		const hacker = await db.hacker.findUnique({ where: { id: hackerId }, select: { id: true, teamId: true } });
		if (!hacker) throw new TeamOperationError("Hacker not found");
		let team = await db.team.findUnique({
			where: { name },
			select: { id: true, name: true, captainHackerId: true, _count: { select: { hackers: true } } },
		});
		if (team?.id === hacker.teamId) return teamResult(db, team.id);
		if (team && team._count.hackers >= 4) throw new TeamOperationError("A team cannot have more than four hackers");
		if (hacker.teamId) {
			await db.team.updateMany({
				where: { id: hacker.teamId, captainHackerId: hacker.id },
				data: { captainHackerId: null },
			});
		}
		if (!team) {
			team = await db.team.create({
				data: { name, captainHackerId: hacker.id },
				select: { id: true, name: true, captainHackerId: true, _count: { select: { hackers: true } } },
			});
		}
		await db.hacker.update({ where: { id: hacker.id }, data: { teamId: team.id } });
		if (hacker.teamId && hacker.teamId !== team.id) {
			await db.team.deleteMany({ where: { id: hacker.teamId, hackers: { none: {} } } });
		}
		return teamResult(db, team.id);
	});
}

export async function removeHackerFromTeam(ctx: Context, hackerId: string) {
	return inTransaction(ctx, async db => {
		const hacker = await db.hacker.findUnique({ where: { id: hackerId }, select: { teamId: true } });
		if (!hacker?.teamId) return;
		await db.team.updateMany({
			where: { id: hacker.teamId, captainHackerId: hackerId },
			data: { captainHackerId: null },
		});
		await db.hacker.update({ where: { id: hackerId }, data: { teamId: null } });
		await db.team.deleteMany({ where: { id: hacker.teamId, hackers: { none: {} } } });
	});
}
