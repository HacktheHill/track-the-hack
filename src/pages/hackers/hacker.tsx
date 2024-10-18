import type { AcceptanceStatus } from "@prisma/client";
import { RoleName } from "@prisma/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { GetServerSideProps, NextPage } from "next";
import { getServerSession } from "next-auth";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { makeZodI18nMap } from "zod-i18n-map";

import { getHackerFields } from "../../client/hacker";
import { uploadResume } from "../../client/s3";
import App from "../../components/App";
import Error from "../../components/Error";
import Filter from "../../components/Filter";
import Loading from "../../components/Loading";
import TeamCreation from "../../components/TeamCreation";
import { trpc } from "../../server/api/api";
import type { AppRouter } from "../../server/api/root";
import { hackerRedirect } from "../../server/lib/redirects";
import { hackerSchema } from "../../utils/common";
import { getAuthOptions } from "../api/auth/[...nextauth]";
import Modal from "../../components/Modal";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Hacker = RouterOutput["hackers"]["get"];

const HackerPage: NextPage<{
	organizer: boolean;
	acceptance: boolean;
}> = ({ organizer, acceptance }) => {
	const router = useRouter();
	const [id] = [router.query.id].flat();
	const { t } = useTranslation("hacker");
	const { data: sessionData } = useSession();

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
			const fields = getHackerFields(hackerQuery.data, acceptance);
			const initialValues: Record<string, string> = {};
			Object.entries(fields).forEach(([categoryName, fieldGroup]) => {
				fieldGroup.forEach(field => {
					let value = field.value?.toString() ?? "";
					if ("options" in field && field.options?.length && field.type !== "select") {
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
	}, [acceptance, hackerQuery.data, t]);

	const handlePresenceIncrement = async (id: string, value: number) => {
		await presenceMutation.mutateAsync({ id, value });

		if (presenceMutation.isSuccess) {
			await presenceQuery.refetch();
		}

		if (presenceMutation.error) {
			console.error(presenceMutation.error.message);
		}
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);

		const resume = formData.get("resume") as File | null;
		const data = {
			...Object.fromEntries(formData),
			id: hackerQuery.data?.id,
			...(hackerQuery.data?.hasResume !== !!resume ? { hasResume: true } : {}),
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
		if (
			[RoleName.ORGANIZER, RoleName.MAYOR, RoleName.PREMIER].some(
				role => sessionData?.user?.roles.includes(role),
			) ||
			sessionData?.user?.hackerId == id
		) {
			resetInputFields();
		}
	}, [hackerQuery.data, id, resetInputFields, sessionData, t]);

	const statusColorMap: { [key: string]: string } = {
		PENDING: "bg-blue-400/75",
		ACCEPTED: "bg-green-400/75",
		WAITLISTED: "bg-yellow-400/75",
		REJECTED: "bg-red-400/75",
	} satisfies Record<AcceptanceStatus, string>;

	if (hackerQuery.isLoading || hackerQuery.data == null) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Filter value={[RoleName.ORGANIZER, RoleName.MAYOR, RoleName.PREMIER]} method="some">
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
				<Modal
					buttons={
						error || success
							? [
									{
										label: t("return-to-form"),
										onClick: () => {
											setError(null);
											setSuccess(false);
										},
									},
								]
							: []
					}
				>
					{loading && <Loading />}
					{error && <Error message={error} />}
					{success && <h3 className="text-4xl font-bold text-dark-color">{t("success")}</h3>}
				</Modal>
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

				{[RoleName.ORGANIZER, RoleName.MAYOR, RoleName.PREMIER].some(
					role => sessionData?.user?.roles.includes(role),
				) || sessionData?.user?.hackerId == id ? (
					<div className="organizerView">
						<div
							className={`rounded px-4 py-2 text-center font-coolvetica text-2xl font-normal text-dark-color ${
								statusColorMap[hackerQuery.data.acceptanceStatus] ?? "bg-gray-500"
							}`}
						>
							{t(`other.acceptanceStatus.${hackerQuery.data.acceptanceStatus}`)}
						</div>

						<div className="grid grid-flow-row gap-4 rounded-lg bg-light-tertiary-color p-4 mobile:grid-cols-2">
							{presenceQuery.data?.map((presence, index) => (
								<div key={index} className="grid grid-flow-col grid-cols-4 items-center">
									<p className="col-span-2">
										<b>{presence.label}</b>
									</p>
									<p>{presence.value}</p>
									<button
										className="w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-1 font-coolvetica text-dark-primary-color transition-colors hover:bg-light-tertiary-color"
										onClick={() => {
											void handlePresenceIncrement(presence.id, -1);
											presence.value -= 1;
										}}
									>
										—
									</button>
									<button
										className="w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-1 font-coolvetica text-dark-primary-color transition-colors hover:bg-light-tertiary-color"
										onClick={() => {
											void handlePresenceIncrement(presence.id, 1);
											presence.value += 1;
										}}
									>
										+
									</button>
								</div>
							))}
						</div>
						<form onSubmit={e => void handleSubmit(e)} className="flex flex-col gap-4">
							<div className="mt-4 grid gap-4">
								<div className="flex justify-between gap-2">
									<strong className="text-left font-bold">Login email:</strong>
									<span className="w-1/2 rounded border-none bg-light-primary-color/75 px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-light-primary-color/50">
										{(hackerQuery.data as unknown as HackerViewData).User?.email}
									</span>
								</div>
								<div className="flex justify-between gap-2">
									<strong className="text-left font-bold">Login Provider:</strong>
									<span className="w-1/2 rounded border-none bg-light-primary-color/75 px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-light-primary-color/50">
										{(hackerQuery.data as unknown as HackerViewData).User?.accounts[0]?.provider}
									</span>
								</div>
							</div>
							{Object.entries(getHackerFields(hackerQuery.data, acceptance)).map(
								([categoryName, fields], index) => (
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
														<p>
															{field.type === "select" && field.value
																? t(`${categoryName}.${field.name}.${field.value}`)
																: field.value}
														</p>
													)}
												</div>
											);
										})}
									</div>
								),
							)}
							<div className="flex flex-col gap-4">
								<h3 className="text-center font-coolvetica text-2xl text-dark-color">
									{t("links.title")}
								</h3>

								{!acceptance && (
									<input
										name="resume"
										className="m-auto w-fit rounded-md border border-dark-primary-color p-2"
										type="file"
										accept="application/pdf"
										onChange={e => {
											handleInputChange("resume", e.target.value);
										}}
									/>
								)}

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

							{hackerQuery.data.teamId ? (
								<TeamList hacker={hackerQuery.data as unknown as HackerViewData} />
							) : (
								<TeamCreation hacker={hackerQuery.data as unknown as HackerViewData} />
							)}

							{edit && (
								<div className="sticky bottom-0 mx-2 flex justify-center  font-coolvetica">
									<div className="flex max-w-md rounded-md bg-dark-primary-color px-2 py-2 text-light-color transition delay-150 ease-in-out">
										<p className="px-5 py-2 text-center">{t("unsavedChanges")}</p>
										{loading && <Loading />}
										<button
											className="px-4 py-2 text-light-quaternary-color"
											onClick={resetInputFields}
										>
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
				) : (
					<div className="HackerView">
						<div className="flex flex-col gap-4">
							<h3 className="text-center font-coolvetica text-2xl text-dark-color">{t("links.title")}</h3>

							<p className="flex flex-row flex-wrap justify-center gap-4">
								{Object.entries({
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
							<TeamList hacker={hackerQuery.data as unknown as HackerViewData} />
						</div>
					</div>
				)}
			</div>
		</App>
	);
};

type HackerViewData = {
	id: string;
	firstName: string;
	lastName: string;
	User: {
		email: string;
		accounts: {
			provider: string;
		}[];
	};
	Team: {
		name: string;
		hackers: Hacker[];
	};
};

const TeamList = ({ hacker }: { hacker: HackerViewData }) => {
	const { t } = useTranslation("hacker");
	return (
		<>
			<h3 className="text-center font-coolvetica text-2xl text-dark-color">
				{t("team")}: {hacker?.Team?.name}
			</h3>
			<ul className="text-center">
				{hacker?.Team?.hackers.map((member, index) => (
					<li key={index} className="flex flex-col gap-2">
						<p>
							{member.firstName} {member.lastName}
						</p>
					</li>
				))}
			</ul>
		</>
	);
};
export const getServerSideProps: GetServerSideProps = async ({ req, res, query, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));

	const [id] = [query.id].flat() as [string];

	return {
		props: {
			...(await serverSideTranslations(locale ?? "en", ["hacker", "zod", "common", "navbar"])),
			redirect: (await hackerRedirect(session, "/", id)) ?? null,
			organizer: session?.user?.roles.includes(RoleName.ORGANIZER) ?? false,
			acceptance: session?.user?.roles.includes(RoleName.ACCEPTANCE) ?? false,
		},
	};
};

export default HackerPage;
