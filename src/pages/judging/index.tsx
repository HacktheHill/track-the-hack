import type { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import JudgingWorkspace from "@/components/JudgingWorkspace";

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["judging", "navbar", "common"]),
});

export default JudgingWorkspace;
