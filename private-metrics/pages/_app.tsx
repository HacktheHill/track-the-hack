import type { AppProps } from "next/app";
import { appWithTranslation } from "next-i18next";
import { archiveI18n } from "@root/archive/i18n";
import "@/styles/globals.css";

const PrivateMetricsApp = ({ Component, pageProps }: AppProps) => <Component {...pageProps} />;
export default appWithTranslation(PrivateMetricsApp, archiveI18n);
