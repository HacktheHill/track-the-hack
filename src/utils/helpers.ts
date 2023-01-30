export const isExpired = (expiry: string) => {
	const now = new Date();
	const expiryDate = new Date(expiry);
	if (expiryDate.toString() === "Invalid Date") {
		return false;
	}
	return now > expiryDate;
};
