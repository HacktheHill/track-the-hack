import type { NextApiRequest, NextApiResponse } from "next";
import { ZodError } from "zod";
import { env } from "@/env/server.mjs";
import { prisma } from "@/server/db";
import { hasIntegrationApiKey } from "@/server/lib/integration-auth";
import { log } from "@/server/lib/log";
import { createAuditEvent, emitAuditEvent } from "@/server/lib/audit-event";
import { PrismaHackerLifecycleRepository } from "@/server/repositories/prisma-hacker-lifecycle";
import { issueParticipantAccess } from "@/server/services/hacker-lifecycle";

const repository = new PrismaHackerLifecycleRepository(prisma);

export default async function claim(req: NextApiRequest, res: NextApiResponse) {
	res.setHeader("Cache-Control", "no-store");
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).json({ error: "method_not_allowed" });
	}

	if (!hasIntegrationApiKey(req, env.SHEETS_INTEGRATION_API_KEY)) {
		return res.status(401).json({ error: "unauthorized" });
	}

	try {
		const now = new Date();
		const { hackerId, auditEvent, ...result } = await issueParticipantAccess(
			repository,
			req.body,
			env.NEXTAUTH_URL,
			env.CLAIM_TOKEN_SECRET,
			now,
			undefined,
			(id, occurredAt) =>
				createAuditEvent({
					name: "participant.claim.issued",
					outcome: "issued",
					actor: { type: "integration", id: "google-sheets" },
					subject: { type: "hacker", id },
					data: {},
					occurredAt,
				}),
		);
		if (!auditEvent) throw new Error("Claim issuance audit event missing");
		emitAuditEvent(auditEvent);

		await log(
			{ prisma },
			{
				sourceId: hackerId,
				sourceType: "Hacker",
				author: "sheets-integration",
				route: "/api/integrations/sheets/claim",
				action: "IssueClaimToken",
				details: "Issued a single-use participant access link.",
			},
		);

		return res.status(200).json(result);
	} catch (error) {
		if (error instanceof ZodError) {
			return res.status(400).json({ error: "invalid_operational_record", issues: error.issues });
		}

		// Do not include the exception here: it can carry the signed claim URL.
		console.error("Claim issuance failed");
		return res.status(500).json({ error: "claim_issuance_failed" });
	}
}
