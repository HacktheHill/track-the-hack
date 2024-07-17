import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";

import { appWithTranslation } from "next-i18next";

import { trpc } from "../server/api/api";

import "../styles/globals.css";

const MyApp: AppType<{ session: Session | null }> = ({ Component, pageProps: { session, ...pageProps } }) => {
	const router = useRouter();
	useEffect(() => {
		const handler = () => router.back();
		addEventListener("onpopstate", handler);
		return () => {
			removeEventListener("onpopstate", handler);
		};
	}, [router]);

	return (
		<SessionProvider session={session}>
			<Component {...pageProps} />
		</SessionProvider>
	);
};

export default trpc.withTRPC(appWithTranslation(MyApp));
