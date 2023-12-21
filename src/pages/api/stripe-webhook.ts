import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { Stripe } from "stripe";
import { env } from "../../env/server.mjs";

const stripe: Stripe = new Stripe(env.STRIPE_SECRET_KEY, {
	apiVersion: "2023-10-16",
});
const prisma = new PrismaClient();

export const config = {
	api: {
		bodyParser: false,
	},
};

const PaymentWebHook = async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method === "POST") {
		const buf = await buffer(req);
		const sig = req.headers["stripe-signature"];

		if (typeof sig !== "string" && !Array.isArray(sig)) {
			return res.status(400).send("Invalid Stripe Signature");
		}

		let event = {} as Stripe.Event;

		try {
			event = stripe.webhooks.constructEvent(buf, sig, env.STRIPE_WEBHOOKS_ID);
		} catch (err) {
			if (err instanceof Error) {
				return res.status(400).send(`Webhook Error: ${err.message}`);
			}
		}

		const session = event.data.object as {
			cancel_url: string;
			payment_intent: string;
		};

		const url = new URL(session.cancel_url);
		const id = url.searchParams.get("id")?.[1] ?? "";
		if (!id) {
			console.error("id parameter not found in the URL");
		}

		const paymentIntentId = session.payment_intent;
		const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

		if (paymentIntent.status === "succeeded") {
			console.info("Payment succeeded");
			await handleCheckoutSession(id, "paid");
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

	console.info("Payment updated");
}
