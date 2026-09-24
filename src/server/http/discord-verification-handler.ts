import type { NextApiRequest, NextApiResponse } from "next";
import { discordVerificationBodySchema, type DiscordVerificationStatus } from "@/server/services/discord-verification";

type ParticipantSession = { hackerId: string } | null;

export type DiscordVerificationDependencies = {
	expectedOrigin: string;
	configured: boolean;
	readParticipantSession(request: NextApiRequest): Promise<ParticipantSession>;
	hasCheckedIn(hackerId: string): Promise<boolean>;
	complete(token: string, hackerId: string): Promise<DiscordVerificationStatus>;
};

export const createDiscordVerificationHandler = (dependencies: DiscordVerificationDependencies) =>
	async function discordVerification(request: NextApiRequest, response: NextApiResponse) {
		response.setHeader("Cache-Control", "no-store");
		if (request.method !== "GET" && request.method !== "POST") {
			response.setHeader("Allow", "GET, POST");
			return response.status(405).json({ status: "invalid" });
		}

		// JSON-only requests and an exact origin check prevent a cross-site form
		// from linking its owner's Discord account to someone else's session.
		if (
			request.method === "POST" &&
			(request.headers["content-type"]?.split(";")[0]?.trim() !== "application/json" ||
				(request.headers.origin && request.headers.origin !== dependencies.expectedOrigin))
		) {
			return response.status(403).json({ status: "invalid" });
		}

		try {
			const session = await dependencies.readParticipantSession(request);
			if (!session) return response.status(401).json({ status: "session-required" });
			if (!(await dependencies.hasCheckedIn(session.hackerId))) {
				return response.status(403).json({ status: "check-in-required" });
			}
			if (!dependencies.configured) return response.status(503).json({ status: "unavailable" });
			if (request.method === "GET") return response.status(200).json({ status: "eligible" });

			const body = discordVerificationBodySchema.safeParse(request.body);
			if (!body.success) return response.status(400).json({ status: "invalid" });
			const status = await dependencies.complete(body.data.token, session.hackerId);
			const code = {
				verified: 200,
				invalid: 400,
				conflict: 409,
				"discord-account-conflict": 409,
				"participant-conflict": 409,
				unavailable: 503,
			};
			return response.status(code[status]).json({ status });
		} catch {
			console.error("Discord verification failed");
			return response.status(503).json({ status: "unavailable" });
		}
	};
