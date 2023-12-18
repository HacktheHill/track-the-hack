import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { Stripe } from "stripe";
import { env } from "../../env/server.mjs";

const stripe: Stripe = new Stripe(env.STRIPE_API_KEY, {
	apiVersion: "2023-10-16",
});
const prisma = new PrismaClient();

export const config = {
	api: {
		bodyParser: false,
	},
};

type CustomSession = {
	cancel_url: string;
	payment_intent: string;
};

const PaymentWebHook = async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method === "POST") {
		const buf = await buffer(req);
		const sig = req.headers["stripe-signature"];

		let event: Stripe.Event = {} as Stripe.Event;

		if (typeof sig !== "string" && !Array.isArray(sig)) {
			return res.status(400).send("Invalid Stripe Signature");
		}

		try {
			event = stripe.webhooks.constructEvent(buf, sig, env.STRIPE_WEBHOOKS_ID);
		} catch (err) {
			if (err instanceof Error) {
				return res.status(400).send(`Webhook Error: ${err.message}`);
			}
		}
		const session = event.data.object as CustomSession;
		const url: string = session.cancel_url;

		const idMatch = /[\?&]id=([^&]+)/.exec(url);

		const paymentIntentId = session.payment_intent;
		const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

		if (idMatch) {
			const id = idMatch[1] || "";
			if (paymentIntent.status === "succeeded") {
				console.log("Payment succeeded");
				await handleCheckoutSession(id, "paid");
			}
		} else {
			console.log("id parameter not found in the URL");
		}

		res.json({ received: true });
	} else {
		res.setHeader("Allow", "POST");
		res.status(405).end("Method Not Allowed");
	}
};

export default PaymentWebHook;

async function handleCheckoutSession(id: string, status: string) {
	const payment = await prisma.payment.findFirst({
		where: { id: id },
	});

	if (payment) {
		await prisma.payment.update({
			where: { id: payment.id },
			data: {
				paid: status,
			},
		});
	}
	console.log("Payment updated");
}
