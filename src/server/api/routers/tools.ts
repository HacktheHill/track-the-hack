import { Role } from "@prisma/client";
import { sponsorshipGmailDraftsSchema } from "../../../utils/common";
import { hasRoles } from "../../../utils/helpers";
import { createDraft } from "../../lib/gmail";
import { createTRPCRouter, protectedProcedure } from "../trpc";

/**
 * HTML template tag
 * @param strings Template strings
 * @param values Template values
 * @returns {string} HTML string
 */
const html = (strings: TemplateStringsArray, ...values: string[]): string =>
	strings.reduce((prev, curr, i) => prev + curr + (values[i] ?? ""), "");

/**
 * Get the email template
 *
 * @param companyName Company name
 * @param companyRepName Company representative's name
 * @param name Organizer's name
 * @returns {string} Email template
 */
const getTemplate = (companyName: string, companyRepName: string, name: string): string => html`
	<p>Dear ${companyRepName},</p>
	<p>
		I hope this email finds you well. My name is ${name}, and as a Sponsorship Coordinator for Hack the Hill 2024, I
		am thrilled to introduce you to Ottawa's most exciting and innovative hackathon event! With our mission to
		provide opportunities for students through an annual hackathon, we are reaching out to companies like yours to
		join us in making this event possible.
	</p>
	<p>
		Hack the Hill is an event that will gather up to <strong>1000 passionate North American students</strong> who
		are ready to push the boundaries of software and hardware solutions. We are shaping the future of technology
		through the joint effort of notable student organizations from both
		<strong>the University of Ottawa and Carleton University</strong>. From
		<strong>February 2nd to 4th 2024</strong>, we will transform the campus into a hub for new ideas and flourishing
		projects. This is where ideas come to life, where technology thrives, and where your company's brand can truly
		shine.
	</p>
	<p>
		By becoming a sponsor of Hack the Hill, you will be supporting the growth and development of talented students
		and also gain access to an exceptional pool of future tech leaders. From prominent branding opportunities to
		direct engagement with participants, we have carefully curated a sponsorship package that will cater to your
		specific interests.
	</p>
	<p>
		<a
			href="https://drive.google.com/file/d/1wD9-VEt7WQ98w8MeBwEsF1y7i6JAqQf6/view"
			role="button"
			target="_blank"
			style="display:inline-flex;align-items:center;height:1rem;"
		>
			<img src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png" style="height: 100%;" />
			<strong>Hack the Hill 2024 Sponsorship Package</strong>
		</a>
	</p>
	<p>
		In addition to the hackathon we have also planned <strong>a series of monthly events</strong> throughout the
		year, dedicated to expanding students' technical skills, and fostering a vibrant community.
	</p>
	<p>
		With the help of ${companyName}, Hack the Hill can provide students with an amazing and productive event. We are
		confident that our partnership will yield mutually beneficial results and contribute to the advancement of the
		STEM community.
	</p>
	<p>
		<strong>I have attached the sponsorship package link for the hackathon to the email.</strong>If you have any
		questions, I am more than willing to provide further information.
	</p>
	<p>Thank you for your time and consideration!</p>
	<div style="color:#888">
		<span>--</span><br />
		<b>${name}</b><br />
		<i>Sponsorship Team</i>
		<div>Hack the Hill</div>
		<a href="https://hackthehill.com/" target="_blank">Website</a>
		&nbsp;|&nbsp;
		<a href="https://socials.hackthehill.com/instagram" target="_blank">Instagram</a>
		&nbsp;|&nbsp;
		<a href="https://socials.hackthehill.com/twitter" target="_blank">Twitter</a>
		&nbsp;|&nbsp;
		<a href="https://socials.hackthehill.com/linkedin" target="_blank">LinkedIn</a>
		<br />
		<img src="https://hackthehill.com/Logos/hackthehill-banner.svg" height="48" />
	</div>
`;

export const toolsRouter = createTRPCRouter({
	sponsorshipGmailDrafts: protectedProcedure.input(sponsorshipGmailDraftsSchema).mutation(async ({ ctx, input }) => {
		const userId = ctx.session.user.id;
		const user = await ctx.prisma.user.findUnique({
			where: {
				id: userId,
			},
		});

		if (!user) {
			throw new Error("User not found");
		}

		if (!hasRoles(user, [Role.ORGANIZER])) {
			throw new Error("You do not have permission to do this");
		}

		const { organizerName, companyName, companyRepName, companyEmail } = input;

		const name = organizerName ?? user.name;

		if (!name) {
			throw new Error("Organizer name is required");
		}

		return createDraft({
			subject: "Unleash Innovation: Join Hack the Hill 2024 as a Sponsor!",
			message: getTemplate(companyName, companyRepName, name),
			labels: ["UNREAD", "2023-24", name],
			sender: "sponsorship@hackthehill.com",
			recipient: companyEmail,
		});
	}),
});
