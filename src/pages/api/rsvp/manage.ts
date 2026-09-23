import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "@/env/server.mjs";
import { prisma } from "@/server/db";
import { PrismaRsvpManagementRepository } from "@/server/repositories/prisma-rsvp-management";
import { decideManagedRsvp, readManagedRsvp } from "@/server/services/rsvp-management";
import { createRsvpManagementHandler } from "@/server/http/rsvp-management-handler";

const repository = new PrismaRsvpManagementRepository(prisma);
const handler = createRsvpManagementHandler({
	read: token => readManagedRsvp(repository, token, env.CANCELLATION_TOKEN_SECRET),
	decide: (token, attending) => decideManagedRsvp(repository, token, env.CANCELLATION_TOKEN_SECRET, attending),
});

export default function manageRsvp(req: NextApiRequest, res: NextApiResponse) {
	return handler(req, res);
}
