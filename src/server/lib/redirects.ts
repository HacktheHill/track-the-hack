import type { Session } from "next-auth";

export function organizerRedirect(session: Session | null, callbackUrl: string, admin = false) {
	if (!session?.user) {
		return {
			destination: `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
			permanent: false,
		};
	}

	if (!session.user.isOrganizer || (admin && !session.user.isAdmin)) {
		return { destination: callbackUrl.startsWith("/internal") ? "/internal" : "/", permanent: false };
	}
}
