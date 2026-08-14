import type { NextApiRequest, NextApiResponse } from "next";
import { ZodError } from "zod";
import { env } from "../../../../env/server.mjs";
import { prisma } from "../../../../server/db";
import { hasIntegrationApiKey } from "../../../../server/lib/integration-auth";
import { PrismaHackerLifecycleRepository } from "../../../../server/repositories/prisma-hacker-lifecycle";
import { reconcileRsvps } from "../../../../server/services/hacker-lifecycle";

const repository = new PrismaHackerLifecycleRepository(prisma);

export default async function reconcile(req: NextApiRequest, res: NextApiResponse) {
	res.setHeader("Cache-Control", "no-store");
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).json({ error: "method_not_allowed" });
	}

	if (!hasIntegrationApiKey(req, env.SHEETS_INTEGRATION_API_KEY)) {
		return res.status(401).json({ error: "unauthorized" });
	}

	try {
		const result = await reconcileRsvps(repository, req.body, env.NEXTAUTH_URL, env.CANCELLATION_TOKEN_SECRET);
		return res.status(200).json(result);
	} catch (error) {
		if (error instanceof ZodError) {
			return res.status(400).json({ error: "invalid_reconciliation_request", issues: error.issues });
		}

		console.error("RSVP reconciliation failed");
		return res.status(500).json({ error: "reconciliation_failed" });
	}
}
