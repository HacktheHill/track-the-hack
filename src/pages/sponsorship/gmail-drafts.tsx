import { Role } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps, NextPage } from "next/types";
import { createRef, useEffect, useState } from "react";

import App from "../../components/App";
import Error from "../../components/Error";
import OnlyRole from "../../components/OnlyRole";

import { trpc } from "../../utils/api";
import { sponsorshipGmailDraftsSchema } from "../../utils/common";

const html = String.raw;

const signature = html`
	<br />
	<b>[organizerFullName]</b><br />
	<i>Sponsorship Team</i>
	<div>Hack the Hill</div>
	<a href="https://hackthehill.com/" target="_blank" rel="noopener noreferrer">Website</a>
	&nbsp;|&nbsp;
	<a href="https://socials.hackthehill.com/instagram" target="_blank" rel="noopener noreferrer">Instagram</a>
	&nbsp;|&nbsp;
	<a href="https://socials.hackthehill.com/twitter" target="_blank" rel="noopener noreferrer">Twitter</a>
	&nbsp;|&nbsp;
	<a href="https://socials.hackthehill.com/linkedin" target="_blank" rel="noopener noreferrer">LinkedIn</a>
	<br />
	<img
		src="https://media.discordapp.net/attachments/1029229927335206933/1145925786503741532/HtH_Banner_Logo.png"
		width="200"
		height="29"
	/>
`;

const templates = [
	{
		id: "date-availabilities",
		name: "Intro with Date Availabilities",
		subject: "Unleash Innovation: Join Hack the Hill 2024 as a Sponsor!",
		body: html`<p>Hello [companyRepName],</p>
			<p>
				I hope this email finds you well. My name is [organizerFullName], and as a Sponsorship Coordinator for
				Hack the Hill 2024, I am thrilled to introduce you to Ottawa's most exciting and innovative hackathon
				event! With our mission to provide opportunities for students through an annual hackathon, we are
				reaching out to companies like yours to join us in making this event possible.
			</p>
			<p>
				Hack the Hill is an event that will run in the Fall of 2024, along with a series of monthly
				events throughout the year. We are shaping the future of technology through the joint effort of notable
				student organizations from both the University of Ottawa and Carleton University.
			</p>
			<p>
				With the help of [companyName], Hack the Hill can push further to provide students with an amazing and
				productive event. We are confident that our partnership will yield mutually beneficial results - from
				prominent branding opportunities to direct engagement with participants - we have carefully curated a
				sponsorship package that will cater to your specific interests:
			</p>
			<p>
				<a
					href="https://drive.google.com/file/d/1wD9-VEt7WQ98w8MeBwEsF1y7i6JAqQf6/view"
					role="button"
					target="_blank"
					style="display:inline-flex;align-items:center;height:1rem;"
				>
					<img
						src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png"
						style="height: 100%;"
					/>
					<strong>Hack the Hill 2024 Sponsorship Package</strong>
				</a>
			</p>
			<p>
				Feel free to reach out for any further information or to discuss with the team. My current
				availabilities are:
			</p>
			<p>Day, Month at time</p>
			<p>I look forward to hearing back soon, thank you for your time and consideration!</p>`,
	},
	{
		id: "default-intro",
		name: "Default Intro",
		subject: "Unleash Innovation: Join Hack the Hill 2024 as a Sponsor!",
		body: html`<p>Dear [companyRepName],</p>
			<p>
				I hope this email finds you well. My name is [organizerFullName], and as a Sponsorship Coordinator for
				Hack the Hill 2024, I am thrilled to introduce you to Ottawa's most exciting and innovative hackathon
				event! With our mission to provide opportunities for students through an annual hackathon, we are
				reaching out to companies like yours to join us in making this event possible.
			</p>
			<p>
				Hack the Hill is an event that will gather up to
				<strong>1000 passionate North American students</strong> who are ready to push the boundaries of
				software and hardware solutions. We are shaping the future of technology through the joint effort of
				notable student organizations from both <strong>the University of Ottawa</strong> and
				<strong>Carleton University</strong>. In the <strong>Fall of 2024</strong>, we will transform
				the campus into a hub for new ideas and flourishing projects. This is where ideas come to life, where
				technology thrives, and where your company's brand can truly shine.
			</p>
			<p>
				By becoming a sponsor of Hack the Hill, you will be supporting the growth and development of talented
				students and also gain access to an exceptional pool of future tech leaders. From prominent branding
				opportunities to direct engagement with participants, we have carefully curated a sponsorship package
				that will cater to your specific interests.
			</p>
			<p>
				<a
					href="https://drive.google.com/file/d/1wD9-VEt7WQ98w8MeBwEsF1y7i6JAqQf6/view"
					role="button"
					target="_blank"
					style="display:inline-flex;align-items:center;height:1rem;"
				>
					<img
						src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png"
						style="height: 100%;"
					/>
					<strong>Hack the Hill 2024 Sponsorship Package</strong>
				</a>
			</p>
			<p>
				In addition to the hackathon we have also planned <strong>a series of monthly events</strong> throughout
				the year, dedicated to expanding students' technical skills, and fostering a vibrant community.
			</p>
			<p>
				With the help of [companyName], Hack the Hill can provide students with an amazing and productive event.
				We are confident that our partnership will yield mutually beneficial results and contribute to the
				advancement of the STEM community.
			</p>
			<p>
				<strong>I have attached the sponsorship package link for the hackathon to the email.</strong> If you
				have any questions, I am more than willing to provide further information.
			</p>
			<p>Thank you for your time and consideration!</p> `,
	},
	{
		id: "default-intro_prev_sponsor",
		name: "Intro - Previous Sponsor",
		subject: "Unleash Innovation: Join Hack the Hill 2024 as a Sponsor!",
		body: html`<p>Hello [companyRepName],</p>
			<p>
				My name is [organizerFullName] and I am a Sponsorship Coordinator with Hack the Hill! Hopefully you may
				remember me from the hackathon event earlier this year! We greatly appreciated your support last time
				and are hoping for your continued support into the next year for our Hack the Hill 2024 event!
			</p>
			<p>
				Now that we are bigger and better we have since updated our package to fit our new expectations of
				Ottawas greatest annual hackathon.
			</p>
			<p>
				Here is our new 2024 package:
				<a
					href="https://drive.google.com/file/d/1wD9-VEt7WQ98w8MeBwEsF1y7i6JAqQf6/view"
					role="button"
					target="_blank"
					style="display:inline-flex;align-items:center;height:1rem;"
				>
					<img
						src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png"
						style="height: 100%;"
					/>
					<strong>Hack the Hill 2024 Sponsorship Package</strong>
				</a>
			</p>
			<p>
				Feel free to take a look and let me know of your decision or if you have any further questions. As
				always, I am happy to help as much as I can to see this potential partnership through.
			</p>
			<p>Thank you for your time and consideration.</p>`,
	},
	{
		id: "standard-follow-up",
		name: "Follow Up",
		subject: "Unleash Innovation: Join Hack the Hill 2024 as a Sponsor!",
		body: html`<p>
		Hi [companyRepName],
	</p>
	<p>
		I hope this email finds you well. We are reaching out once again to gauge your interest in sponsoring Hack the Hill
		2024, the Ottawa's most
		exciting hackathon event. As we continue to make progress in the planning process, we wanted to provide you with
		some updates from the
		previous week. We also kindly request that you confirm your interest and availability before our sponsorship list is
		finalized on [date].
	</p>
	<p>
		Here are the latest updates:

	<ol>
		<li><strong>Growing Momentum</strong>: Hack the Hill is generating significant buzz among STEM students and industry
			professionals alike. Our outreach
			efforts have resulted in an influx of registrations, and by sponsoring our event, your company will have a
			unique opportunity to make a
			lasting impact on the brightest minds in the field.</li>
		<li><strong>Exceptional Talent</strong>:We have received applications from a diverse range of highly skilled and
			passionate participants from renowned
			institutions across North America. Their enthusiasm to innovate, collaborate, and push the boundaries of
			technology is truly inspiring.
			Your sponsorship will not only support their growth but also provide your company access to this exceptional
			pool of talent.
		</li>
		<li><strong>(OTHER UPDATES)</strong>:(OTHER UPDATES)
		</li>
	</ol>
	</p>
	<p>
		We genuinely appreciate your consideration and would be thrilled to have your company join us as a sponsor. Your
		support will not only
		contribute to the success of Hack the Hill but also help empower the next generation of tech innovators.
	</p>
	<p>
		Please let us know if you are interested in partnering with us or if you require any further information. We are
		here to address any questions
		or concerns you may have.
	</p>

	<p>
		Thank you for your time, and we eagerly await your response.
	</p>
	<p>
		Warm regards,
	</p>`,
	},
	{
		id: "message_template",
		name: "Message Template?",
		subject: "Unleash Innovation: Join Hack the Hill 2024 as a Sponsor!",
		body: html`<p>Hello!</p>
			<p>
				My name is [YOUR NAME], and <strong>I am a / I have a peer</strong> that is part of the Hack the Hill
				hackathon sponsorship team.
			</p>
			<p>
				Hack the Hill is a recurring hackathon being organized in collaboration with the largest student bodies
				at uOttawa and Carleton: the IEEE uOttawa Student Branch, the Computer Science Student Association
				(CSSA), the Engineering Student Society (ESS), the Software Engineering Student Association (SESA), the
				Women in Engineering uOttawa Branch, the uOttawa Computer Science Club, the uOttawa Game Development
				Club, the IEEE Carleton Student Branch, and the Carleton Systems and Computer Engineering Society
				(SCESoc). Our goal is to provide an annual hackathon with a series of monthly networking events
				throughout the year.
			</p>
			<p>
				In the Fall of 2024, <strong>we/they</strong> will be hosting about 1,000 participants from across North America
				who will receive the opportunity to innovate software and hardware solutions. Events like these could 
				not happen without the support of our sponsors.<strong>we/they</strong>
				encourage you to take a look at the sponsorship package, which I have attached.
				<strong>we/they</strong> are more than happy to answer any questions you may have!
			</p>
			<p>Thank you for your time and consideration!</p> `,
	},
	{
		id: "next-steps",
		name: "Next Steps",
		subject: "Unleash Innovation: Join Hack the Hill 2024 as a Sponsor!",
		body: html`<p>Hi [companyRepName],</p>
			<p>
				My name is [organizerFullName], and I am a part of the sponsorship team at Hack the Hill 2024. I am
				contacting you today to give you further information about our hackathon
			</p>
			<p>
				I have attached a tentative schedule to this email, which contains information about the times and
				locations of our different events. Given that our schedule is still very flexible, when would you like
				to plan a scheduled workshop during these days? Would you like anything prepared in advance for the
				opening or closing ceremonies?
			</p>
			<p>
				Here is a Google Drive containing the
				<a
					href="https://drive.google.com/"
					role="button"
					target="_blank"
					style="display:inline-flex;align-items:center;height:1rem;"
				>
					<img
						src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png"
						style="height: 100%;"
					/>
					<strong>resumes of attending hackers</strong></a
				>, and here is another drive containing
				<a
					href="https://drive.google.com/"
					role="button"
					target="_blank"
					style="display:inline-flex;align-items:center;height:1rem;"
				>
					<img
						src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png"
						style="height: 100%;"
					/>
					<strong>our organizer team’s resumes</strong></a
				>
				for Hack the Hill 2024.
			</p>
			<p>
				Thank you so much for your continued support of Hack the Hill. We want to make this experience as
				memorable as possible for both of us. If you have any questions or concerns, please let us know.
			</p>
			<p>Sincerely,</p>`,
	},
	{
		id: "nextsteps-2",
		name: "Upcoming events and next steps",
		subject: "Unleash Innovation: Join Hack the Hill 2024 as a Sponsor!",
		body: html`<p>Hi [companyRepName],</p>
			<p>
				I hope this email finds you well. On behalf of the sponsorship team, I want to express our sincere
				gratitude for your continued support.
			</p>
			<p>
				As we move forward with the event planning, I would like to provide you with
				<strong>details about Hack the Hill 2024</strong> and discuss how we can make this experience truly
				exceptional for your company.
			</p>
			<p>
				Firstly, I have <strong>attached a tentative schedule</strong> to this email, which
				<strong>outlines the times and locations of our various events throughout the hackathon</strong>. This
				will give you an overview of the flow and structure of the event. Please take a moment to review it and
				let us know if you have any specific preferences regarding scheduling.
			</p>
			<p>
				Additionally, we would like to offer you the
				<strong>opportunity to conduct a scheduled workshop during the hackathon</strong>. This will allow you
				to share your expertise, engage with participants, and leave a lasting impact. We can work together to
				determine the best timing and topic for the workshop to align with your goals and interests.
			</p>
			<p>
				Furthermore, let us know how you would like to contribute to the opening and closing ceremonies. It can
				be a speech or a presentation about your esteemed company from your employees. We want the participants
				to establish a lasting connection with your brand and let them know of your presence in the field.
			</p>
			<p>
				<strong>
					To support your recruitment efforts, I have also provided two Google Drive links below.
				</strong>
				The first link contains resumes of all attending hackers, giving you access to a diverse pool of
				talented individuals. The second link contains the resumes of our organizer team for Hack the Hill 2024,
				providing you with insight into the skills and qualifications of the dedicated individuals behind the
				event.
				<br />
				<a href="" role="button" target="_blank" style="display:inline-flex;align-items:center;height:1rem;">
					<img
						src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png"
						style="height: 100%;"
					/>
					<strong>Resumes of attending hackers</strong>
				</a>
				<br />
				<a href="" role="button" target="_blank" style="display:inline-flex;align-items:center;height:1rem;">
					<img
						src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png"
						style="height: 100%;"
					/>
					<strong>Resumes of Hack the Hill 2024 organizer team</strong>
				</a>
			</p>
			<p>
				We genuinely appreciate your commitment to Hack the Hill and want to ensure that this experience is as
				memorable and rewarding as possible for both parties. If you have any questions, concerns, or specific
				requirements, please do not hesitate to reach out to us. We are here to assist you every step of the
				way.
			</p>
			<p>
				Once again, thank you for your continued support. We are eagerly looking forward to collaborating with
				you and making Hack the Hill an extraordinary event.
			</p>
			<p>Sincerely,</p>`,
	},
	{
		id: "noneecs",
		name: "Non EECS",
		subject: "Unleash Innovation: Join Hack the Hill 2024 as a Sponsor!",
		body: html`<p>Hello [companyRepName],</p>
			<p>My name is [organizerFullName], and I am a part of the Hack the Hill 2024 hackathon sponsorship team.</p>
			<p>
				Hack the Hill is a recurring hackathon being organized in collaboration with the largest student bodies
				at uOttawa and Carleton University. Our goal is to provide an annual hackathon with a series of monthly
				networking events throughout the year.
			</p>
			<p>
				One of the most anticipated events that will occur at the hackathon is our Career Fair. Our attendees at
				the career fair will be of all engineering backgrounds - not just Computer Science students - and would
				benefit from the presence of a company such as yours. Career fairs at a hackathon are an excellent way
				to recruit students and network with future graduates. To be a part of the career fair, Hack the Hill
				requires an entry fee of $500. We encourage you to consider partnering with us. We are more than happy
				to answer any questions you may have!
			</p>
			<p>Thank you for your time and consideration!</p>`,
	},
	{
		id: "postEvent",
		name: "Post Event",
		subject: "Unleash Innovation: Join Hack the Hill 2024 as a Sponsor!",
		body: html`<p>Hi [companyRepName],</p>
			<p>
				This is [organizerFullName] of the Hack the Hill 2024 sponsorship team. On behalf of Hack the Hill, we
				would like to extend our deepest gratitude to [companyName]for supporting this year's event. Your
				contribution played a vital role in making Hack the Hill a resounding success.
			</p>
			<p>
				We hope that [companyName] had the opportunity to connect with talented hackers, showcase your company's
				offerings, and foster relationships with our community. We truly value our partnership and look forward
				to the possibility of working together again in the future.
			</p>
			<p>
				Again, thank you for the commitment. If you have any questions please do not hesitate to reach out to
				us. We look forward to collaborate with you again in the future.
			</p>
			<p>Sincerely,</p>`,
	},
	{
		id: "rejection",
		name: "Rejection",
		subject: "Unleash Innovation: Join Hack the Hill 2024 as a Sponsor!",
		body: html`<p>Hi [companyRepName],</p>
			<p>
				This is [organizerFullName] of the Hack the Hill 2024 sponsorship team. Thank you for your consideration
				of our sponsorship proposal. We understand that our offering may not align with the current priorities
				at [companyName]. However, if you have any insights on areas we can improve or any alternative ways we
				can work together in the future, we would be grateful to hear from you.
			</p>
			<p>
				If you have any questions or would like to discuss future opportunities, please do not hesitate to reach
				out to us. We hope to collaborate with your company at some point in the future.
			</p>
			<p>Sincerely,</p>`,
	},
];

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "sponsorship-gmail-drafts"]),
	};
};

const SponsorshipGmailDrafts: NextPage = () => {
	const { t } = useTranslation("sponsorship-gmail-drafts");
	const { data: sessionData } = useSession();

	const mutation = trpc.sponsorshipGmailDrafts.createGmailDraft.useMutation();

	const [error, setError] = useState("");
	const [copied, setCopied] = useState(false);
	const [drafted, setDrafted] = useState(false);

	// Selected email template stuff
	const [templateID, setTemplateID] = useState(templates[0]?.id);
	const [htmlPreview, setHtmlPreview] = useState(templates[0]?.body ?? "");
	const [organizerFullName, setOrganizerFullName] = useState(sessionData?.user?.name ?? "");
	const [companyName, setCompanyName] = useState("");
	const [companyRepName, setCompanyRepName] = useState("");
	const [companyEmail, setCompanyEmail] = useState("");
	const [subject, setSubject] = useState(templates[0]?.subject);
	const [customizeTemplate, setCustomizeTemplate] = useState(false);
	const [customTemplate, setCustomTemplate] = useState("");

	const emailPreview = createRef<HTMLDivElement>();

	const copyToClipBoard = async () => {
		if (emailPreview.current) {
			await navigator.clipboard.writeText(emailPreview.current.innerHTML);
			setCopied(true);
			setTimeout(() => setCopied(false), 1000);
		}
	};

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);

		const data = Object.fromEntries(formData) as Record<string, string | number | undefined>;
		data.emailHTML = htmlPreview;
		console.log(data);

		// Remove empty values
		Object.keys(data).forEach(key => {
			if (data[key] == null || data[key] === "") {
				delete data[key];
			}
		});

		const parse = sponsorshipGmailDraftsSchema.safeParse(data);
		if (!parse.success) {
			setError(t("invalid-form"));
			console.error(parse.error);
		} else {
			mutation.mutate(parse.data);
			if (!mutation.error) {
				setError("");
				setDrafted(true);
				setTimeout(() => {
					setDrafted(false);
					document.querySelector("main")?.scrollTo({
						top: 0,
						behavior: "smooth",
					});

					// Empty all fields
					setOrganizerFullName("");
					setCompanyName("");
					setCompanyRepName("");
					setCompanyEmail("");
					setSubject("");
					setTemplateID(templates[0]?.id);
					setCustomizeTemplate(false);
					setCustomTemplate("");
				}, 1000);
			} else {
				setError(mutation.error.message);
			}
		}
	};

	useEffect(() => {
		setHtmlPreview(
			customizeTemplate
				? customTemplate
				: `${templates.find(t => t.id === templateID)?.body ?? ""}${signature}`
						.replace(/\[organizerFullName]/g, organizerFullName)
						.replace(/\[companyName]/g, companyName)
						.replace(/\[companyRepName]/g, companyRepName),
		);
		setSubject(templates.find(t => t.id === templateID)?.subject);
	}, [templateID, organizerFullName, companyName, companyRepName, customTemplate, customizeTemplate]);

	return (
		<App className="bg-default-gradient overflow-y-auto p-8 sm:p-12" title={t("title")}>
			<OnlyRole filter={role => role === Role.ORGANIZER}>
				<form onSubmit={handleSubmit} className="m-auto flex w-fit flex-col items-center gap-4">
					<h3 className="text-dark-color font-rubik text-4xl font-bold">{t("title")}</h3>
					<div className="flex w-full flex-col items-center gap-2 sm:flex-row">
						<label htmlFor="organizer-full-name" className="text-dark-color flex-[50%] font-rubik">
							{t("organizer-full-name")}
							<span className="text-red-500"> *</span>
						</label>
						<input
							id="organizer-full-name"
							name="organizerFullName"
							type="text"
							className="text-dark-color w-full rounded-[100px] border-none bg-light-primary-color px-4 py-2 font-rubik shadow-md transition-all duration-500 hover:bg-light-primary-color/50"
							onChange={event => setOrganizerFullName(event.target.value)}
							value={organizerFullName}
							required
						/>
					</div>
					<div className="flex w-full flex-col items-center gap-2 sm:flex-row">
						<label htmlFor="template" className="text-dark-color flex-[50%] font-rubik">
							{t("select-template")}
							<span className="text-red-500"> *</span>
						</label>
						<select
							id="template"
							name="template"
							className="text-dark-color w-full rounded-[100px] border-none bg-light-primary-color px-4 py-2 font-rubik shadow-md transition-all duration-500 hover:bg-light-primary-color/50"
							onChange={event => {
								setTemplateID(event.target.value);
								setCustomizeTemplate(event.target.value === "custom");
								setCustomTemplate(htmlPreview);
							}}
							value={templateID}
							required
						>
							{[
								...templates,
								{
									id: "custom",
									name: "Custom",
								},
							].map(temp => (
								<option key={temp.id} value={temp.id}>
									{temp.name}
								</option>
							))}
						</select>
					</div>
					{!customizeTemplate && (
						<>
							<div className="flex w-full flex-col items-center gap-2 sm:flex-row">
								<label htmlFor="company-name" className="text-dark-color flex-[50%] font-rubik">
									{t("company-name")}
									<span className="text-red-500"> *</span>
								</label>
								<input
									id="company-name"
									name="companyName"
									type="text"
									className="text-dark-color w-full rounded-[100px] border-none bg-light-primary-color px-4 py-2 font-rubik shadow-md transition-all duration-500 hover:bg-light-primary-color/50"
									onChange={event => setCompanyName(event.target.value)}
									value={companyName}
									required
								/>
							</div>
							<div className="flex w-full flex-col items-center gap-2 sm:flex-row">
								<label htmlFor="company-rep-name" className="text-dark-color flex-[50%] font-rubik">
									{t("company-rep-name")}
									<span className="text-red-500"> *</span>
								</label>
								<input
									id="company-rep-name"
									name="companyRepName"
									type="text"
									className="text-dark-color w-full rounded-[100px] border-none bg-light-primary-color px-4 py-2 font-rubik shadow-md transition-all duration-500 hover:bg-light-primary-color/50"
									onChange={event => setCompanyRepName(event.target.value)}
									value={companyRepName}
									required
								/>
							</div>
						</>
					)}
					<div className="flex w-full flex-col items-center gap-2 sm:flex-row">
						<label htmlFor="company-name" className="text-dark-color flex-[50%] font-rubik">
							{t("company-email")}
							<span className="text-red-500"> *</span>
						</label>
						<input
							id="company-email"
							name="companyEmail"
							type="email"
							className="text-dark-color w-full rounded-[100px] border-none bg-light-primary-color px-4 py-2 font-rubik shadow-md transition-all duration-500 hover:bg-light-primary-color/50"
							onChange={event => setCompanyEmail(event.target.value)}
							value={companyEmail}
							required
						/>
					</div>
					<div className="flex w-full flex-col items-center gap-2 sm:flex-row">
						<label htmlFor="subject" className="text-dark-color flex-[50%] font-rubik">
							{t("subject")}
							<span className="text-red-500"> *</span>
						</label>
						<input
							id="subject"
							name="subject"
							className="text-dark-color w-full rounded-[100px] border-none bg-light-primary-color px-4 py-2 font-rubik shadow-md transition-all duration-500 hover:bg-light-primary-color/50"
							onChange={event => setSubject(event.target.value)}
							value={subject}
							required
						/>
					</div>
					{customizeTemplate && (
						<>
							<div className="flex w-full flex-col items-center gap-2 sm:flex-row">
								<div className="flex flex-col gap-1">
									<label htmlFor="custom-template" className="text-dark-color flex-[50%] font-rubik">
										{t("custom-template")}
									</label>
									<small className="w-36 text-xs">{t("custom-template-note")}</small>
								</div>
								<textarea
									id="custom-template"
									name="customTemplate"
									className="text-dark-color h-[200px] w-full rounded-md border-none bg-light-primary-color px-4 py-2 font-rubik shadow-md transition-all duration-500 hover:bg-light-primary-color/50"
									onChange={event => setCustomTemplate(event.target.value)}
									value={customTemplate}
								/>
							</div>
						</>
					)}
					{error && (
						<div className="flex flex-col items-center gap-2">
							<p className="text-center font-rubik text-red-500">{error}</p>
						</div>
					)}
					<div className="relative h-[500px] w-full rounded-md bg-white shadow-md" ref={emailPreview}>
						<button
							type="button"
							className="bg-ligh-color hover:bg-medium absolute bottom-4 right-4 rounded-[100px] border-none px-4 py-2 font-rubik text-white shadow-md transition-all duration-1000 disabled:hover:bg-light-color"
							onClick={() => void copyToClipBoard()}
							disabled={copied}
						>
							{copied ? t("copied-to-clipboard") : t("copy-to-clipboard")}
						</button>
						<iframe srcDoc={htmlPreview} className="h-full w-full" />
					</div>
					<button
						type="submit"
						className="hover:bg-medium cursor-pointer whitespace-nowrap rounded-[100px] border-none bg-light-color px-8 py-2 font-rubik text-white shadow-md transition-all duration-1000 disabled:hover:bg-light-color"
						disabled={drafted}
					>
						{drafted ? t("created-draft-email") : t("create-draft-email")}
					</button>
				</form>
			</OnlyRole>
			{!sessionData?.user && (
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={t("not-authorized-to-view-this-page")} />
				</div>
			)}
		</App>
	);
};

export default SponsorshipGmailDrafts;
