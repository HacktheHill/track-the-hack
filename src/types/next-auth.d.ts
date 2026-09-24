import { type DefaultSession } from "next-auth";

declare module "next-auth" {
	interface Session {
		user?: {
			id: string;
			isOrganizer: boolean;
			isAdmin: boolean;
		} & DefaultSession["user"];
	}
}
