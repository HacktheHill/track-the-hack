const uploadResume = async (presignedUrl: string, file: File, name: string) => {
	const body = new FormData();
	body.append("file", file, name);

	try {
		await fetch(presignedUrl, {
			method: "PUT",
			body,
		});
	} catch (error) {
		console.error("Failed to upload resume", error);
	}

	console.log("Uploaded resume to S3", name);
};

export { uploadResume };
