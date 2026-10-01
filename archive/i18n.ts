import type { UserConfig } from "next-i18next";

export const archiveI18n: UserConfig = {
	i18n: { defaultLocale: "en", locales: ["en", "fr"] },
	localePath: "./public/locales",
	returnNull: false,
};
