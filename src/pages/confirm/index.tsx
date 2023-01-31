import { AttendanceType, ShirtSize } from "@prisma/client";
import { type NextPage } from "next";
import { signIn, signOut, useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { trpc } from "../../utils/api";

export async function getStaticProps({ locale }: { locale: string }) {
	return {
		props: await serverSideTranslations(locale, ["common", "confirm"]),
	};
}

const Confirm: NextPage = () => {
	const { t } = useTranslation("confirm");

	// Get session
	const { data: sessionData } = useSession();

	// Get query params
	const router = useRouter();
	const id = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;

	const mutation = trpc.hackers.assign.useMutation();

	const query = trpc.hackers.get.useQuery({ id: id ?? "" }, { enabled: !!id });

	const [shirtSize, setShirtSize] = useState<keyof typeof ShirtSize>(ShirtSize.S);
	const [attendanceType, setAttendanceType] = useState<keyof typeof AttendanceType>(AttendanceType.IN_PERSON);
	const [terms, setTerms] = useState(true);
	const [validationMessage, setValidationMessage] = useState("");
	const [isSubmitted, setIsSubmitted] = useState(false);

	useEffect(() => {
		if (query.data) {
			setShirtSize(query.data.shirtSize ?? ShirtSize.M);
			setAttendanceType(query.data.attendanceType);
			setIsSubmitted(query.data.confirmed);
			if (id && query.data.preferredLanguage.toLowerCase() !== router.locale) {
				void router.push(`/confirm?id=${id}`, undefined, {
					locale: query.data.preferredLanguage.toLowerCase(),
				});
			}
		}
	}, [query.data, id, router]);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!sessionData?.user?.id) {
			setValidationMessage(t("you-must-be-logged-in"));
			return;
		}

		if (!id) {
			setValidationMessage(t("error-no-id-found"));
			return;
		}

		if (!terms) {
			setValidationMessage(t("you-must-agree-to-the-terms-and-conditions"));
			return;
		}

		mutation.mutate({
			id,
			shirtSize,
			attendanceType,
			userId: sessionData.user.id,
		});

		setIsSubmitted(true);
	};

	const handleShirtSizeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
		setShirtSize(event.target.value as keyof typeof ShirtSize);
	}, []);

	const handleAttendanceTypeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setAttendanceType(event.target.value as keyof typeof AttendanceType);
	}, []);

	return (
		<>
			<Head>
				<title>Track the Hack</title>
				<meta
					name="description"
					content="An open source project to track the participants of the Hack the Hill hackathon."
				/>
				<link rel="shortcut icon" href="/favicon.svg" type="image/svg+xml" />
			</Head>
			<main className="flex h-screen flex-col items-center justify-center bg-gradient bg-no-repeat text-center supports-[max-height:100cqh]:max-h-[100cqh] supports-[max-height:100svh]:max-h-[100svh]">
				<form
					onSubmit={handleSubmit}
					className="flex flex-col items-center justify-center gap-6 px-12 text-center"
				>
					<div className="flex flex-col items-center">
						<Image
							src="https://hackthehill.com/Logos/hackthehill-logo.svg"
							alt="Hack the Hill logo"
							width={128}
							height={128}
							className="h-auto w-auto"
						/>
						<h1 className="font-[Coolvetica] text-[clamp(1rem,3.5vmin,5rem)]  font-normal text-dark">
							Hack the Hill
						</h1>
					</div>
					{isSubmitted ? (
						<div className="flex flex-col items-center justify-center gap-6">
							<h3 className="font-[Rubik] text-[clamp(1rem,1vmin,5rem)] font-medium text-dark">
								{t("thank-you-for-confirming-your-attendance")}
							</h3>
							<p className="font-[Rubik] text-[clamp(1rem,1vmin,5rem)] font-medium text-dark">
								{t("we-look-forward-to-seeing-you")}
							</p>
						</div>
					) : (
						<>
							{(!id || query.data === null) && <p>{t("invalid-confirmation-link")}</p>}
							{id && query.isLoading && !query.isError && (
								<div className="flex flex-col items-center justify-center">
									<svg
										className="h-10 w-10 animate-spin text-dark"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
									>
										<path fill="currentColor" d="M4 12a8 8 0 018-8v1a7 7 0 00-7 7h1z"></path>
									</svg>
									{t("loading")}
								</div>
							)}
							{query.isError && (
								<>
									<code>
										{t("error", {
											message: query.error.message,
										})}
									</code>
									<a href="mailto:development@hackthehill.com" target="_blank" rel="noreferrer">
										<button
											type="button"
											className="transform cursor-pointer whitespace-nowrap rounded-normal border-2 border-light px-[calc(2*clamp(.75rem,1vmin,5rem))] py-[clamp(0.75rem,1vmin,5rem)] font-[Rubik] text-[clamp(1rem,1vmin,5rem)] text-light shadow-[0_15px_25px_rgba(0,_0,_0,_0.15),_0_5px_10px_rgba(0,_0,_0,_0.05)] transition hover:bg-white/50"
										>
											{t("contact-us")}
										</button>
									</a>
								</>
							)}
							{query.data && !query.isError && (
								<div className="flex max-w-[25rem] flex-col items-center gap-6">
									<h3 className="font-[Rubik] text-[clamp(1rem,1vmin,5rem)] font-medium text-dark">
										{t("congratulations-for-your-acceptance", {
											name: query.data?.firstName ?? "",
										})}
									</h3>
									<div className="flex flex-col items-center justify-center gap-3">
										{sessionData?.user?.id ? (
											<>
												<p>
													{t("signed-in-as", {
														email: sessionData.user.email,
													})}
												</p>
												<button
													type="button"
													className="transform cursor-pointer whitespace-nowrap rounded-normal border-2 border-light px-[calc(2*clamp(.75rem,1vmin,5rem))] py-[clamp(0.75rem,1vmin,5rem)] font-[Rubik] text-[clamp(1rem,1vmin,5rem)] text-light shadow-[0_15px_25px_rgba(0,_0,_0,_0.15),_0_5px_10px_rgba(0,_0,_0,_0.05)] transition hover:bg-white/50"
													onClick={() => void signOut()}
												>
													{t("sign-out")}
												</button>
											</>
										) : (
											<button
												type="button"
												className="hover:bg-blue transform cursor-pointer whitespace-nowrap rounded-normal border-2 border-light px-[calc(2*clamp(.75rem,1vmin,5rem))] py-[clamp(0.75rem,1vmin,5rem)] font-[Rubik] text-[clamp(1rem,1vmin,5rem)] text-light shadow-[0_15px_25px_rgba(0,_0,_0,_0.15),_0_5px_10px_rgba(0,_0,_0,_0.05)] transition hover:bg-white/50"
												onClick={() => void signIn()}
											>
												{t("sign-in")}
											</button>
										)}
									</div>
									<div className="flex flex-col items-start justify-center gap-3">
										<p>{t("please-confirm-the-form-below")}</p>
										<div className="flex items-center justify-center gap-2">
											<input
												type="radio"
												id="in-person"
												name="attendanceType"
												value={AttendanceType.IN_PERSON}
												checked={attendanceType === AttendanceType.IN_PERSON}
												onChange={handleAttendanceTypeChange}
												className="flex h-4 w-4 appearance-none items-center justify-center rounded-full border border-medium bg-transparent text-black after:m-0.5 after:block after:h-full after:w-full after:border-black after:leading-[calc(100%*3/4)] after:checked:content-check"
											/>
											<label
												htmlFor="in-person"
												className="whitespace-nowrap text-[clamp(1rem,1vmin,5rem)]"
											>
												{t("attendanceType.in-person")}
											</label>
										</div>
										<div className="flex items-center justify-center gap-2">
											<input
												type="radio"
												id="online"
												name="attendanceType"
												value={AttendanceType.ONLINE}
												checked={attendanceType === AttendanceType.ONLINE}
												onChange={handleAttendanceTypeChange}
												className="flex h-4 w-4 appearance-none items-center justify-center rounded-full border border-medium bg-transparent text-black after:m-0.5 after:block after:h-full after:w-full after:border-black after:leading-[calc(100%*3/4)] after:checked:content-check"
											/>
											<label
												htmlFor="online"
												className="whitespace-nowrap text-[clamp(1rem,1vmin,5rem)]"
											>
												{t("attendanceType.online")}
											</label>
										</div>
										{attendanceType === AttendanceType.IN_PERSON && (
											<div className="flex items-center justify-center gap-6">
												<label
													htmlFor="shirtSize"
													className="whitespace-nowrap text-[clamp(1rem,1vmin,5rem)]"
												>
													{t("t-shirt.label")}
												</label>
												<div className="rounded-2xl border border-medium py-2 px-4">
													<select
														name="shirtSize"
														id="shirtSize"
														value={shirtSize}
														onChange={handleShirtSizeChange}
														className="w-full border-none bg-transparent text-inherit text-black focus-visible:outline-none"
													>
														<option value="S" className="bg-white">
															{t("t-shirt.small")}
														</option>
														<option value="M" className="bg-white">
															{t("t-shirt.medium")}
														</option>
														<option value="L" className="bg-white">
															{t("t-shirt.large")}
														</option>
														<option value="XL" className="bg-white">
															{t("t-shirt.x-large")}
														</option>
														<option value="XXL" className="bg-white">
															{t("t-shirt.xx-large")}
														</option>
													</select>
												</div>
											</div>
										)}
									</div>
									<div className="flex flex-col gap-3">
										<div className="flex flex-row items-center justify-center gap-2">
											<input
												type="checkbox"
												id="terms"
												name="terms"
												checked={terms}
												onChange={() => setTerms(!terms)}
												className="h-4 w-4 appearance-none rounded border border-medium bg-transparent text-black after:block after:h-full after:w-full after:border-black after:p-0.5 after:leading-[calc(100%*1/2)] after:checked:content-check"
											/>
											<label htmlFor="terms" className="flex-1">
												{t("terms-and-conditions")}{" "}
												<a
													href="/Hack_the_Hill_2023_waiver_and_terms.pdf"
													target="_blank"
													rel="noreferrer"
													className="underline"
												>
													{t("terms-and-conditions-link")}
												</a>
											</label>
										</div>
										{validationMessage && (
											<p className="text-center text-red-500">{validationMessage}</p>
										)}
										<button
											type="submit"
											className="transform cursor-pointer whitespace-nowrap rounded-normal border-0 bg-light px-[calc(2*clamp(.75rem,1vmin,5rem))] py-[clamp(0.75rem,1vmin,5rem)] font-[Rubik] text-[clamp(1rem,1vmin,5rem)] text-white shadow-[0_15px_25px_rgba(0,_0,_0,_0.15),_0_5px_10px_rgba(0,_0,_0,_0.05)] transition hover:bg-medium"
										>
											{t("confirm")}
										</button>
									</div>
								</div>
							)}
						</>
					)}
				</form>
			</main>
		</>
	);
};

export default Confirm;
