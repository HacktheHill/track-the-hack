import type { GetServerSideProps } from "next";

export const legacyRolesDestination = (locale?: string, defaultLocale?: string) =>
	locale && locale !== defaultLocale ? `/${locale}/internal/access` : "/internal/access";

export const getServerSideProps: GetServerSideProps = ({ locale, defaultLocale }) =>
	Promise.resolve({
		redirect: {
			destination: legacyRolesDestination(locale, defaultLocale),
			permanent: false,
		},
	});

export default function LegacyRolesRedirect() {
	return null;
}
