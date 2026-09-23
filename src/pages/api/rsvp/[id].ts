import type { NextApiRequest, NextApiResponse } from "next";
// Participant IDs are displayed in day-of QRs and cannot authorize RSVP edits.
export default function retiredRsvpLink(_req: NextApiRequest, res: NextApiResponse) {
	res.setHeader("Cache-Control", "no-store");
	return res.status(410).json({ error: "old_rsvp_link_retired" });
}
