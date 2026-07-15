import type { NextApiRequest, NextApiResponse } from "next";

export default function healthz(_request: NextApiRequest, response: NextApiResponse) {
	response.status(200).json({ status: "ok" });
}
