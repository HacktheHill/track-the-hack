import { z } from "zod";

export const httpsUrl = z
	.string()
	.trim()
	.min(1)
	.max(191)
	.url()
	.refine(value => new URL(value).protocol === "https:", "URL must use HTTPS");

export const eventImageUrl = z
	.string()
	.trim()
	.max(191)
	.refine(value => {
		if (value.startsWith("/") && !value.startsWith("//")) return true;
		try {
			const url = new URL(value);
			return (
				url.protocol === "https:" &&
				!url.username &&
				!url.password &&
				!url.port &&
				url.hostname === "cdn1.hackthehill.com"
			);
		} catch {
			return false;
		}
	}, "Image must use a configured local path or HTTPS host");
