import { useTranslation } from "next-i18next";
import Image from "next/image";

import Error from "./Error";
import Head from "./Head";
import Loading from "./Loading";

type FormPageProps = {
	children: React.ReactNode;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
	error?: string;
	invalid: string | null;
	loading: boolean;
	title: string;
};

const FormPage = ({ children, onSubmit, error, invalid, loading, title }: FormPageProps) => {
	const { t } = useTranslation("common");

	return (
		<>
			<Head title={title} />
			<main className="flex h-screen flex-col items-center justify-center bg-default-gradient bg-no-repeat text-center supports-[height:100cqh]:h-[100cqh] supports-[height:100svh]:h-[100svh]">
				<form onSubmit={onSubmit} className="flex flex-col items-center justify-center gap-6 px-12 text-center">
					<div className="flex flex-col items-center">
						<Image
							src="https://hackthehill.com/Logos/hackthehill-logo.svg"
							alt={t("hack-the-hill-logo-alt")}
							width={128}
							height={128}
							className="h-auto w-auto"
						/>
						<h1 className="font-coolvetica text-[clamp(1rem,3.5vmin,5rem)]  font-normal text-dark-color">
							Hack the Hill
						</h1>
					</div>
					{invalid && <p>{invalid}</p>}
					{!invalid && loading && !error && <Loading />}
					{error && <Error message={error} />}
					{!invalid && !error && !loading && (
						<div className="flex max-w-[25rem] flex-col items-center gap-6">{children}</div>
					)}
				</form>
			</main>
		</>
	);
};

export default FormPage;
