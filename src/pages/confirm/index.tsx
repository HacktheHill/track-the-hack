import { AttendanceType, ShirtSize } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { signIn, signOut, useSession } from "next-auth/react";
import { Trans, useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import FormPage from "../../components/FormPage";
import { trpc } from "../../utils/api";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "confirm"]),
	};
};

const Confirm: NextPage = () => {
	const { t } = useTranslation("confirm");

	// Get session
	const { data: sessionData } = useSession();

	// Get query params
	const router = useRouter();
	const [id] = [router.query.id].flat();

	const mutation = trpc.hackers.confirm.useMutation();

	const query = trpc.hackers.get.useQuery({ id: id ?? "" }, { enabled: !!id });

	const [shirtSize, setShirtSize] = useState<keyof typeof ShirtSize>(ShirtSize.S);
	const [attendanceType, setAttendanceType] = useState<keyof typeof AttendanceType>(AttendanceType.IN_PERSON);
	const [terms, setTerms] = useState(false);
	const [validationMessage, setValidationMessage] = useState("");
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (query.error) setError(query.error.message);
		if (mutation.error) setError(mutation.error.message);
		if (query.data) {
			if (query.data.confirmed === false && (query.data.acceptanceExpiry ?? 0) < new Date()) {
				setError(t("acceptance-expired"));
				return;
			}

			setShirtSize(query.data.shirtSize ?? ShirtSize.M);
			setAttendanceType(
				query.data.onlyOnline ? AttendanceType.ONLINE : query.data.attendanceType ?? AttendanceType.IN_PERSON,
			);
			setIsSubmitted(query.data.confirmed);
		}
	}, [query.data, query.error, mutation.error, t]);

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
			setValidationMessage(t("you-must-accept-terms"));
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
		<FormPage
			onSubmit={handleSubmit}
			error={error}
			invalid={!id || query.data === null ? t("invalid-confirmation-link") : null}
			loading={id != null && query.isLoading && !query.isError}
			path={query.data?.id ? `/confirm?id=${query.data?.id}` : null}
			user={query.data ?? null}
			title={t("confirm")}
		>
			{isSubmitted ? (
				<div className="flex flex-col items-center justify-center gap-6">
					<h3 className="font-rubik text-[clamp(1rem,1vmin,5rem)] font-medium text-dark-color">
						{t("thank-you-for-confirming-your-attendance")}
					</h3>
					<p className="font-rubik text-[clamp(1rem,1vmin,5rem)] font-medium text-dark-color">
						{t("we-look-forward-to-seeing-you")}
					</p>
				</div>
			) : (
				<div className="flex max-w-[25rem] flex-col items-center gap-6">
					<h3 className="font-rubik text-[clamp(1rem,1vmin,5rem)] font-medium text-dark-color">
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
									className="transform cursor-pointer whitespace-nowrap rounded-normal border-2 border-light-color px-[calc(2*clamp(.75rem,1vmin,5rem))] py-[clamp(0.75rem,1vmin,5rem)] font-rubik text-[clamp(1rem,1vmin,5rem)] text-light-color shadow-[0_15px_25px_rgba(0,_0,_0,_0.15),_0_5px_10px_rgba(0,_0,_0,_0.05)] transition hover:bg-white/50"
									onClick={() => void signOut()}
								>
									{t("sign-out")}
								</button>
							</>
						) : (
							<button
								type="button"
								className="hover:bg-blue transform cursor-pointer whitespace-nowrap rounded-normal border-2 border-light-color px-[calc(2*clamp(.75rem,1vmin,5rem))] py-[clamp(0.75rem,1vmin,5rem)] font-rubik text-[clamp(1rem,1vmin,5rem)] text-light-color shadow-[0_15px_25px_rgba(0,_0,_0,_0.15),_0_5px_10px_rgba(0,_0,_0,_0.05)] transition hover:bg-white/50"
								onClick={() => void signIn()}
							>
								{t("sign-in")}
							</button>
						)}
					</div>
					{query.data?.walkIn === false &&
						(query.data?.onlyOnline ? (
							<p className="font-rubik text-[clamp(1rem,1vmin,5rem)] font-medium text-dark-color">
								{t("only-online")}
							</p>
						) : (
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
										className="border-medium flex h-4 w-4 appearance-none items-center justify-center rounded-full border bg-transparent text-black after:m-0.5 after:block after:h-full after:w-full after:border-black after:leading-[calc(100%*3/4)] after:checked:content-check"
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
										className="border-medium flex h-4 w-4 appearance-none items-center justify-center rounded-full border bg-transparent text-black after:m-0.5 after:block after:h-full after:w-full after:border-black after:leading-[calc(100%*3/4)] after:checked:content-check"
									/>
									<label htmlFor="online" className="whitespace-nowrap text-[clamp(1rem,1vmin,5rem)]">
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
										<div className="border-medium rounded-2xl border px-4 py-2">
											<select
												name="shirtSize"
												id="shirtSize"
												value={shirtSize}
												onChange={handleShirtSizeChange}
												className="w-full border-none bg-transparent text-black text-inherit focus-visible:outline-none"
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
						))}
					<div className="flex flex-col gap-3">
						<div className="flex flex-row items-center justify-center gap-2">
							<input
								type="checkbox"
								id="terms"
								name="terms"
								checked={terms}
								onChange={() => setTerms(!terms)}
								className="border-medium h-4 w-4 appearance-none rounded-lg border bg-transparent text-black after:block after:h-full after:w-full after:border-black after:p-0.5 after:leading-[calc(100%*1/2)] after:checked:content-check"
							/>
							<label htmlFor="terms" className="flex-1">
								<Trans
									i18nKey="accept-terms"
									t={t}
									components={{
										a: (
											<a
												href="/Hack_the_Hill_2023_waiver_and_terms.pdf"
												target="_blank"
												rel="noreferrer"
												className="underline"
											/>
										),
									}}
								/>
							</label>
						</div>
						{validationMessage && <p className="text-center text-red-500">{validationMessage}</p>}
						<button
							type="submit"
							className="hover:bg-medium transform cursor-pointer whitespace-nowrap rounded-normal border-0 bg-light-color px-[calc(2*clamp(.75rem,1vmin,5rem))] py-[clamp(0.75rem,1vmin,5rem)] font-rubik text-[clamp(1rem,1vmin,5rem)] text-white shadow-[0_15px_25px_rgba(0,_0,_0,_0.15),_0_5px_10px_rgba(0,_0,_0,_0.05)] transition"
						>
							{t("confirm")}
						</button>
					</div>
				</div>
			)}
		</FormPage>
	);
};

export default Confirm;
