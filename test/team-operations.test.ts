import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { AcceptanceStatus, TeamRequestStatus, type PrismaClient } from "@prisma/client";

import { ensureDiscordAccountCanLink, verifyDiscordLinkProof } from "../src/server/discord-identity";
import { runInternalRequest } from "../src/server/internal-api";
import {
	TeamOperationError,
	acceptRequest,
	offerRequest,
	rejectRequest,
	resolveParty,
	setRank,
} from "../src/server/team-operations";

type Hacker = {
	id: string;
	firstName: string;
	lastName: string;
	acceptanceStatus: AcceptanceStatus;
	teamId: string | null;
	userId: string;
	discordId: string;
};
type Team = { id: string; name: string; captainHackerId: string | null };
type Request = {
	id: string;
	listingDiscordThreadId: string;
	conversationDiscordThreadId: string;
	createdByHackerId: string;
	sourceTeamId: string | null;
	targetHackerId: string;
	targetTeamId: string | null;
	requesterRank: number | null;
	ownerRank: number | null;
	status: TeamRequestStatus;
	createdAt: Date;
	updatedAt: Date;
};
type State = { hackers: Hacker[]; teams: Team[]; requests: Request[] };

const hacker = (id: string, teamId: string | null = null): Hacker => ({
	id,
	firstName: `First-${id}`,
	lastName: `Last-${id}`,
	acceptanceStatus: AcceptanceStatus.ACCEPTED,
	teamId,
	userId: `user-${id}`,
	discordId: `${10000000000000000n + BigInt(id.replace(/\D/g, "") || "0")}`,
});
const request = (
	id: string,
	createdByHackerId: string,
	targetHackerId: string,
	overrides: Partial<Request> = {},
): Request => ({
	id,
	listingDiscordThreadId: "20000000000000001",
	conversationDiscordThreadId: `3000000000000000${id.replace(/\D/g, "") || "0"}`,
	createdByHackerId,
	sourceTeamId: null,
	targetHackerId,
	targetTeamId: null,
	requesterRank: null,
	ownerRank: null,
	status: TeamRequestStatus.INTERESTED,
	createdAt: new Date(`2026-01-01T00:00:0${id.replace(/\D/g, "") || "0"}.000Z`),
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
	...overrides,
});

function context(state: State) {
	let nextTeam = 1;
	let nextRequest = 1;
	const teamMembers = (teamId: string) => state.hackers.filter(item => item.teamId === teamId);
	const teamView = (team: Team) => ({
		...team,
		hackers: teamMembers(team.id).map(item => ({
			...item,
			User: { accounts: [{ providerAccountId: item.discordId }] },
		})),
		_count: { hackers: teamMembers(team.id).length },
	});
	const hackerView = (item: Hacker) => ({
		...item,
		Team: item.teamId ? teamView(state.teams.find(team => team.id === item.teamId)!) : null,
	});
	const decoratedRequest = (item: Request) => ({
		...item,
		createdByHacker: state.hackers.find(h => h.id === item.createdByHackerId)!,
		targetHacker: hackerView(state.hackers.find(h => h.id === item.targetHackerId)!),
		sourceTeam: item.sourceTeamId ? state.teams.find(team => team.id === item.sourceTeamId)! : null,
		targetTeam: item.targetTeamId ? state.teams.find(team => team.id === item.targetTeamId)! : null,
	});
	const matches = (item: Record<string, unknown>, where: Record<string, any>): boolean =>
		Object.entries(where).every(([field, expected]) => {
			if (field === "hackers") {
				const members = teamMembers(item.id as string);
				if (expected.some) return members.some(member => matches(member, expected.some));
				if (expected.none) return members.length === 0;
			}
			const actual = item[field];
			if (expected && typeof expected === "object" && "in" in expected) return expected.in.includes(actual);
			return actual === expected;
		});

	const db: any = {
		account: {
			findUnique: async ({ where, select }: any) => {
				const key = where.provider_providerAccountId;
				const found = state.hackers.find(
					item => key?.provider === "discord" && item.discordId === key.providerAccountId,
				);
				if (!found) return null;
				if (select?.user) return { user: { Hacker: hackerView(found) } };
				return {
					id: `account-${found.id}`,
					userId: found.userId,
					provider: "discord",
					providerAccountId: found.discordId,
				};
			},
			findFirst: async ({ where }: any) => {
				const found = state.hackers.find(item => item.userId === where.userId);
				return found ? { providerAccountId: found.discordId } : null;
			},
		},
		team: {
			findUnique: async ({ where }: any) => {
				const found = state.teams.find(item => (where.id ? item.id === where.id : item.name === where.name));
				return found ? teamView(found) : null;
			},
			findUniqueOrThrow: async ({ where }: any) => {
				const found = state.teams.find(item => item.id === where.id);
				if (!found) throw new Error("Team not found");
				return teamView(found);
			},
			updateMany: async ({ where, data }: any) => {
				const found = state.teams.filter(item => matches(item, where));
				found.forEach(item => Object.assign(item, data));
				return { count: found.length };
			},
			update: async ({ where, data }: any) => {
				const found = state.teams.find(item => item.id === where.id)!;
				Object.assign(found, data);
				return teamView(found);
			},
			create: async ({ data }: any) => {
				const created: Team = {
					id: `new-team-${nextTeam++}`,
					name: data.name,
					captainHackerId: data.captainHackerId,
				};
				state.teams.push(created);
				for (const connected of [data.hackers?.connect ?? []].flat()) {
					state.hackers.find(item => item.id === connected.id)!.teamId = created.id;
				}
				return teamView(created);
			},
			delete: async ({ where }: any) => {
				const index = state.teams.findIndex(item => item.id === where.id);
				const [deleted] = state.teams.splice(index, 1);
				state.requests.forEach(item => {
					if (item.sourceTeamId === where.id) item.sourceTeamId = null;
					if (item.targetTeamId === where.id) item.targetTeamId = null;
				});
				return deleted;
			},
			deleteMany: async ({ where }: any) => {
				const ids = state.teams.filter(item => matches(item, where)).map(item => item.id);
				state.teams = state.teams.filter(item => !ids.includes(item.id));
				return { count: ids.length };
			},
		},
		hacker: {
			findUnique: async ({ where }: any) => state.hackers.find(item => matches(item, where)) ?? null,
			update: async ({ where, data }: any) => {
				const found = state.hackers.find(item => item.id === where.id)!;
				Object.assign(found, data);
				return found;
			},
			updateMany: async ({ where, data }: any) => {
				const found = state.hackers.filter(item => matches(item, where));
				found.forEach(item => Object.assign(item, data));
				return { count: found.length };
			},
		},
		teamRequest: {
			findUnique: async ({ where }: any) => {
				const found = state.requests.find(item => matches(item, where));
				return found ? decoratedRequest(found) : null;
			},
			findUniqueOrThrow: async ({ where }: any) =>
				decoratedRequest(state.requests.find(item => matches(item, where))!),
			findFirst: async ({ where }: any) => {
				const found = state.requests.find(item => matches(item, where));
				return found ? decoratedRequest(found) : null;
			},
			findMany: async ({ where }: any) =>
				state.requests.filter(item => matches(item, where)).map(decoratedRequest),
			create: async ({ data }: any) => {
				const created = request(`new-${nextRequest++}`, data.createdByHackerId, data.targetHackerId, data);
				state.requests.push(created);
				return decoratedRequest(created);
			},
			update: async ({ where, data }: any) => {
				const found = state.requests.find(item => matches(item, where))!;
				Object.assign(found, data);
				return decoratedRequest(found);
			},
			updateMany: async ({ where, data }: any) => {
				const found = state.requests.filter(item => matches(item, where));
				found.forEach(item => Object.assign(item, data));
				return { count: found.length };
			},
		},
	};
	const prisma = {
		...db,
		$transaction: async (action: (transaction: any) => Promise<unknown>) => {
			const snapshot = structuredClone(state);
			try {
				return await action(db);
			} catch (error) {
				state.hackers = snapshot.hackers;
				state.teams = snapshot.teams;
				state.requests = snapshot.requests;
				throw error;
			}
		},
	} as unknown as PrismaClient;
	return { prisma };
}

test("validates signed Discord identity and resolves only accepted hackers", async () => {
	const secret = "a".repeat(32);
	const proof = { discordId: "10000000000000001", timestamp: "1767225600", signature: "" };
	proof.signature = createHmac("sha256", secret).update(`verify:${proof.timestamp}:${proof.discordId}`).digest("hex");
	assert.doesNotThrow(() => verifyDiscordLinkProof(secret, proof, 1767225600));
	assert.throws(() => verifyDiscordLinkProof(secret, { ...proof, discordId: "10000000000000002" }, 1767225600));
	assert.throws(() => verifyDiscordLinkProof(secret, proof, 1767226001));

	const state: State = { hackers: [hacker("1")], teams: [], requests: [] };
	const party = await resolveParty(context(state), state.hackers[0]!.discordId);
	assert.equal(party.hacker.id, "1");
	state.hackers[0]!.acceptanceStatus = AcceptanceStatus.REJECTED;
	await assert.rejects(() => resolveParty(context(state), state.hackers[0]!.discordId), TeamOperationError);
});

test("does not permit a Discord mapping to transfer between users", async () => {
	const state: State = { hackers: [hacker("1")], teams: [], requests: [] };
	const db = context(state).prisma;
	await assert.rejects(
		() => ensureDiscordAccountCanLink(db, "different-user", state.hackers[0]!.discordId),
		/another user/,
	);
});

test("infers ranking side and shifts ranks into a unique order", async () => {
	const state: State = {
		hackers: [hacker("1"), hacker("2"), hacker("3"), hacker("4")],
		teams: [],
		requests: [
			request("1", "1", "2", { requesterRank: 1 }),
			request("2", "1", "3", { requesterRank: 2 }),
			request("3", "1", "4"),
		],
	};
	const rankings = await setRank(context(state), {
		actorDiscordId: state.hackers[0]!.discordId,
		requestId: "3",
		position: 1,
	});
	assert.deepEqual(rankings, [
		{ id: "3", rank: 1 },
		{ id: "1", rank: 2 },
		{ id: "2", rank: 3 },
	]);
	assert.deepEqual(state.requests.map(item => item.requesterRank).sort(), [1, 2, 3]);
});

test("only a team captain can offer and an offered request can be rejected once", async () => {
	const state: State = {
		hackers: [hacker("1"), hacker("2", "owners"), hacker("3", "owners")],
		teams: [{ id: "owners", name: "Owners", captainHackerId: "2" }],
		requests: [request("1", "1", "2", { targetTeamId: "owners" })],
	};
	await assert.rejects(
		() => offerRequest(context(state), { actorDiscordId: state.hackers[2]!.discordId, requestId: "1" }),
		/Only the team captain/,
	);
	await offerRequest(context(state), { actorDiscordId: state.hackers[1]!.discordId, requestId: "1" });
	assert.equal(state.requests[0]!.status, TeamRequestStatus.OFFERED);
	await rejectRequest(context(state), { actorDiscordId: state.hackers[1]!.discordId, requestId: "1" });
	assert.equal(state.requests[0]!.status, TeamRequestStatus.REJECTED);
	await assert.rejects(
		() => rejectRequest(context(state), { actorDiscordId: state.hackers[1]!.discordId, requestId: "1" }),
		/no longer open/,
	);
});

test("a legacy team without a backfilled captain fails closed", async () => {
	const state: State = {
		hackers: [hacker("1"), hacker("2", "legacy")],
		teams: [{ id: "legacy", name: "Legacy", captainHackerId: null }],
		requests: [request("1", "1", "2", { targetTeamId: "legacy" })],
	};
	await assert.rejects(
		() => offerRequest(context(state), { actorDiscordId: state.hackers[1]!.discordId, requestId: "1" }),
		/does not have an assigned captain/,
	);
	assert.equal(state.teams[0]!.captainHackerId, null);
	assert.equal(state.requests[0]!.status, TeamRequestStatus.INTERESTED);
});

test("terminal transitions compact the remaining active ranks", async () => {
	const state: State = {
		hackers: [hacker("1"), hacker("2"), hacker("3"), hacker("4")],
		teams: [],
		requests: [
			request("1", "1", "2", { requesterRank: 1 }),
			request("2", "1", "3", { requesterRank: 2 }),
			request("3", "1", "4", { requesterRank: 3 }),
		],
	};
	await rejectRequest(context(state), { actorDiscordId: state.hackers[1]!.discordId, requestId: "1" });
	assert.equal(state.requests[0]!.status, TeamRequestStatus.REJECTED);
	assert.deepEqual(
		state.requests.slice(1).map(item => item.requesterRank),
		[1, 2],
	);
});

test("solo acceptance creates one team with the listing owner as captain and cannot repeat", async () => {
	const state: State = {
		hackers: [hacker("1"), hacker("2")],
		teams: [],
		requests: [request("1", "1", "2", { status: TeamRequestStatus.OFFERED })],
	};
	const result = await acceptRequest(context(state), {
		actorDiscordId: state.hackers[0]!.discordId,
		requestId: "1",
		teamName: "New Team",
	});
	assert.equal(result.team.captainHackerId, "2");
	assert.equal(result.team.members.length, 2);
	await assert.rejects(
		() =>
			acceptRequest(context(state), {
				actorDiscordId: state.hackers[0]!.discordId,
				requestId: "1",
				teamName: "New Team",
			}),
		TeamOperationError,
	);
	assert.equal(state.requests[0]!.status, TeamRequestStatus.ACCEPTED);
});

test("acceptance rejects more than four unique members without consuming the offer", async () => {
	const state: State = {
		hackers: [
			hacker("1", "source"),
			hacker("2", "target"),
			hacker("3", "source"),
			hacker("4", "source"),
			hacker("5", "target"),
		],
		teams: [
			{ id: "source", name: "Source", captainHackerId: "1" },
			{ id: "target", name: "Target", captainHackerId: "2" },
		],
		requests: [
			request("1", "1", "2", {
				sourceTeamId: "source",
				targetTeamId: "target",
				status: TeamRequestStatus.OFFERED,
			}),
		],
	};
	await assert.rejects(
		() => acceptRequest(context(state), { actorDiscordId: state.hackers[0]!.discordId, requestId: "1" }),
		/more than four/,
	);
	assert.equal(state.requests[0]!.status, TeamRequestStatus.OFFERED);
});

test("team merge preserves the target captain and closes requests owned by the deleted party", async () => {
	const state: State = {
		hackers: [
			hacker("1", "source"),
			hacker("2", "target"),
			hacker("3", "source"),
			hacker("4", "target"),
			hacker("5"),
		],
		teams: [
			{ id: "source", name: "Source", captainHackerId: "1" },
			{ id: "target", name: "Target", captainHackerId: "2" },
		],
		requests: [
			request("1", "1", "2", {
				sourceTeamId: "source",
				targetTeamId: "target",
				status: TeamRequestStatus.OFFERED,
			}),
			request("2", "1", "5", { sourceTeamId: "source" }),
			request("3", "5", "1", { targetTeamId: "source" }),
		],
	};
	const result = await acceptRequest(context(state), {
		actorDiscordId: state.hackers[0]!.discordId,
		requestId: "1",
	});
	assert.equal(result.team.id, "target");
	assert.equal(result.team.captainHackerId, "2");
	assert.equal(result.team.members.length, 4);
	assert.equal(
		state.teams.some(team => team.id === "source"),
		false,
	);
	assert.equal(state.requests[1]!.status, TeamRequestStatus.DECLINED);
	assert.equal(state.requests[2]!.status, TeamRequestStatus.REJECTED);
});

test("a requester team absorbs a solo listing owner without changing captain", async () => {
	const state: State = {
		hackers: [hacker("1", "source"), hacker("2"), hacker("3", "source")],
		teams: [{ id: "source", name: "Source", captainHackerId: "1" }],
		requests: [request("1", "1", "2", { sourceTeamId: "source", status: TeamRequestStatus.OFFERED })],
	};
	const result = await acceptRequest(context(state), {
		actorDiscordId: state.hackers[0]!.discordId,
		requestId: "1",
	});
	assert.equal(result.team.id, "source");
	assert.equal(result.team.captainHackerId, "1");
	assert.deepEqual(result.team.members.map(member => member.id).sort(), ["1", "2", "3"]);
});

test("an internal request ID is consumed even when its action fails", async () => {
	const stored = new Set<string>();
	const db = {
		internalApiRequest: {
			deleteMany: async () => ({ count: 0 }),
			create: async ({ data }: { data: { id: string } }) => {
				if (stored.has(data.id)) throw new Error("duplicate request");
				stored.add(data.id);
				return data;
			},
		},
	};
	const prisma = {
		$transaction: async (action: (transaction: typeof db) => Promise<unknown>) => {
			const snapshot = new Set(stored);
			try {
				return await action(db);
			} catch (error) {
				stored.clear();
				snapshot.forEach(id => stored.add(id));
				throw error;
			}
		},
	} as unknown as PrismaClient;
	let calls = 0;
	const action = async () => {
		calls++;
		throw new Error("domain action failed");
	};
	const id = "018f47a2-90f1-7f0f-8fc4-0f7c4a0c5d55";
	await assert.rejects(() => runInternalRequest(prisma, id, new Date(Date.now() + 60_000), action));
	await assert.rejects(() => runInternalRequest(prisma, id, new Date(Date.now() + 60_000), action));
	assert.equal(calls, 1);
});
