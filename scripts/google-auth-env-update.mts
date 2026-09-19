import { authenticate } from "@google-cloud/local-auth";
import fs from "fs/promises";
import type { OAuth2Client } from "google-auth-library";
import path from "path";
import { z } from "zod";

const SCOPES = ["https://mail.google.com/"];
const CREDENTIALS_PATH = path.join(process.cwd(), "google-credentials.json");
const ENV_PATH = path.join(process.cwd(), ".env");
const credentialsSchema = z.object({
	web: z.object({
		client_id: z.string().min(1),
		client_secret: z.string().min(1),
	}),
});

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
const saveCredentials = async (client: OAuth2Client): Promise<void> => {
	const content = await fs.readFile(CREDENTIALS_PATH, "utf8");
	const { web: key } = credentialsSchema.parse(JSON.parse(content));
	const refreshToken = client.credentials.refresh_token;
	if (!refreshToken) {
		throw new Error("Google did not return a refresh token");
	}

	// Read the existing ENV file and parse its content
	const envContent = await fs.readFile(ENV_PATH, "utf8");
	const envLines = envContent.split("\n");

	// Update the relevant lines with the new credentials
	const updatedEnvLines = envLines.map(line => {
		if (line.startsWith("SPONSORSHIP_GOOGLE_CLIENT_ID")) {
			return `SPONSORSHIP_GOOGLE_CLIENT_ID=${key.client_id}`;
		} else if (line.startsWith("SPONSORSHIP_GOOGLE_CLIENT_SECRET")) {
			return `SPONSORSHIP_GOOGLE_CLIENT_SECRET=${key.client_secret}`;
		} else if (line.startsWith("SPONSORSHIP_GOOGLE_REFRESH_TOKEN")) {
			return `SPONSORSHIP_GOOGLE_REFRESH_TOKEN=${refreshToken}`;
		}
		return line;
	});

	// Write the modified content back to the ENV file
	const updatedEnvContent = updatedEnvLines.join("\n");
	await fs.writeFile(ENV_PATH, updatedEnvContent, "utf8");
};

const main = async () => {
	console.info("Authorizing...");
	const client = await authenticate({
		scopes: SCOPES,
		keyfilePath: CREDENTIALS_PATH,
	});
	if (client.credentials) {
		console.info("Credentials obtained, saving to file");
		await saveCredentials(client);
	}
};

void main();
