import { Role, type Prisma } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { trpc } from "../../utils/api";

import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";
import OnlyRole from "../../components/OnlyRole";

type HackerInfo = Prisma.HackerInfoGetPayload<true>;

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "hacker"]),
	};
};

const Hacker: NextPage = () => {
	const { t } = useTranslation("hacker");

	const router = useRouter();
	const [id] = [router.query.id].flat();

	const query = trpc.hackers.get.useQuery({ id: id ?? "" }, { enabled: !!id });

	if (query.isLoading || query.data == null) {
		return (
			<App>
				<Loading />
			</App>
		);
	} else if (query.isError) {
		return (
			<App>
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={query.error.message} />
				</div>
			</App>
		);
	}

	if (query.data == null) {
		void router.push("/404");
	}

	return (
		<App>
			<OnlyRole roles={[Role.ORGANIZER, Role.SPONSOR]}>
				<HackerView data={query.data} />
			</OnlyRole>
			<OnlyRole roles={[Role.HACKER]}>{t("not-authorized-to-view-this-page")}</OnlyRole>
		</App>
	);
};

type HackerViewProps = {
	data: HackerInfo;
};

const HackerView = ({ data }: HackerViewProps) => {
	return (
		<div>
			<h1 className="font-[Coolvetica] text-[clamp(1rem,3.5vmin,5rem)] font-normal text-dark">
				{data.firstName} {data.lastName}
			</h1>
			{...Object.keys(data).map(key => (
				<div key={key}>
					<b>{key}</b>: {(data[key as keyof HackerInfo] ?? "NULL").toString()}
				</div>
			))}
		</div>
	);
};

export default Hacker;
