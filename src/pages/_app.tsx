import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";

import { appWithTranslation } from "next-i18next";

import { trpc } from "../utils/api";

import "../styles/globals.css";
import "../components/Menu/Menu.css";

const MyApp: AppType<{ session: Session | null }> = ({ Component, pageProps: { session, ...pageProps } }) => {
	return (
		<SessionProvider session={session}>
			<Component {...pageProps} />
		</SessionProvider>
	);
};

export default trpc.withTRPC(appWithTranslation(MyApp));
