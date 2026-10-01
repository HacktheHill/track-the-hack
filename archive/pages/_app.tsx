import { useEffect } from "react";
import type { AppProps } from "next/app";
import { appWithTranslation } from "next-i18next";
import { archiveI18n } from "@root/archive/i18n";
import "@/styles/globals.css";

const ArchiveApp = ({ Component, pageProps }: AppProps) => {
	useEffect(() => {
		// Replaces the live app's worker at the same URL when switching hosts.
		if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
	}, []);
	return <Component {...pageProps} />;
};

export default appWithTranslation(ArchiveApp, archiveI18n);
