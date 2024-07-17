import { AttendanceType, ShirtSize } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { signIn, signOut, useSession } from "next-auth/react";
import { Trans, useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import FormPage from "../../components/FormPage";
import { trpc } from "../../server/api/api";

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
					<p className="font-rubik text-[clamp(1rem,1vmin,5rem)] font-medium text-dark-color">
						{
							"Please check out your special QR code for the event. You will use it to check in at the event."
						}
					</p>
					<button
						className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
						onClick={() => {
							void router.push(`/qr`);
						}}
					>
						{t("view-qr-code")}
					</button>
				</div>
			) : (
				<div className="flex max-w-[25rem] flex-col items-center gap-6">
					<h3 className="font-rubik text-[clamp(1rem,1vmin,5rem)] font-medium text-dark-color">
						{t("congratulations-for-your-acceptance", {
							name: query.data?.firstName ?? "Hacker",
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
									className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
									onClick={() => void signOut()}
								>
									{t("sign-out")}
								</button>
							</>
						) : (
							<button
								type="button"
								className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
								onClick={() => void signIn()}
							>
								{t("sign-in")}
							</button>
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
								className="h-4 w-4 appearance-none bg-transparent text-black after:block after:h-full after:w-full after:rounded-lg after:border after:border-dark-primary-color after:p-0.5 after:leading-[calc(100%*1/2)] after:checked:content-check"
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
											>
												{t("accept-terms")}
											</a>
										),
									}}
								/>
							</label>
						</div>
						{validationMessage && <p className="text-center text-red-500">{validationMessage}</p>}
						<button
							type="submit"
							className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
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
