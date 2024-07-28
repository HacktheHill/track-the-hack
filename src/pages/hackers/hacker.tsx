import type { ApplicationStatus } from "@prisma/client";
import { RoleName } from "@prisma/client";
import type { GetServerSideProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { trpc } from "../../server/api/api";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { getHackerFields } from "../../client/hacker";
import { uploadResume } from "../../client/s3";
import App from "../../components/App";
import Error from "../../components/Error";
import Filter from "../../components/Filter";
import Loading from "../../components/Loading";
import { hackerRedirect } from "../../server/lib/redirects";
import { hackerSchema } from "../../utils/common";
import { getAuthOptions } from "../api/auth/[...nextauth]";
import { makeZodI18nMap } from "zod-i18n-map";

const HackerPage: NextPage<{ organizer: boolean }> = ({ organizer }) => {
	const router = useRouter();
	const [id] = [router.query.id].flat();
	const { t } = useTranslation("hacker");

	const hackerQuery = trpc.hackers.get.useQuery({ id: id ?? "" }, { enabled: !!id });
	const presenceQuery = trpc.presence.getFromHackerId.useQuery(
		{ id: id ?? "" },
		{
			enabled: !!id && organizer,
		},
	);
	const nextHackerQuery = trpc.hackers.getNext.useQuery(
		{ id: id ?? "" },
		{
			enabled: !!id && organizer,
			refetchOnMount: false,
		},
	);
	const prevHackerQuery = trpc.hackers.getPrev.useQuery(
		{ id: id ?? "" },
		{
			enabled: !!id && organizer,
			refetchOnMount: false,
		},
	);
	const downloadResume = trpc.hackers.downloadResume.useQuery(
		{ id: id ?? "" },
		{ enabled: !!id && !!hackerQuery.data?.hasResume },
	);

	const errorMap = makeZodI18nMap({ t });

	const [edit, setEdit] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [inputValues, setInputValues] = useState<Record<string, string>>({});

	const mutation = trpc.hackers.update.useMutation();
	const presenceMutation = trpc.presence.increment.useMutation();

	const handleInputChange = (name: string, value: string) => {
		setInputValues(prev => ({ ...prev, [name]: value }));
		setEdit(true);
	};

	const resetInputFields = useCallback(() => {
		if (hackerQuery.data) {
			const fields = getHackerFields(hackerQuery.data);
			const initialValues: Record<string, string> = {};
			Object.entries(fields).forEach(([categoryName, fieldGroup]) => {
				fieldGroup.forEach(field => {
					let value = field.value?.toString() ?? "";
					if ("options" in field && field.options?.length) {
						const localizedOption = field.options.find(option => option === value);
						if (localizedOption) {
							value = t(`${categoryName}.${field.name}.${localizedOption}`);
						}
					}
					initialValues[field.name] = value;
				});
			});
			setInputValues(initialValues);
		}
		setEdit(false);
	}, [hackerQuery.data, t]);

	const handlePresenceIncrement = async (key: string) => {
		await presenceMutation.mutateAsync({ key });

		if (presenceMutation.isSuccess) {
			await presenceQuery.refetch();
		}

		if (presenceMutation.error) {
			console.log("Error", presenceMutation.error.message);
		}
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);

		const resume = formData.get("resume") as File | null;
		const data = {
			...Object.fromEntries(formData),
			id: hackerQuery.data?.id,
			hasResume: !!resume,
		};

		const parse = hackerSchema
			.partial()
			.extend({
				id: z.string(),
			})
			.safeParse(data, { errorMap });

		if (!parse.success) {
			setError(t("invalid-form"));
			console.error(parse.error.message);
			return;
		}

		setLoading(true);
		setError(null);
		setSuccess(false);

		try {
			const result = await mutation.mutateAsync(parse.data);
			if (result.presignedUrl && resume) {
				await uploadResume(result.presignedUrl, resume, resume.name);
			}
			setSuccess(true);
		} catch (err) {
			setError((err as Error).message ?? t("unknown-error"));
			console.error(err);
		} finally {
			setEdit(false);
			setLoading(false);
		}
	};

	useEffect(() => {
		resetInputFields();
	}, [hackerQuery.data, resetInputFields, t]);

	const statusColorMap: { [key: string]: string } = {
		PENDING: "bg-blue-400/75",
		ACCEPTED: "bg-green-400/75",
		WAITLISTED: "bg-yellow-400/75",
		REJECTED: "bg-red-400/75",
	} satisfies Record<ApplicationStatus, string>;

	if (hackerQuery.isLoading || hackerQuery.data == null) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Filter value={[RoleName.ORGANIZER, RoleName.SPONSOR]} method="some">
					<Loading />
					<Error message={t("common:unauthorized")} />
				</Filter>
			</App>
		);
	} else if (hackerQuery.isError) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Error message={hackerQuery.error.message} />
			</App>
		);
	}

	if (hackerQuery.data == null) {
		void router.push("/404");
	}

	if (organizer && (presenceQuery.isLoading || presenceQuery.data == null)) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Loading />
			</App>
		);
	} else if (presenceQuery.isError) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Error message={presenceQuery.error.message} />
			</App>
		);
	}

	return (
		<App
			className="mx-auto h-full w-full overflow-y-auto bg-default-gradient px-4 py-12"
			title={`${hackerQuery.data.firstName} ${hackerQuery.data.lastName}`}
		>
			{(loading || error || success) && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-light-tertiary-color bg-opacity-90">
					<div className="w-full max-w-lg rounded border border-dark-primary-color bg-light-quaternary-color p-8 text-center">
						{loading && <Loading />}
						{error && <Error message={error} />}
						{success && <h3 className="text-4xl font-bold text-dark-color">{t("success")}</h3>}
						{(error || success) && (
							<button
								type="button"
								className="mt-4 whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
								onClick={() => {
									setError(null);
									setSuccess(false);
								}}
							>
								{t("return-to-form")}
							</button>
						)}
					</div>
				</div>
			)}
			<div className="mx-auto flex max-w-2xl flex-col gap-4">
				<div className="flex justify-between">
					{prevHackerQuery.data && (
						<a
							href={`/hackers/hacker?id=${prevHackerQuery.data.id}`}
							className="flex items-center justify-center gap-2 rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color"
						>
							{t("previous")}
						</a>
					)}
					{nextHackerQuery.data && (
						<a
							href={`/hackers/hacker?id=${nextHackerQuery.data.id}`}
							className="flex items-center justify-center gap-2 rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color"
						>
							{t("next")}
						</a>
					)}
				</div>

				<h1 className="text-center font-coolvetica text-4xl font-normal text-dark-color">
					{hackerQuery.data.firstName} {hackerQuery.data.lastName}{" "}
					{hackerQuery.data.pronouns && <>({hackerQuery.data.pronouns})</>}
				</h1>

				<div
					className={`rounded px-4 py-2 text-center font-coolvetica text-2xl font-normal text-dark-color ${
						statusColorMap[hackerQuery.data.applicationStatus] ?? "bg-gray-500"
					}`}
				>
					{t(`applicationStatus.${hackerQuery.data.applicationStatus}`)}
				</div>

				<Filter value={[RoleName.ORGANIZER]} method="some" silent>
					<div className="grid grid-flow-row grid-cols-2 gap-4 rounded-lg bg-light-tertiary-color p-4">
						{presenceQuery.data?.map((presence, index) => (
							<div key={index} className="flex justify-between gap-4">
								<p>
									<b>{presence.label}</b>
								</p>
								<p>{presence.value}</p>
								<button
									className="rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color"
									onClick={() => void handlePresenceIncrement(presence.key)}
								>
									{presence.value >= 2 ? "+" : presence.value === 1 ? "True" : "False"}
								</button>
							</div>
						))}
					</div>
				</Filter>

				<form onSubmit={e => void handleSubmit(e)} className="flex flex-col gap-4">
					{Object.entries(getHackerFields(hackerQuery.data)).map(([categoryName, fields], index) => (
						<div className="flex flex-col gap-4" key={index}>
							<h3 className="text-center font-coolvetica text-2xl text-dark-color">
								{t(`${categoryName}.title`)}
							</h3>
							{fields.map((field, index) => {
								const fieldAttributes = {
									id: field.name,
									name: field.name,
									type: field.type,
									className:
										"w-1/2 rounded border-none bg-light-primary-color/75 px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-light-primary-color/50",
									value: inputValues[field.name] ?? "",
									onChange: (
										e: React.ChangeEvent<
											HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
										>,
									) => handleInputChange(field.name, e.target.value),
								};

								return (
									<div key={index} className="flex justify-between gap-2">
										<strong className="text-left font-bold">
											{"options" in field && field.options
												? t(`${categoryName}.${field.name}.label`)
												: t(`${categoryName}.${field.name}`)}
										</strong>
										{"editable" in field && field.editable ? (
											field.type === "select" ? (
												<select {...fieldAttributes}>
													{field.options?.map((option, index) => (
														<option key={index} value={option}>
															{option}
														</option>
													))}
												</select>
											) : field.type === "textarea" ? (
												<textarea {...fieldAttributes} />
											) : (
												<input {...fieldAttributes} />
											)
										) : (
											<p>{fieldAttributes.value}</p>
										)}
									</div>
								);
							})}
						</div>
					))}
					<div className="flex flex-col gap-4">
						<h3 className="text-center font-coolvetica text-2xl text-dark-color">{t("links.title")}</h3>

						<input
							name="resume"
							className="w-fit rounded-md border border-dark-primary-color p-2"
							type="file"
							accept="application/pdf"
							onChange={e => {
								handleInputChange("resume", e.target.value);
							}}
						/>

						<p className="flex flex-row flex-wrap justify-center gap-4">
							{Object.entries({
								resume: downloadResume.data,
								linkedin: hackerQuery.data.linkedin,
								github: hackerQuery.data.github,
								personalWebsite: hackerQuery.data.personalWebsite,
							}).map(
								([key, value]) =>
									value && (
										<a
											key={key}
											href={value}
											target="_blank"
											rel="noreferrer"
											className="flex items-center justify-center gap-2 rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color"
										>
											{t(`links.${key}`)}
										</a>
									),
							)}
						</p>
					</div>

					{edit && (
						<div className="sticky bottom-0 mx-2 flex justify-center  font-coolvetica">
							<div className="flex max-w-md rounded-md bg-dark-primary-color px-2 py-2 text-light-color transition delay-150 ease-in-out">
								<p className="px-5 py-2 text-center">{t("unsavedChanges")}</p>
								{loading && <Loading />}
								<button className="px-4 py-2 text-light-quaternary-color" onClick={resetInputFields}>
									{t("reset")}
								</button>
								<button
									className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 text-dark-color transition-all duration-500 hover:bg-light-tertiary-color"
									type="submit"
								>
									{t("save")}
								</button>
							</div>
						</div>
					)}
				</form>
			</div>
		</App>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, query, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));

	const [id] = [query.id].flat() as [string];

	return {
		props: {
			...(await serverSideTranslations(locale ?? "en", ["hacker", "common", "navbar"])),
			redirect: (await hackerRedirect(session, "/", id)) ?? null,
			organizer: session?.user?.roles.includes(RoleName.ORGANIZER) ?? false,
		},
	};
};

export default HackerPage;
