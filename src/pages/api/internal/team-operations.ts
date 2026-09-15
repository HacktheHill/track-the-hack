import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { env } from "../../../env/server.mjs";
import { prisma } from "../../../server/db";
import { runInternalRequest } from "../../../server/internal-api";
import {
	TeamOperationError,
	acceptRequest,
	createOrReuseInterest,
	declineRequest,
	listRankings,
	offerRequest,
	rejectRequest,
	resolveParty,
	setRank,
} from "../../../server/team-operations";

export const config = { api: { bodyParser: false } };

const discordId = z.string().regex(/^\d{17,20}$/);
const side = z.enum(["requester", "owner"]);
const inputSchema = z.discriminatedUnion("action", [
	z.object({ action: z.literal("resolve"), actorDiscordId: discordId }),
	z.object({
		action: z.literal("interest"),
		actorDiscordId: discordId,
		targetDiscordId: discordId,
		listingDiscordThreadId: discordId,
		conversationDiscordThreadId: discordId,
	}),
	z.object({
		action: z.literal("rank"),
		actorDiscordId: discordId,
		conversationDiscordThreadId: discordId,
		position: z.number().int().positive(),
	}),
	z.object({ action: z.literal("list"), actorDiscordId: discordId, side }),
	z.object({ action: z.literal("offer"), actorDiscordId: discordId, conversationDiscordThreadId: discordId }),
	z.object({ action: z.literal("reject"), actorDiscordId: discordId, conversationDiscordThreadId: discordId }),
	z.object({ action: z.literal("decline"), actorDiscordId: discordId, conversationDiscordThreadId: discordId }),
	z.object({
		action: z.literal("accept"),
		actorDiscordId: discordId,
		conversationDiscordThreadId: discordId,
		teamName: z.string().trim().min(3).max(50).optional(),
	}),
]);

function oneHeader(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value;
}

async function readBody(req: NextApiRequest) {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const value of req) {
		const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
		size += chunk.length;
		if (size > 32_768) throw new TeamOperationError("Request body is too large");
		chunks.push(chunk);
	}
	return Buffer.concat(chunks).toString("utf8");
}

function verifyRequest(req: NextApiRequest, body: string) {
	const timestamp = oneHeader(req.headers["x-track-the-hack-timestamp"]);
	const signature = oneHeader(req.headers["x-track-the-hack-signature"]);
	const requestId = oneHeader(req.headers["x-track-the-hack-request-id"]);
	const seconds = Number(timestamp);
	if (!timestamp || !Number.isSafeInteger(seconds) || Math.abs(Math.floor(Date.now() / 1000) - seconds) >= 300) {
		return null;
	}
	if (!requestId || !z.string().uuid().safeParse(requestId).success) return null;
	if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return null;
	const expected = createHmac("sha256", env.INTERNAL_API_SECRET).update(`${timestamp}.${requestId}.${body}`).digest();
	if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return null;
	return { requestId, expiresAt: new Date((seconds + 300) * 1000) };
}

function requestSummary(request: {
	id: string;
	listingDiscordThreadId: string;
	conversationDiscordThreadId: string;
	status: string;
	requesterRank: number | null;
	ownerRank: number | null;
}) {
	return {
		id: request.id,
		listingDiscordThreadId: request.listingDiscordThreadId,
		conversationDiscordThreadId: request.conversationDiscordThreadId,
		status: request.status,
		requesterRank: request.requesterRank,
		ownerRank: request.ownerRank,
	};
}

async function requestIdForConversation(
	ctx: { prisma: Prisma.TransactionClient },
	conversationDiscordThreadId: string,
) {
	const request = await ctx.prisma.teamRequest.findUnique({
		where: { conversationDiscordThreadId },
		select: { id: true },
	});
	if (!request) throw new TeamOperationError("Team request not found");
	return request.id;
}

async function execute(ctx: { prisma: Prisma.TransactionClient }, input: z.infer<typeof inputSchema>) {
	switch (input.action) {
		case "resolve":
			return resolveParty(ctx, input.actorDiscordId);
		case "interest":
			return requestSummary(await createOrReuseInterest(ctx, input));
		case "rank": {
			const requestId = await requestIdForConversation(ctx, input.conversationDiscordThreadId);
			return { rankings: await setRank(ctx, { ...input, requestId }) };
		}
		case "list": {
			const requests = await listRankings(ctx, input);
			return {
				requests: requests.map(request => ({
					id: request.id,
					conversationDiscordThreadId: request.conversationDiscordThreadId,
					label:
						input.side === "requester"
							? (request.targetTeam?.name ??
								`${request.targetHacker.firstName} ${request.targetHacker.lastName}`)
							: (request.sourceTeam?.name ??
								`${request.createdByHacker.firstName} ${request.createdByHacker.lastName}`),
					rank: input.side === "requester" ? request.requesterRank : request.ownerRank,
					status: request.status,
				})),
			};
		}
		case "offer": {
			const requestId = await requestIdForConversation(ctx, input.conversationDiscordThreadId);
			return requestSummary(await offerRequest(ctx, { ...input, requestId }));
		}
		case "reject": {
			const requestId = await requestIdForConversation(ctx, input.conversationDiscordThreadId);
			return requestSummary(await rejectRequest(ctx, { ...input, requestId }));
		}
		case "decline": {
			const requestId = await requestIdForConversation(ctx, input.conversationDiscordThreadId);
			return requestSummary(await declineRequest(ctx, { ...input, requestId }));
		}
		case "accept": {
			const requestId = await requestIdForConversation(ctx, input.conversationDiscordThreadId);
			return acceptRequest(ctx, { ...input, requestId });
		}
	}
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
	try {
		const body = await readBody(req);
		const authenticated = verifyRequest(req, body);
		if (!authenticated) return res.status(401).json({ error: "Invalid signature" });
		const input = inputSchema.parse(JSON.parse(body));
		const result = await runInternalRequest(prisma, authenticated.requestId, authenticated.expiresAt, db =>
			execute({ prisma: db }, input),
		);
		return res.status(200).json(result);
	} catch (error) {
		if (error instanceof z.ZodError || error instanceof SyntaxError) {
			return res.status(400).json({ error: "Invalid request body" });
		}
		if (error instanceof TeamOperationError) return res.status(409).json({ error: error.message });
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
			return res.status(409).json({ error: "Request conflicts with existing state" });
		}
		console.error(error);
		return res.status(500).json({ error: "Internal server error" });
	}
}
