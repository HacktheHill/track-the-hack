import { env } from "../../../env/server.mjs";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { protectedProcedure } from "../trpc";
import crypto from "crypto";
import { z } from "zod";

const ALGORITHM = "aes-256-cbc";
const KEY_LENGTH = 32; // bytes
const IV_LENGTH = 16; // bytes

function deriveKey(secretKey: string): Buffer {
	// sha256 digest is 32 bytes already; slice just in case constants change
	return crypto.createHash("sha256").update(secretKey).digest().subarray(0, KEY_LENGTH);
}

function encrypt(text: string, secretKey: string): string {
	const iv = crypto.randomBytes(IV_LENGTH);
	const key = deriveKey(secretKey);
	// Type assertions to satisfy TS where Buffer not inferred as CipherKey
	const cipher = crypto.createCipheriv(ALGORITHM, key as unknown as crypto.CipherKey, iv as unknown as crypto.BinaryLike);
	let encrypted = cipher.update(text, "utf8", "hex");
	encrypted += cipher.final("hex");
	return `${iv.toString("hex")}:${encrypted}`;
}

function decrypt(encryptedText: string, secretKey: string): string {
	const [ivHex, encryptedData] = encryptedText.split(":");
	if (!ivHex || !encryptedData) {
		throw new Error("Invalid encrypted text");
	}
	const iv = Buffer.from(ivHex, "hex");
	const key = deriveKey(secretKey);
	const decipher = crypto.createDecipheriv(ALGORITHM, key as unknown as crypto.CipherKey, iv as unknown as crypto.BinaryLike);
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
		return decrypted; // already the hackerId
	}),
	// Returns a freshly encrypted id for the logged-in hacker (changes every minute)
	encryptedId: protectedProcedure.query(({ ctx }) => {
		const hackerId = ctx.session.user.hackerId;
		if (!hackerId) return null;
		const secretKey = env.QR_SECRET_KEY;
		const timestamp = Math.floor(Date.now() / 60000);
		return encrypt(`${hackerId}:${timestamp}`, secretKey);
	}),
});

export { encrypt };
