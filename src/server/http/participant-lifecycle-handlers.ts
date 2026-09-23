import type { NextApiRequest } from "next";
import { z, ZodError } from "zod";
import {
	clearParticipantSessionCookies,
	participantSessionVerifierFromRequest,
} from "@/server/lib/participant-session";
import { ParticipantLifecycleError } from "@/server/services/hacker-lifecycle";

const rejectNonPost = (method: string | undefined, setAllow: (value: string) => void) => {
	if (method === "POST") return false;
	setAllow("POST");
	return true;
};

const cancellationBodySchema = z.object({ token: z.string().min(1).max(256) });
export type LifecycleApiRequest = Pick<NextApiRequest, "headers" | "method" | "query"> & { body: unknown };
type HeaderValue = number | string | readonly string[];

type LifecycleMessageResponse =
	| { ok: true; message: string }
	| { ok: false; message: string };
type ParticipantSignOutResponse = { error: "method_not_allowed" };
export type LifecycleApiResponseBody = LifecycleMessageResponse | ParticipantSignOutResponse;

export type LifecycleApiResponse<Body extends LifecycleApiResponseBody = LifecycleApiResponseBody> = {
	setHeader: (name: string, value: HeaderValue) => void;
	status: (code: number) => LifecycleApiResponse<Body>;
	json: (body: Body) => void;
	end: () => void;
};

type LifecycleApiHandler<Body extends LifecycleApiResponseBody> = (
	req: LifecycleApiRequest,
	res: LifecycleApiResponse<Body>,
) => Promise<void>;

export const createCancellationApiHandler =
	(cancel: (token: string) => Promise<void>): LifecycleApiHandler<LifecycleMessageResponse> =>
	async (req, res) => {
		res.setHeader("Cache-Control", "no-store");
		if (rejectNonPost(req.method, value => res.setHeader("Allow", value))) {
			return res.status(405).json({ ok: false, message: "Use the cancellation form to continue." });
		}

		try {
			const { token } = cancellationBodySchema.parse(req.body);
			await cancel(token);
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

export const createParticipantSignOutApiHandler =
	(revoke: (verifier: string) => Promise<void>, secret: string): LifecycleApiHandler<ParticipantSignOutResponse> =>
	async (req, res) => {
		res.setHeader("Cache-Control", "no-store");
		if (rejectNonPost(req.method, value => res.setHeader("Allow", value))) {
			return res.status(405).json({ error: "method_not_allowed" });
		}

		const verifier = participantSessionVerifierFromRequest(req, secret);
		if (verifier) await revoke(verifier);
		res.setHeader("Set-Cookie", clearParticipantSessionCookies());
		return res.status(204).end();
	};
