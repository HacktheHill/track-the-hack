import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../server/db";

export default async function readyz(_request: NextApiRequest, response: NextApiResponse) {
	try {
		await prisma.$queryRaw`SELECT 1`;
		response.status(200).json({ status: "ready" });
	} catch (error) {
		console.error("Readiness database check failed", { error: (error as Error).message });
		response.status(503).json({ status: "not_ready" });
	}
}
