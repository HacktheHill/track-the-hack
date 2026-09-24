import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/server/db";

export default async function readyz(_request: NextApiRequest, response: NextApiResponse) {
	response.setHeader("Cache-Control", "no-store");
	try {
		await prisma.$queryRaw`SELECT 1`;
		response.status(200).json({ status: "ready" });
	} catch {
		console.error("Readiness database check failed");
		response.status(503).json({ status: "not_ready" });
	}
}
