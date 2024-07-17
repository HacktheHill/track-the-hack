import crypto from "crypto";
import { env } from "../../env/server.mjs";

const generatePresignedPutUrl = async (id: string, bucket: string) => {
	const response = await fetch(`${env.S3_URL}/${bucket}/${id}`, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${env.S3_AUTH_KEY}`,
		},
	});

	if (!response.ok) {
		throw new Error("Failed to generate presigned PUT URL");
	}

	const signedUrl = await response.text();

	console.log("Generated presigned PUT URL for S3", signedUrl);

	return signedUrl;
};

const generatePresignedGetUrl = async (id: string, bucket: string) => {
	const response = await fetch(`${env.S3_URL}/${bucket}/${id}`, {
		headers: {
			Authorization: `Bearer ${env.S3_AUTH_KEY}`,
		},
	});

	if (!response.ok) {
		throw new Error("Failed to generate presigned GET URL");
	}

	const signedUrl = await response.text();

	console.log("Generated presigned GET URL for S3", signedUrl);

	return signedUrl;
};

const generateS3Filename = (id: string, label: string, filetype: string) => {
	const hash = crypto
		.createHash("sha256")
		.update(env.S3_AUTH_KEY + id)
		.digest("hex");
	return `${hash}-${label.replace(/[^a-z0-9]/gi, "_")}.${filetype}`;
};

export { generatePresignedPutUrl, generatePresignedGetUrl, generateS3Filename };
