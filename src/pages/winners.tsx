import type { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

export {
	default,
	generalWinners,
	civicWinners,
	cgiWinners,
	miniChallengeWinners,
	mlhChallengeWinners,
} from "@/components/WinnersPage";

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "winners"]),
});
