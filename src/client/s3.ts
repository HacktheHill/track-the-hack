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

export { uploadResume };
