import type { GetServerSideProps } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { Locale } from "@prisma/client";
import { getServerSession } from "next-auth";
import { uploadResume } from "../../client/s3";
import App from "../../components/App";
import Fields from "../../components/apply/Fields";
import Loading from "../../components/Loading";
import { trpc } from "../../server/api/api";
import { getApplicationQuestions, type ApplicationQuestionsType } from "../../server/lib/apply";
import { sessionRedirect } from "../../server/lib/redirects";
import { processFormData, saveToSessionStorage } from "../../utils/apply";
import { hackerSchema, pageSchemas } from "../../utils/common";
import { getAuthOptions } from "../api/auth/[...nextauth]";

const Apply = ({ applicationQuestions }: { applicationQuestions: ApplicationQuestionsType }) => {
	const { t } = useTranslation("apply");
	const router = useRouter();

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [step, setStep] = useState<number>(0);
	const [formData, setFormData] = useState(new FormData());
	const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
	const formRef = useRef<HTMLFormElement>(null);

	const mutation = trpc.hackers.apply.useMutation();

	const validateCurrentPage = useCallback(() => {
		if (!formRef.current || step >= applicationQuestions.length || !applicationQuestions[step]) return false;

		const currentFormData = new FormData(formRef.current);
		currentFormData.forEach((value, key) => formData.set(key, value));
		saveToSessionStorage(currentFormData);

		const pageName = applicationQuestions[step].name;
		if (pageName in pageSchemas) {
			const pageData = processFormData(currentFormData);
			const schema = pageSchemas[pageName as keyof typeof pageSchemas];
			const parseResult = schema.safeParse(pageData);
			if (!parseResult.success) {
				const newErrors = parseResult.error.flatten().fieldErrors;
				setErrors(newErrors);
				console.error(parseResult.error.message);
				return false;
			}
		}

		setErrors({});
		return true;
	}, [applicationQuestions, formData, step]);

	const handleNext = useCallback(() => {
		if (!validateCurrentPage()) return;
		const newStep = step + 1;
		formRef.current?.scroll({
			left: newStep * window.innerWidth,
			top: 0,
			behavior: "smooth",
		});
		setStep(newStep);
	}, [step, validateCurrentPage]);

	const handlePrevious = useCallback(() => {
		if (step <= 0) return;
		const newStep = step - 1;
		formRef.current?.scroll({
			left: newStep * window.innerWidth,
			top: 0,
			behavior: "smooth",
		});
		setStep(newStep);
	}, [step]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		if (!validateCurrentPage()) return;

		const resume = formData.get("resume") as File | null;
		const data = {
			...processFormData(formData),
			hasResume: !!resume,
		};

		const parse = hackerSchema.safeParse(data);
		if (!parse.success) {
			setError(t("invalid-form"));
			console.error(parse.error.message);
		} else {
			setLoading(true);
			const result = await mutation.mutateAsync(parse.data);
			if (result.presignedUrl && resume) {
				await uploadResume(result.presignedUrl, resume, resume.name);
			}
			sessionStorage.removeItem("applyFormData");

			if (!mutation.error) {
				setError(null);
				setFormData(new FormData());
				setSuccess(true);
			} else {
				setError(mutation.error.message);
			}
			setLoading(false);
		}
	};

	useEffect(() => {
		if (mutation.error) {
			setError(mutation.error.message);
		}
	}, [mutation.error]);

	useEffect(() => {
		const handleKeydown = (event: KeyboardEvent) => {
			if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "")) return;

			if (event.key === "ArrowRight" || event.key === " " || event.key === "Enter") {
				handleNext();
			} else if (event.key === "ArrowLeft") {
				handlePrevious();
			}
		};

		const handleSwipe = (event: TouchEvent) => {
			const x = event.changedTouches[0]?.clientX;
			if (!x) return;
			const deltaX = x - (event.target as HTMLElement).clientWidth;

			if (deltaX > 0) {
				handlePrevious();
			} else {
				handleNext();
			}
		};

		const handleResize = () => {
			if (formRef.current) {
				formRef.current.scroll({
					left: step * window.innerWidth,
				});
			}
		};

		window.addEventListener("keydown", handleKeydown);
		window.addEventListener("touchend", handleSwipe);
		window.addEventListener("resize", handleResize);
		return () => {
			window.removeEventListener("keydown", handleKeydown);
			window.removeEventListener("touchend", handleSwipe);
			window.removeEventListener("resize", handleResize);
		};
	}, [handleNext, handlePrevious, step]);

	useEffect(() => {
		const savedData = sessionStorage.getItem("applyFormData");
		if (savedData) {
			const parsedData = JSON.parse(savedData) as Record<string, FormDataEntryValue | FormDataEntryValue[]>;
			Object.entries(parsedData).forEach(([key, value]) => {
				if (Array.isArray(value)) {
					value.forEach(val => formData.append(key, val));
				} else {
					formData.set(key, value);
				}
			});
		}
	}, [formData]);

	return (
		<App className="overflow-y-auto bg-default-gradient" title={t("title")}>
			{success ? (
				<div className="flex h-full flex-col items-center justify-center gap-8">
					<h3 className="font-rubik text-4xl font-bold text-dark-color">{t("title")}</h3>
					<p>{t("success")}</p>
					<button
						className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
						onClick={() => void router.replace("/")}
					>
						{t("back")}
					</button>
				</div>
			) : (
				<form
					ref={formRef}
					className="flex h-full w-screen overflow-x-hidden"
					onSubmit={e => void handleSubmit(e)}
				>
					{applicationQuestions.map((page, index) => (
						<div
							key={page.name}
							className={`flex h-full w-screen flex-shrink-0 p-8 transition-opacity duration-1000 ease-in ${
								step <= index - 1 ? "opacity-0" : "opacity-100"
							}`}
							// @ts-expect-error https://github.com/facebook/react/issues/17157#issuecomment-2012795215
							inert={step !== index ? "" : undefined}
						>
							<div className="m-auto flex flex-col gap-4 rounded border-dark-primary-color p-8 mobile:w-2/3 mobile:gap-8 mobile:border mobile:bg-light-quaternary-color/50">
								<h3 className="text-center font-rubik text-4xl font-bold text-dark-primary-color">
									{t(`${page.name}.title`)}
								</h3>
								<p className="text-center">{t(`${page.name}.description`)}</p>
								{page.questions.length === 0 ? (
									<Image
										priority
										className="z-10 m-auto"
										src="/assets/mascot-waving.svg"
										alt="Mascot"
										width={225}
										height={225}
									/>
								) : (
									<div className="flex flex-col gap-4 mobile:my-auto">
										<Fields
											fields={page.questions}
											errors={errors}
											formData={formData}
											page={page.name}
										/>
									</div>
								)}
								{index === applicationQuestions.length - 1 && (
									<button
										type="submit"
										className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
									>
										{t("submit")}
									</button>
								)}
								{loading && <Loading />}
								{error && (
									<div className="flex flex-col items-center gap-2">
										<p className="text-center font-rubik text-red-500">{error}</p>
									</div>
								)}
							</div>
						</div>
					))}
					{step > 0 && (
						<button
							type="button"
							onClick={handlePrevious}
							aria-label={t("previous")}
							className="fixed left-0 h-full w-8 text-dark-primary-color mobile:w-24"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								className="-translate-y-1/2 transform"
							>
								<path d="M14 7l-5 5 5 5V7z" />
							</svg>
						</button>
					)}
					{step < applicationQuestions.length - 1 && (
						<button
							type="button"
							onClick={handleNext}
							aria-label={t("next")}
							className="fixed right-0 h-full w-8 text-dark-primary-color mobile:w-24"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								className="-translate-y-1/2 transform"
							>
								<path d="M10 17l5-5-5-5v10z" />
							</svg>
						</button>
					)}
				</form>
			)}
		</App>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));

	return {
		redirect: sessionRedirect(session, "/apply"),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["apply", "navbar", "common"])),
			applicationQuestions: getApplicationQuestions(
				locale && locale in Locale ? (locale as keyof typeof Locale) : "EN",
			),
		},
	};
};

export default Apply;
