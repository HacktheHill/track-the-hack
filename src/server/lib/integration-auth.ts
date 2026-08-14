import { timingSafeEqual } from "node:crypto";
import type { NextApiRequest } from "next";

const safeEqual = (left: string, right: string) => {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const hasIntegrationApiKey = (req: Pick<NextApiRequest, "headers">, expectedKey: string) => {
	const authorization = req.headers.authorization;
	if (!authorization?.startsWith("Bearer ")) {
		return false;
	}

	return safeEqual(authorization.slice("Bearer ".length), expectedKey);
};
