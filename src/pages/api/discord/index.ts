import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "../../../env/server.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
	const body = req.body as {
		id: string;
		message: string;
	};

	await prisma.notification.upsert({
		where: {
			id: body.id,
		},
		update: {
			message: body.message,
		},
		create: {
			id: body.id,
			message: body.message,
		},
	});

	const response = await fetch(env.DISCORD_WEBHOOK_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			content: body.message,
		}),
	});

	if (response.status >= 400) {
		res.status(response.status).json({ error: "Bad request" });
	} else {
		res.status(200).json({ status: "ok" });
	}
};

export default handler;
