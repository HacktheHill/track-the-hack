import { Prisma, type PrismaClient } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";

export class DiscordIdentityError extends Error {}

type Db = Prisma.TransactionClient;
type Context = { prisma: PrismaClient };

export function verifyDiscordLinkProof(
	secret: string,
	input: { discordId: string; timestamp: string; signature: string },
	nowSeconds = Math.floor(Date.now() / 1000),
) {
	const timestamp = Number(input.timestamp);
	if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) {
		throw new DiscordIdentityError("Discord verification link has expired");
	}
	if (!/^[a-f0-9]{64}$/i.test(input.signature)) {
		throw new DiscordIdentityError("Discord verification link is invalid");
	}
	const expected = createHmac("sha256", secret).update(`verify:${input.timestamp}:${input.discordId}`).digest();
	if (!timingSafeEqual(expected, Buffer.from(input.signature, "hex"))) {
		throw new DiscordIdentityError("Discord verification link is invalid");
	}
}

export async function ensureDiscordAccountCanLink(db: Db, userId: string, discordId: string) {
	const [discordAccount, userDiscordAccount] = await Promise.all([
		db.account.findUnique({
			where: { provider_providerAccountId: { provider: "discord", providerAccountId: discordId } },
			select: { userId: true },
		}),
		db.account.findFirst({ where: { userId, provider: "discord" }, select: { providerAccountId: true } }),
	]);
	if (discordAccount && discordAccount.userId !== userId) {
		throw new DiscordIdentityError("Discord account is already linked to another user");
	}
	if (userDiscordAccount && userDiscordAccount.providerAccountId !== discordId) {
		throw new DiscordIdentityError("User already has a different Discord account");
	}
}

export async function linkDiscordAccount(ctx: Context, userId: string, discordId: string) {
	try {
		return await ctx.prisma.$transaction(
			async db => {
				await ensureDiscordAccountCanLink(db, userId, discordId);
				const existing = await db.account.findUnique({
					where: { provider_providerAccountId: { provider: "discord", providerAccountId: discordId } },
				});
				return (
					existing ??
					db.account.create({
						data: { userId, type: "oauth", provider: "discord", providerAccountId: discordId },
					})
				);
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
		);
	} catch (error) {
		if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
		const account = await ctx.prisma.account.findUnique({
			where: { provider_providerAccountId: { provider: "discord", providerAccountId: discordId } },
		});
		if (account?.userId === userId) return account;
		throw new DiscordIdentityError("Discord account is already linked to another user");
	}
}
