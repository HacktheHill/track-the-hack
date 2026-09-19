import { fileURLToPath } from "node:url";

const expectedDatabase = "track-the-hack";
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);

/** @param {string | undefined} databaseUrl */
export const assertLocalDevDatabase = databaseUrl => {
	if (!databaseUrl) throw new Error("Refusing dev setup: DATABASE_URL is not set.");

	let parsed;
	try {
		parsed = new URL(databaseUrl);
	} catch {
		throw new Error("Refusing dev setup: DATABASE_URL is not a valid URL.");
	}

	const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
	const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
	if (parsed.protocol !== "mysql:" || !loopbackHosts.has(hostname) || database !== expectedDatabase) {
		throw new Error(
			`Refusing dev setup: DATABASE_URL must use MySQL on localhost, 127.0.0.1, or ::1 with database "${expectedDatabase}" (received protocol "${parsed.protocol}", host "${hostname || "missing"}", database "${database || "missing"}").`,
		);
	}
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	assertLocalDevDatabase(process.env.DATABASE_URL);
	console.info(`Verified local MySQL database ${expectedDatabase}.`);
}
