import { initReactI18next } from "react-i18next";

import i18n from "i18next";
import common from "../../public/locales/en/common.json";
import confirm from "../../public/locales/en/confirm.json";

export const defaultNS = "common";
export const resources = {
	en: {
		common,
		confirm,
	},
} as const;

await i18n.use(initReactI18next).init({
	lng: "en",
	ns: ["common", "confirm"],
	defaultNS,
	resources,
});
