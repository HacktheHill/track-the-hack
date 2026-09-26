const EMAIL_CALLBACK_PATH = "/api/auth/callback/email";
const EMAIL_CONFIRMATION_PATH = "/auth/verify-email";

export const createOrganizerEmailConfirmationUrl = (verificationUrl: string) => {
	const verification = new URL(verificationUrl);
	const confirmation = new URL(EMAIL_CONFIRMATION_PATH, verification.origin);
	confirmation.hash = verification.searchParams.toString();
	return confirmation.toString();
};

export const parseOrganizerEmailConfirmationFragment = (fragment: string, origin: string) => {
	const expectedOrigin = new URL(origin).origin;
	const params = new URLSearchParams(fragment.startsWith("#") ? fragment.slice(1) : fragment);
	const callbackUrl = params.get("callbackUrl");
	const email = params.get("email");
	const token = params.get("token");
	if (!callbackUrl || !email || !token || email.length > 320 || token.length > 1024 || callbackUrl.length > 2048)
		return null;

	const callback = new URL(callbackUrl, expectedOrigin);
	if (callback.origin !== expectedOrigin) return null;

	const verification = new URL(EMAIL_CALLBACK_PATH, expectedOrigin);
	verification.search = new URLSearchParams({ callbackUrl: callback.toString(), email, token }).toString();
	return { email, verificationUrl: verification.toString() };
};
