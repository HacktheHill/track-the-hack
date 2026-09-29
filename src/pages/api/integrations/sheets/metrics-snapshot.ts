import type { NextApiRequest, NextApiResponse } from "next";
import { ZodError } from "zod";
import { env } from "@/env/server.mjs";
import { prisma } from "@/server/db";
import { hasIntegrationApiKey } from "@/server/lib/integration-auth";
import { metricsSnapshotInputSchema } from "@/server/services/external-metrics";

export default async function metricsSnapshot(req: NextApiRequest, res: NextApiResponse) {
	res.setHeader("Cache-Control", "no-store");
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).json({ error: "method_not_allowed" });
	}
	if (!hasIntegrationApiKey(req, env.SHEETS_INTEGRATION_API_KEY)) {
		return res.status(401).json({ error: "unauthorized" });
	}

	try {
		const input = metricsSnapshotInputSchema.parse(req.body);
		await prisma.metricsSnapshot.upsert({
			where: { source: input.source },
			create: { source: input.source, capturedAt: new Date(input.capturedAt), payload: input.payload },
			update: { capturedAt: new Date(input.capturedAt), payload: input.payload },
		});
		return res.status(200).json({ source: input.source, capturedAt: input.capturedAt });
	} catch (error) {
		if (error instanceof ZodError)
			return res.status(400).json({ error: "invalid_metrics_snapshot", issues: error.issues });
		console.error("Metrics snapshot import failed");
		return res.status(500).json({ error: "metrics_snapshot_failed" });
	}
}
