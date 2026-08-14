import type { NextApiHandler } from "next";
import { ZodError } from "zod";
import { ParticipantLifecycleError } from "../services/hacker-lifecycle";

const rejectNonPost = (method: string | undefined, setAllow: (value: string) => void) => {
	if (method === "POST") return false;
	setAllow("POST");
	return true;
};

export const createRsvpApiHandler =
	(confirm: (id: unknown) => Promise<void>): NextApiHandler =>
	async (req, res) => {
		res.setHeader("Cache-Control", "no-store");
		if (rejectNonPost(req.method, value => res.setHeader("Allow", value))) {
			return res.status(405).json({ ok: false, message: "Use the confirmation form to respond." });
		}

		try {
			const body = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};
			if (body.confirm !== true) {
				return res.status(400).json({ ok: false, message: "Explicit confirmation is required." });
			}
			await confirm(req.query.id);
			return res.status(200).json({ ok: true, message: "Your attendance is confirmed." });
		} catch (error) {
			if (error instanceof ParticipantLifecycleError || error instanceof ZodError) {
				return res.status(400).json({
					ok: false,
					message: "This invitation is invalid or has expired.",
				});
			}

			console.error("RSVP confirmation failed");
			return res.status(500).json({ ok: false, message: "Confirmation is temporarily unavailable." });
		}
	};

export const createCancellationApiHandler =
	(cancel: (token: unknown) => Promise<void>): NextApiHandler =>
	async (req, res) => {
		res.setHeader("Cache-Control", "no-store");
		if (rejectNonPost(req.method, value => res.setHeader("Allow", value))) {
			return res.status(405).json({ ok: false, message: "Use the cancellation form to continue." });
		}

		try {
			const body = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};
			await cancel(body.token);
			return res.status(200).json({ ok: true, message: "Your attendance has been cancelled." });
		} catch (error) {
			if (error instanceof ParticipantLifecycleError || error instanceof ZodError) {
				return res.status(400).json({ ok: false, message: "This cancellation link is invalid." });
			}

			// Do not include the exception or request body here: either can contain the raw capability.
			console.error("RSVP cancellation failed");
			return res.status(500).json({ ok: false, message: "Cancellation is temporarily unavailable." });
		}
	};
