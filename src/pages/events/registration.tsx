import { signIn, useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps, NextPage } from "next/types";
import { useEffect, useState } from "react";
import { Language } from "@prisma/client";

import App from "../../components/App";
import Error from "../../components/Error";
import OnlyRole from "../../components/OnlyRole";
import QRCode from "../../components/QRCode";
import { useRouter } from "next/router";
import { trpc } from "../../utils/api";
import { personalInfoSchema, walkInSchema } from "../../utils/common";
import z from "zod";
export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "registration", "navbar"]),
	};
};

const Registration: NextPage = () => {
	const { t } = useTranslation("registration");
	const { data: sessionData } = useSession();
	const id = sessionData?.user?.id;
	const router = useRouter();
	const eventId = router.query.eventId as string;
	const signUpHackerMutation = trpc.hackers.signUp.useMutation();
	const questionMutation = trpc.response.createMany.useMutation();
	const mutation = trpc.hackers.create.useMutation();
	const [error, setError] = useState("");
	const hackerIdQuery = trpc.users.getHackerId.useQuery({ id: id ?? "" }, { enabled: !!id });
	const applicationQuestions = trpc.question.all.useQuery({eventId: eventId}, { enabled: !!eventId });
	
	//Hackers with a hacker info should be re-directed to the events page
	// if (hackerIdQuery.data) {
	// 	void router.push("/events");
	// }

	useEffect(() => {
		if(sessionData === null) {	
			void signIn();
		}
	}, [t, sessionData]);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const data = Object.fromEntries(formData) as Record<string, string | number | undefined>;

		if (data.preferredLanguage === "en" || data.preferredLanguage === "fr") {
			data.preferredLanguage = data.preferredLanguage.toUpperCase();
		} else {
			data.preferredLanguage = undefined;
		}

		// if (typeof data.graduationYear === "string") {
		// 	data.graduationYear = parseInt(data.graduationYear);
		// 	if (Number.isNaN(data.graduationYear)) {
		// 		data.graduationYear = undefined;
		// 	}
		// }

		// if (data.shirtSize === "") {
		// 	data.shirtSize = undefined;
		// }

		// if (typeof data.numberOfPreviousHackathons === "string") {
		// 	data.numberOfPreviousHackathons = parseInt(data.numberOfPreviousHackathons);
		// 	if (Number.isNaN(data.numberOfPreviousHackathons)) {
		// 		data.numberOfPreviousHackathons = undefined;
		// 	}
		// }
		
		const applicationParse : Record<string, z.ZodString>= {};
		applicationQuestions.data?.map(question => {
			applicationParse[question.id] = z.string();
		});
		
		const hackerInfoResponses : Record<string, string | number | undefined> = {}
		const applicationResponses : Record<string, string | number | undefined> = {}
		const idsOfApplicationQuestions = applicationQuestions.data?.map(item => item.id);

		Object.entries(data).forEach(([key, value]) => {
			if(idsOfApplicationQuestions?.includes(key)) {
				applicationResponses[key] = value;
			}
			else {
				hackerInfoResponses[key] = value;
			}
		});
		const hackerInfoParse = personalInfoSchema.safeParse(hackerInfoResponses);
		const applicationParseResult = z.object(applicationParse).safeParse(applicationResponses);
		
		
		console.log(hackerInfoParse);

		//check if they are an existing hacker

		if (!hackerInfoParse.success || !applicationParseResult.success) {
				setError(t("invalid-form"));
				console.error(t("error"));
		} else {
			//void router.push("/events?eventId=" + eventId);
			signUpHackerMutation.mutate({ eventId: eventId , hackerId: hackerIdQuery.data, personalInfo: hackerInfoParse.data });
			questionMutation.mutate({questionIdsToResponses: applicationParseResult.data, hackerInfoId: mutation.data?.id ?? ""});
		}
	};

	const fields = [
		// {
		// 	name: "preferredLanguage",
		// 	type: "select",
		// 	options: ["en", "fr"],
		// 	required: false,
		// },
		{
			name: "preferredLanguage",
			type: "select",
			options: ["en", "fr"],
			required: false,
		},
		{
			name: "email",
			type: "text",
			required: false,
		},
		{
			name: "firstName",
			type: "text",
			required: false,
		},
		{
			name: "lastName",
			type: "text",
			required: false,
		},
		{
			name: "gender",
			type: "text",
			required: false,
		},
		{
			name: "phoneNumber",
			type: "text",
			required: false,
		},
		{
			name: "city",
			type: "text",
			required: false,
		}
		
	] as const;

	const patterns = {
		tel: "/^+?d{10,15}$/",
		url: undefined,
		number: "/^d+$/",
		email: undefined,
		text: undefined,
	} as const;
	
	return (
		<App className="overflow-y-auto bg-default-gradient p-8 sm:p-12" title={t("title")}>
				<form onSubmit={handleSubmit} className="flex flex-col items-center gap-8">
					<div>	
					{!hackerIdQuery.data && (<>
					<div className="flex flex-col gap-4">
					<h3 className="font-rubik text-4xl font-bold text-dark-color">{t("title")}</h3>
					<p className="py-8 text-xl">{t("subtitle")}</p>
						{fields.map(field => (
							<div key={field.name} className="flex w-full flex-col items-center gap-2 sm:flex-row">
								<label htmlFor={field.name} className="flex-[50%] font-rubik text-dark-color">
									
									{t(field.name)}
									{field.required && <span className="text-dark-primary-color"> * </span>}
								</label>
								{field.type === "select" ? (
									<select
										id={field.name}
										name={field.name}
										className="w-full rounded-[100px] border-none bg-light-secondary-color px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-medium-secondary-color"
										required={field.required}
									>
										<option value="">{t("select")}</option>
										{field.options?.map(option => (
											<option key={option} value={option}>
												{t(option)}
											</option>
										))}
									</select>
								) : (
									<input
										id={field.name}
										name={field.name}
										type={field.type}
										className="w-full rounded-[100px] border-none  bg-light-secondary-color px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-medium-secondary-color"
										required={field.required}
										pattern={patterns[field.type]}
									/>
								)}
							</div>
						))}
						</div>
						</>)}
						{ (applicationQuestions.data?.length ?? 0) > 0 && (<>
							
						
						<h3 className="font-rubik text-4xl font-bold text-dark-color text-center pt-8">{t("application")}</h3>
						<p className="py-8 text-xl">{t("applicationInstructions")}</p>
						{
							
							applicationQuestions.data?.map(question => (
								<div key={question.id} className="flex w-full flex-col items-center gap-2 sm:flex-row">
									<label htmlFor={question.id} className="flex-[50%] font-rubik text-dark-color">
										{question.question}
										{true && <span className="text-dark-primary-color"> * </span>}
										<b className="bold block">{`(${question.wordMinimum} - ${question.wordMax} words)`}</b>
										
									</label>
									<textarea
										id={question.id}
										name={question.id}
										className="w-full m-4 rounded-[25px] border-none  bg-light-secondary-color px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-medium-secondary-color"
										required={true}
									/>
								</div>
							))
						}
						</>
						)}
					</div>
					{error && (
						<div className="flex flex-col items-center gap-2">
							<p className="text-center font-rubik text-red-500">{error}</p>
						</div>
					)}
					<button className="hover:bg-medium cursor-pointer whitespace-nowrap rounded-[100px] border-none bg-dark-primary-color px-8 py-2 font-rubik text-white shadow-md transition-all duration-1000">
						{t("submit")}
					</button>
				</form>
		</App>
	);
};

export default Registration;
