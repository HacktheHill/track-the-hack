import "i18next";
import type { defaultNS, resources } from "./i18n";

declare module "i18next" {
	interface CustomTypeOptions {
		returnNull: false;
		resources: (typeof resources)["en"];
		defaultNS: typeof defaultNS;
	}
}
