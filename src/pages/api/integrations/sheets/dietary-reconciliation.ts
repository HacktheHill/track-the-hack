import type { NextApiRequest, NextApiResponse } from "next";
import { ZodError } from "zod";
import { env } from "@/env/server.mjs";
import { prisma } from "@/server/db";
import { hasIntegrationApiKey } from "@/server/lib/integration-auth";
import { PrismaHackerLifecycleRepository } from "@/server/repositories/prisma-hacker-lifecycle";
import { reconcileDietaryCategories } from "@/server/services/dietary-reconciliation";

const repository = new PrismaHackerLifecycleRepository(prisma);

export default async function dietaryReconciliation(req: NextApiRequest, res: NextApiResponse) {
	res.setHeader("Cache-Control", "no-store");
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).json({ error: "method_not_allowed" });
	}
	if (!hasIntegrationApiKey(req, env.SHEETS_INTEGRATION_API_KEY)) {
		return res.status(401).json({ error: "unauthorized" });
	}
	try {
		const result = await reconcileDietaryCategories(repository, req.body);
		if (result.missingIds.length) return res.status(409).json({ error: "missing_participants", missingIds: result.missingIds });
		return res.status(200).json({ processed: result.processed });
	} catch (error) {
		if (error instanceof ZodError) return res.status(400).json({ error: "invalid_dietary_reconciliation", issues: error.issues });
		console.error("Sheet dietary reconciliation failed");
		return res.status(500).json({ error: "dietary_reconciliation_failed" });
	}
}
