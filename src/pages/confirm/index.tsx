import type { GetStaticProps, NextPage } from "next";
import { Trans, useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import SignaturePad from "react-signature-canvas";
import { uploadSignature } from "../../client/s3";
import FormPage from "../../components/FormPage";
import { trpc } from "../../server/api/api";
import { debounce } from "../../utils/helpers";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "confirm"]),
	};
};

const Confirm: NextPage = () => {
	const { t } = useTranslation("confirm");
	const router = useRouter();
	const [id] = [router.query.id].flat();

	const [teamName, setTeamName] = useState("");
	const [team, setTeam] = useState<{ name: string; members: string[] } | null>(null);
	const [teamCreated, setTeamCreated] = useState(false);
	const [validationMessage, setValidationMessage] = useState("");
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [error, setError] = useState("");
	const [isMinor, setIsMinor] = useState(false);
	const [signature, setSignature] = useState<string | null>(null);
	const [checkboxes, setCheckboxes] = useState({
		termsPrivacy: false,
		codeOfConduct: false,
		waivers: false,
		travelPolicy: false,
	});

	const mutation = trpc.hackers.confirm.useMutation();
	const query = trpc.hackers.get.useQuery({ id: id ?? "" }, { enabled: !!id });
	const checkTeam = trpc.teams.check.useQuery({ name: teamName }, { enabled: false });
	const createTeam = trpc.teams.create.useMutation();

	const sigCanvas = useRef<SignaturePad | null>(null);

	const deadline = query.data?.acceptanceExpiry?.toLocaleDateString(router.locale, {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		hour12: true,
	});

	// Debounced check for team
	const debounceCheckTeam = debounce(async (name: string) => {
		if (name) {
			const response = await checkTeam.refetch();
			if (response.data?.exists) {
				setTeam(response.data.team);
			} else {
				setTeam(null);
			}
		}
	}, 300);

	useEffect(() => {
		if (query.error) setError(query.error.message);
		if (mutation.error) setError(mutation.error.message);
		if (query.data) {
			setIsSubmitted(query.data.confirmed);
			setIsMinor(query.data.age < 18);
		}
	}, [query.data, query.error, mutation.error]);

	const handleTeamNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const name = e.target.value;
		setTeamName(name);
		setTeamCreated(false);
		debounceCheckTeam(name);
	};

	const handleCreateTeam = () => {
		if (!query.data) return;

		if (teamName) {
			createTeam.mutate(
				{ teamName: teamName, hackerId: query.data.id },
				{
					onSuccess: () => {
						setValidationMessage("");
						setTeamCreated(true);
					},
					onError: error => {
						setValidationMessage(error.message);
					},
				},
			);
		}
	};

	const handleClearSignature = () => {
		sigCanvas.current?.clear();
		setSignature(null);
	};

	const handleCheckboxChange = (checkbox: keyof typeof checkboxes) => {
		setCheckboxes(prevState => ({
			...prevState,
			[checkbox]: !prevState[checkbox],
		}));
	};

	const handleSignatureEnd = () => {
		const canvas = sigCanvas.current?.getTrimmedCanvas();
		setSignature(canvas?.toDataURL("image/png") ?? null);
		console.log(canvas?.toDataURL("image/png"));
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!id) {
			setValidationMessage(t("invalid-confirmation-link"));
			return;
		}

		// Validate that all required checkboxes are checked
		const allChecked = Object.values(checkboxes).every(Boolean);
		if (!allChecked) {
			setValidationMessage(t("you-must-accept-terms"));
			return;
		}

		if (!signature) {
			setValidationMessage(t("you-must-sign"));
			return;
		}

		let result;
		try {
			result = await mutation.mutateAsync({
				id,
				teamName,
			});

			// If the form submission was successful and we have a signature, upload it to S3
			if (result.presignedUrl && signature) {
				const signatureName = `signature-${result.id}.png`;
				const uploadResult = await uploadSignature(result.presignedUrl, signature, signatureName);

				if (!uploadResult) {
					throw new Error(t("signature-upload-failed"));
				}
			}

			setIsSubmitted(true);
			setValidationMessage("");
		} catch (err) {
			// If there's an error, handle it and potentially undo the confirmation
			if (result?.id) {
				await mutation.mutateAsync({
					id: result.id,
					confirm: false,
				});
			}
			setError((err as Error).message ?? t("unknown-error"));
			console.error(err);
		}
	};

	const handleEdit = () => {
		if (!id) return;
		mutation.mutate({
			id,
			confirm: false,
		});
		setIsSubmitted(false);
	};

	const checkboxDetails = [
		{
			id: "termsPrivacy",
			label: t("terms-privacy"),
			links: [
				"https://docs.google.com/document/d/149kUCf4PXmd2GvIgGNt8MXiMz6BJfDiIEMdNzUti_Kc/view",
				"https://docs.google.com/document/d/1hhsl6WrrZtDz_mbeW7wDBS70Ozrbe6-aL06vqIh2550/view",
			],
		},
		{
			id: "codeOfConduct",
			label: t("code-of-conduct"),
			links: ["https://docs.google.com/document/d/1thE_Ia595Cz9YaD8gTbyZ3gnZiBSgkLgl0wwGSANczc/view"],
		},
		{
			id: "waivers",
			label: t("waivers"),
			links: [
				"https://docs.google.com/document/d/1aacZOxbDqiBnmIOq31NpHUggXXMvUqoVFR_d7IAuujE/view",
				"https://docs.google.com/document/d/1y7zP5kBHRrNMOxx_0JAz8NcLBHWFWe8OtsbOOosBs60/view",
			],
		},
		{
			id: "travelPolicy",
			label: t("travel-policy"),
			links: ["https://docs.google.com/document/d/1MejSNJ-8YAfW_ENU6bRZVji4k_gsXD1pDRkhX1Bkx5A/view"],
		},
	];

	return (
		<FormPage
			onSubmit={event => void handleSubmit(event)}
			error={error}
			invalid={!id || query.data === null ? t("invalid-confirmation-link") : null}
			loading={id != null && query.isLoading && !query.isError}
			title={t("confirm")}
		>
			{query.data &&
				(isSubmitted ? (
					<div className="flex flex-col items-center justify-center gap-6">
						<h3 className="font-rubik font-medium text-dark-color">
							{t("thank-you-for-confirming-your-attendance")}
						</h3>
						<p className="font-medium text-dark-color">{t("we-look-forward-to-seeing-you")}</p>
						{query.data?.acceptanceExpiry && (
							<p className="text-sm">{t("you-can-change-your-response", { deadline })}</p>
						)}
						<button
							type="button"
							onClick={handleEdit}
							className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
						>
							{t("undo-edit-response")}
						</button>
					</div>
				) : (
					<div className="flex max-w-[25rem] flex-col items-center gap-6">
						<div className="flex flex-col gap-2">
							<h3 className="font-rubik font-medium text-dark-color">
								{t("congratulations-for-acceptance", {
									name: query.data?.firstName,
								})}
							</h3>
							<p>{t("excited-to-have-you-join-us")}</p>
							<p>{t("description")}</p>
							<p>{t("please-confirm-your-attendance")}</p>
						</div>
						<div className="flex flex-col gap-8">
							<div className="flex flex-col gap-2">
								<label htmlFor="team-name">{t("which-team")}</label>
								<input
									type="text"
									id="team-name"
									name="team-name"
									value={teamName}
									onChange={handleTeamNameChange}
									className="w-full rounded border-none bg-light-primary-color/75 px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-light-primary-color/50"
								/>
								{team ? (
									<p className="text-sm">
										{t("team-already-exists", { members: team.members.join(", ") })}
									</p>
								) : teamCreated ? (
									<p className="text-sm">{t("team-created-successfully")}</p>
								) : (
									<button
										type="button"
										disabled={teamName.length < 3}
										onClick={handleCreateTeam}
										className="rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-light-quaternary-color short:text-base"
									>
										{t("create-team")}
									</button>
								)}
							</div>

							<div className="flex flex-col gap-2">
								{checkboxDetails.map((item, index) => (
									<div key={index} className="flex flex-row items-center justify-center gap-2">
										<input
											type="checkbox"
											id={item.id}
											name={item.id}
											checked={checkboxes[item.id as keyof typeof checkboxes]}
											onChange={() => handleCheckboxChange(item.id as keyof typeof checkboxes)}
											className="h-4 w-4 appearance-none bg-transparent text-black after:block after:h-full after:w-full after:rounded-lg after:border after:border-dark-primary-color after:p-0.5 after:leading-[calc(100%*1/2)] after:checked:content-check"
										/>
										<label htmlFor={item.id} className="flex-1">
											<Trans
												i18nKey={item.label}
												t={t}
												components={item.links.map((link, index) => (
													<a
														key={index}
														href={link}
														target="_blank"
														rel="noopener noreferrer"
														className="text-dark-primary-color underline"
													/>
												))}
											/>
										</label>
									</div>
								))}
								<div className="flex flex-col gap-2">
									<label htmlFor="signature">
										{t(isMinor ? "parent-guardian-consent" : "attendee-consent", {
											name: `${query.data?.firstName} ${query.data?.lastName}`,
										})}
									</label>
									<div className="relative">
										<SignaturePad
											ref={sigCanvas}
											canvasProps={{
												className: "border border-dark-primary-color rounded-lg w-full h-24",
											}}
											onEnd={handleSignatureEnd}
										/>
										<button
											type="button"
											onClick={handleClearSignature}
											className="absolute bottom-2 right-2 rounded-lg border border-dark-primary-color bg-light-quaternary-color px-2 py-1 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
										>
											{t("clear")}
										</button>
									</div>
									{validationMessage && (
										<p className="text-center text-red-500">{validationMessage}</p>
									)}
								</div>
							</div>

							<button
								type="submit"
								className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
							>
								{t("ill-be-there")}
							</button>
							{query.data?.acceptanceExpiry && (
								<p className="text-center text-sm">{t("you-can-change-your-response", { deadline })}</p>
							)}
						</div>
					</div>
				))}
		</FormPage>
	);
};

export default Confirm;
