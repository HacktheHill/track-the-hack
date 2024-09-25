import { env } from "../../../env/server.mjs";
import { createTRPCRouter, publicProcedure } from "../trpc";
import crypto from "crypto";
import { z } from "zod";

const ALGORITHM = "aes-256-cbc";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

function encrypt(text: string, secretKey: string): string {
	const iv = crypto.randomBytes(IV_LENGTH);
	const key = crypto.createHash("sha256").update(secretKey).digest("base64").slice(0, KEY_LENGTH);

	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
	let encrypted = cipher.update(text, "utf8", "hex");
	encrypted += cipher.final("hex");

	return `${iv.toString("hex")}:${encrypted}`;
}

function decrypt(encryptedText: string, secretKey: string): string {
	console.log(encryptedText);
	const [ivHex, encryptedData] = encryptedText.split(":");

	if (!ivHex || !encryptedData) {
		throw new Error("Invalid encrypted text");
	}

	const iv = Buffer.from(ivHex, "hex");
	const key = crypto.createHash("sha256").update(secretKey).digest("base64").slice(0, 32);

	const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
	let decrypted = decipher.update(encryptedData, "hex", "utf8");
	decrypted += decipher.final("utf8");

	const [hackerId, timestampStr] = decrypted.split(":");
	if (!hackerId || !timestampStr) {
		throw new Error("Invalid decrypted text");
	}

	// Validate that the decrypted timestamp is within the last two minutes
	const now = Math.floor(Date.now() / 60000);
	const timestamp = parseInt(timestampStr);
	if (now - timestamp > 2) {
		throw new Error("QR code has expired");
	}

	return hackerId;
}

export const qrRouter = createTRPCRouter({
	decryptHackerId: publicProcedure.input(z.string()).mutation(({ input }) => {
		const secretKey = env.QR_SECRET_KEY;
		const decrypted = decrypt(input, secretKey);
		return decrypted.split(":")[0];
	}),
});

export { encrypt };
