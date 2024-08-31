const uploadResume = async (presignedUrl: string, file: File, name: string) => {
	const body = new FormData();
	body.append("file", file, name);

	try {
		const response = await fetch(presignedUrl, {
			method: "PUT",
			body,
		});
		if (!response.ok) {
			console.error("Failed to upload resume", response.statusText);
			return false;
		}
		console.info("Uploaded resume to S3", name);
		return true;
	} catch (error) {
		console.error("Failed to upload resume", error);
		return false;
	}
};

const uploadSignature = async (presignedUrl: string, signatureDataURL: string, name: string) => {
	try {
		const blob = await fetch(signatureDataURL).then(res => res.blob());

		const response = await fetch(presignedUrl, {
			method: "PUT",
			body: blob,
			headers: {
				"Content-Type": "image/png",
			},
		});
		if (!response.ok) {
			console.error("Failed to upload signature", response.statusText);
			return false;
		}
		console.info("Uploaded signature to S3", name);
		return true;
	} catch (error) {
		console.error("Failed to upload signature", error);
		return false;
	}
};

export { uploadResume, uploadSignature };
