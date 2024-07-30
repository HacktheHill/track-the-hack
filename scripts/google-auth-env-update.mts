import { authenticate } from "@google-cloud/local-auth";
import fs from "fs/promises";
import type { OAuth2Client } from "google-auth-library";
import path from "path";

const SCOPES = ["https://mail.google.com/"];
const CREDENTIALS_PATH = path.join(process.cwd(), "google-credentials.json");
const ENV_PATH = path.join(process.cwd(), ".env");

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
const saveCredentials = async (client: OAuth2Client): Promise<void> => {
	const content = await fs.readFile(CREDENTIALS_PATH, "utf8");
	const { web: key } = JSON.parse(content) as CredentialsJSON;

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
			return `SPONSORSHIP_GOOGLE_REFRESH_TOKEN=${client.credentials.refresh_token}`;
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

interface CredentialsJSON {
	web: {
		client_id: string;
		project_id: string;
		auth_uri: string;
		token_uri: string;
		auth_provider_x509_cert_url: string;
		client_secret: string;
		redirect_uris: string[];
	};
}
