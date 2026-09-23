import { z, ZodError } from "zod";
import { ParticipantLifecycleError } from "@/server/services/hacker-lifecycle";
import type { ManagedRsvp } from "@/server/services/rsvp-management";

const bodySchema = z.object({
	token: z.string().min(1).max(256),
	action: z.enum(["status", "attend", "decline"]),
}).strict();

export type RsvpManagementRequest = { method?: string; body: unknown };
export type RsvpManagementResponse = {
	setHeader(name: string, value: string): void;
	status(code: number): RsvpManagementResponse;
	json(body: ManagedRsvp | { error: string }): void;
};

export const createRsvpManagementHandler = (operations: {
	read(token: string): Promise<ManagedRsvp>;
	decide(token: string, attending: boolean): Promise<ManagedRsvp>;
}) => async (req: RsvpManagementRequest, res: RsvpManagementResponse) => {
	res.setHeader("Cache-Control", "no-store");
	res.setHeader("Referrer-Policy", "no-referrer");
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).json({ error: "method_not_allowed" });
	}

	try {
		const { token, action } = bodySchema.parse(req.body);
		const result = action === "status"
			? await operations.read(token)
			: await operations.decide(token, action === "attend");
		return res.status(200).json(result);
	} catch (error) {
		if (error instanceof ParticipantLifecycleError && error.code === "INVALID_OR_EXPIRED_INVITATION") {
			return res.status(409).json({ error: "rsvp_deadline_passed" });
		}
		if (error instanceof ZodError || error instanceof ParticipantLifecycleError) {
			return res.status(400).json({ error: "invalid_rsvp_link" });
		}
		console.error("RSVP management failed");
		return res.status(500).json({ error: "rsvp_unavailable" });
	}
};
