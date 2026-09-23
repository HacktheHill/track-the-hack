import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import App from "@/components/App";
import ScheduleEventDetails from "@/components/ScheduleEventDetails";

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "event"]),
});

const EventPage: NextPage = () => {
	const { t } = useTranslation("event");
	const router = useRouter();
	const id = typeof router.query.id === "string" ? router.query.id : "";
	return (
		<App
			className="flex h-full flex-col items-center overflow-y-auto bg-default-gradient"
			title={t("title")}
			integrated
		>
			<ScheduleEventDetails id={id} />
		</App>
	);
};

export default EventPage;
