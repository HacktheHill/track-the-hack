import { createNextApiHandler } from "@trpc/server/adapters/next";
import type { NextApiRequest, NextApiResponse } from "next";

import { env } from "@/env/server.mjs";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

const trpcHandler = createNextApiHandler({
	router: appRouter,
	createContext: createTRPCContext,
	onError:
		env.NODE_ENV === "development"
			? ({ path, error }) => {
					console.error(`❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`);
				}
			: undefined,
});

export default function handler(request: NextApiRequest, response: NextApiResponse) {
	response.setHeader("Cache-Control", "no-store");
	return trpcHandler(request, response);
}
