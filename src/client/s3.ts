const uploadResume = async (presignedUrl: string, file: File, name: string) => {
	const body = new FormData();
	body.append("file", file, name);

	const response = await fetch(presignedUrl, {
		method: "PUT",
		body,
	});

	if (!response.ok) {
		throw new Error("Failed to upload resume");
	}

	console.log("Uploaded resume to S3", name);
};

export { uploadResume };
