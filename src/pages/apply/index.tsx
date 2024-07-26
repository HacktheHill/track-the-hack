import { Locale } from "@prisma/client";
import { getServerSession } from "next-auth";
import { Trans, useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next/types";
import { useCallback, useEffect, useRef, useState } from "react";

import { uploadResume } from "../../client/s3";
import App from "../../components/App";
import Loading from "../../components/Loading";
import { trpc } from "../../server/api/api";
import type { ApplicationQuestionsType, ProcessedField, ProcessedFieldGeneric } from "../../server/lib/apply";
import { getApplicationQuestions } from "../../server/lib/apply";
import { sessionRedirect } from "../../server/lib/redirects";
import { hackerSchema, pageSchemas } from "../../utils/common";
import { getAuthOptions } from "../api/auth/[...nextauth]";

type ProcessedEntryValue = string | boolean | Date | File | undefined;

const processValue = (key: string, value: string): ProcessedEntryValue => {
	if (value === "") {
		return undefined;
	} else if (value === "true") {
		return true;
	} else if (value === "false") {
		return false;
	} else if (key === "dateOfBirth") {
		return new Date(value);
	} else {
		return value;
	}
};

const processFormData = (formData: FormData) => {
	const processedEntries: [string, ProcessedEntryValue][] = [];

	formData.forEach((value, key) => {
		if (key.endsWith("-checkbox")) {
			processedEntries.push([key.replace("-checkbox", ""), value === "on"]);
		} else if (key.endsWith("-other")) {
			const baseKey = key.replace("-other", "");
			const baseValue = formData.get(baseKey);
			if (baseValue === "other") {
				processedEntries.push([baseKey, value]);
			}
		} else if (value instanceof File) {
			processedEntries.push([key, value]);
		} else {
			const processedValue = processValue(key, value);
			if (processedValue !== undefined) {
				processedEntries.push([key, processedValue]);
			}
		}
	});

	return Object.fromEntries(processedEntries);
};

const Apply = ({ applicationQuestions }: { applicationQuestions: ApplicationQuestionsType }) => {
	const { t } = useTranslation("apply");
	const router = useRouter();

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [step, setStep] = useState(0);
	const [formData, setFormData] = useState(new FormData());
	const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
	const formRef = useRef<HTMLFormElement>(null);

	const mutation = trpc.hackers.apply.useMutation();

	const validateCurrentPage = useCallback(() => {
		if (!formRef.current || step >= applicationQuestions.length || !applicationQuestions[step]) return false;

		const currentFormData = new FormData(formRef.current);
		currentFormData.forEach((value, key) => formData.set(key, value));

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
		setStep(step + 1);
		formRef.current?.scroll({
			left: (step + 1) * window.innerWidth,
			top: 0,
			behavior: "smooth",
		});
	}, [step, validateCurrentPage]);

	const handlePrevious = useCallback(() => {
		if (step <= 0) return;
		setStep(step - 1);
		formRef.current?.scroll({
			left: (step - 1) * window.innerWidth,
			behavior: "smooth",
		});
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

	const renderField = (field: ProcessedField) => {
		const fieldError = errors[field.name];
		const errorClass = fieldError ? "border-red-500" : "";
		const className = `w-full rounded border-none bg-light-primary-color/75 px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-light-primary-color/50 ${errorClass}`;

		switch (field.type) {
			case "select":
				return <Select field={field} className={className} />;
			case "radio":
				return <Radio field={field} className={className} />;
			case "multiselect":
				return <MultiSelect field={field} className={className} />;
			case "checkbox":
				return <Checkbox field={field} />;
			case "textarea":
				return <TextArea field={field} className={className} />;
			case "typeahead":
				return <Typeahead field={field} className={className} />;
			default:
				return <Input field={field} className={className} />;
		}
	};

	const renderFields = (fields: ProcessedField[], page: string) => {
		return fields.map(field => {
			const hasLinks = "links" in field && field.links?.length > 0;
			const fieldLinks = hasLinks
				? field.links.map((url: string) => (
						<Link
							href={url}
							key={url}
							className="text-dark-primary-color underline"
							target="_blank"
							rel="noopener noreferrer"
						/>
					))
				: [];

			const fieldError = errors[field.name] && <p className="text-red-500">{errors[field.name]}</p>;

			if (page === "preferredLanguage" && field.type === "radio") {
				return (
					<>
						<Language field={field} />
						{fieldError}
					</>
				);
			}

			const fieldLabel = (
				<label htmlFor={field.name} className="flex-[50%] font-rubik text-dark-color">
					<Trans i18nKey={`${page}.${field.name}.label`} t={t} components={fieldLinks} />
					{field.required && <span className="text-red-500">&nbsp;*</span>}
				</label>
			);

			const fieldInput = (
				<div className={`flex flex-col gap-2 ${field.type === "checkbox" ? "" : "w-full"}`}>
					{renderField(field)}
					{fieldError}
				</div>
			);

			return (
				<div key={field.name} className="flex flex-col items-center gap-2 sm:flex-row">
					{field.type === "checkbox" ? (
						<>
							{fieldInput}
							{fieldLabel}
						</>
					) : (
						<>
							{fieldLabel}
							{fieldInput}
						</>
					)}
				</div>
			);
		});
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

	return (
		<App className="overflow-y-auto bg-default-gradient" title={t("title")}>
			{success ? (
				<div className="flex flex-col items-center gap-8">
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
							key={index}
							className={`flex h-full w-screen flex-shrink-0 p-8 transition-opacity duration-1000 ease-in ${
								step <= index - 1 ? "opacity-0" : "opacity-100"
							}`}
							inert={step !== index ? true : undefined}
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
										{renderFields(page.questions, page.name)}
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

const Language = ({ field }: { field: ProcessedFieldGeneric<"radio"> }) => {
	const router = useRouter();
	const { t } = useTranslation("apply");

	return (
		<div className="flex justify-evenly gap-4">
			{Object.entries(field.options).map(([key, value]) => (
				<div key={key} className="flex">
					<input
						type="radio"
						id={`${field.name}-${key}`}
						name={field.name}
						value={key}
						checked={router.locale === key.toLocaleLowerCase()}
						className="peer hidden"
						onChange={() => {
							void router.push(router.pathname, router.pathname, {
								locale: key.toLocaleLowerCase(),
							});
						}}
					/>
					<label
						htmlFor={`${field.name}-${key}`}
						className="cursor-pointer whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-4xl text-dark-primary-color transition-colors hover:bg-light-tertiary-color peer-checked:bg-light-primary-color/50"
					>
						{t(value)}
					</label>
				</div>
			))}
		</div>
	);
};

const Select = ({ field, className }: { field: ProcessedFieldGeneric<"select">; className: string }) => {
	const { t } = useTranslation("apply");
	const [showOther, setShowOther] = useState(false);

	return (
		<>
			<select
				id={field.name}
				name={field.name}
				className={className}
				required={field.required}
				onChange={e => setShowOther(e.target.value === "other")}
			>
				<option value="">{t("select")}</option>
				{Object.entries(field.options).map(([key, value]: [string, string]) => (
					<option key={key} value={key}>
						{t(value)}
					</option>
				))}
			</select>
			{field.options.other && showOther && (
				<input id={`${field.name}-other`} name={`${field.name}-other`} type="text" className={className} />
			)}
		</>
	);
};

const Radio = ({ field, className }: { field: ProcessedFieldGeneric<"radio">; className: string }) => {
	const { t } = useTranslation("apply");
	const [showOther, setShowOther] = useState(false);

	return (
		<div className="flex gap-4">
			{Object.entries(field.options).map(([key, value]: [string, string]) => (
				<div key={key} className="flex items-center gap-2">
					<input
						id={field.name}
						name={field.name}
						type="radio"
						value={key}
						className="peer hidden"
						required={field.required}
						onChange={() => setShowOther(key === "other")}
					/>
					<label
						htmlFor={field.name}
						className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color peer-checked:bg-light-primary-color/50 short:text-base"
					>
						{t(value)}
					</label>
				</div>
			))}
			{field.options.other && showOther && (
				<input id={`${field.name}-other`} name={`${field.name}-other`} type="text" className={className} />
			)}
		</div>
	);
};

const MultiSelect = ({ field, className }: { field: ProcessedFieldGeneric<"multiselect">; className: string }) => {
	const { t } = useTranslation("apply");
	const [showOther, setShowOther] = useState(false);

	return (
		<div className="flex flex-col gap-2">
			<select
				id={field.name}
				name={field.name}
				multiple
				className={className}
				required={field.required}
				onChange={e =>
					setShowOther(
						Array.from(e.target.selectedOptions)
							.map(option => option.value)
							.includes("other"),
					)
				}
			>
				{Object.entries(field.options).map(([key, value]: [string, string]) => (
					<option key={key} value={key}>
						{t(value)}
					</option>
				))}
			</select>
			{field.options.other && showOther && (
				<input id={`${field.name}-other`} name={`${field.name}-other`} type="text" className={className} />
			)}
		</div>
	);
};

const Typeahead = ({ field, className }: { field: ProcessedFieldGeneric<"typeahead">; className: string }) => {
	const [options, setOptions] = useState<string[]>([]);

	useEffect(() => {
		const fetchOptions = async () => {
			const res = await fetch(field.url);
			const data = await res.text();
			setOptions(data.split("\n"));
		};

		void fetchOptions();
	}, [field.options.url, field.url]);

	return (
		<>
			<input
				id={field.name}
				name={field.name}
				list={`${field.name}-list`}
				className={className}
				required={field.required}
			/>
			<datalist id={`${field.name}-list`}>
				{options.map((option, i) => (
					<option key={i} value={option} />
				))}
			</datalist>
		</>
	);
};

const Checkbox = ({ field }: { field: ProcessedFieldGeneric<"checkbox"> }) => {
	return (
		<input
			id={field.name}
			name={`${field.name}-checkbox`}
			type="checkbox"
			className="h-4 w-4 appearance-none bg-transparent text-black after:block after:h-full after:w-full after:rounded-lg after:border after:border-dark-primary-color after:p-0.5 after:leading-[calc(100%*1/2)] after:checked:content-check"
			required={field.required}
		/>
	);
};

const TextArea = ({ field, className }: { field: ProcessedFieldGeneric<"textarea">; className: string }) => {
	const [charCount, setCharCount] = useState(0);

	return (
		<div className="relative w-full">
			<textarea
				id={field.name}
				name={field.name}
				className={className}
				required={field.required}
				onChange={e => {
					const { value } = e.target;
					if (field.charLimit && value.length > field.charLimit) {
						e.target.value = value.slice(0, field.charLimit);
					}
					setCharCount(value.length);
				}}
			/>
			{field.charLimit && (
				<p className="absolute bottom-2 right-2 text-right text-light-color">
					{charCount ?? 0}/{field.charLimit}
				</p>
			)}
		</div>
	);
};

const Input = ({
	field,
	className,
}: {
	field: ProcessedFieldGeneric<"text" | "email" | "tel" | "date" | "url" | "file">;
	className: string;
}) => {
	return (
		<input
			id={field.name}
			name={field.name}
			type={field.type}
			className={className}
			required={field.required}
			accept={field.type === "file" ? "application/pdf" : undefined}
		/>
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
