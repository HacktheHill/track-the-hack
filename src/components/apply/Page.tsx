import { useTranslation } from "next-i18next";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ApplicationQuestionsType } from "../../server/lib/apply";
import Loading from "../Loading";
import Fields from "./Fields";

const Page = ({
	page,
	formData,
	index,
	isLastPage,
	setStep,
	errors,
	validatePage,
}: {
	page: ApplicationQuestionsType[number];
	formData: FormData;
	index: number;
	isLastPage?: boolean;
	setStep: React.Dispatch<React.SetStateAction<number>>;
	errors: Record<string, string[] | undefined>;
	validatePage: (page: ApplicationQuestionsType[number]) => boolean;
}) => {
	const { t } = useTranslation("apply");
	const pageRef = useRef<HTMLDivElement>(null);

	const [loading, setLoading] = useState(false);

	const handleNext = () => {
		setLoading(true);
		if (validatePage(page)) {
			setStep(prev => (index + 1 > prev ? index + 1 : prev));
			setTimeout(() => {
				pageRef.current?.nextElementSibling?.scrollIntoView({
					behavior: "smooth",
					block: "start",
				});
			}, 500);
		}
		setLoading(false);
	};

	useEffect(() => {
		const ref = pageRef.current;

		if (!ref) return;

		const observer = new IntersectionObserver(
			entries => {
				entries.forEach(entry => {
					const { isIntersecting } = entry;
					if (isIntersecting) {
						ref.style.opacity = "1";
					} else {
						ref.style.opacity = "";
					}
				});
			},
			{ threshold: 0.1 },
		);

		if (ref) {
			observer.observe(ref);
		}

		return () => {
			if (ref) {
				observer.unobserve(ref);
			}
		};
	}, [index]);

	return (
		<div
			key={page.name}
			ref={pageRef}
			className="m-auto flex min-h-[calc(100dvh-140px)] w-full transform opacity-0 transition-opacity duration-1000 ease-in-out mobile:min-h-[calc(100dvh-75px)]"
		>
			<div className="m-auto flex w-full flex-col gap-4 rounded border-dark-primary-color p-4 mobile:w-2/3 mobile:gap-8 mobile:border mobile:bg-light-quaternary-color/50 mobile:p-8">
				<h3 className="text-center font-rubik text-4xl font-bold text-dark-primary-color">
					{t(`${page.name}.title`)}
				</h3>
				<p className="text-center">{t(`${page.name}.description`)}</p>
				{page.questions.length === 0 ? (
					<Image
						priority
						className="z-10 mx-auto"
						src="/assets/mascot-waving.svg"
						alt="Mascot"
						width={225}
						height={225}
					/>
				) : (
					<div className="flex flex-col gap-4 mobile:my-auto">
						<Fields fields={page.questions} errors={errors} formData={formData} page={page.name} />
					</div>
				)}
				{isLastPage ? (
					<button
						type="submit"
						className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
					>
						{t("submit")}
					</button>
				) : (
					<button
						type="button"
						onClick={handleNext}
						className="mx-auto flex w-2/3 items-center justify-center whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							className="h-8 rotate-90"
						>
							<path d="M10 17l5-5-5-5v10z" />
						</svg>
						{t("next")}
					</button>
				)}
				{loading && <Loading />}
			</div>
		</div>
	);
};

export default Page;
