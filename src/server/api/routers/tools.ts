import { Role } from "@prisma/client";
import { sponsorshipGmailDraftsSchema } from "../../../utils/common";
import { hasRoles } from "../../../utils/helpers";
import { createDraft } from "../../lib/gmail";
import { createTRPCRouter, protectedProcedure } from "../trpc";

/**
 * Get the email template
 *
 * @param companyName Company name
 * @param companyRepName Company representative's name
 * @param name Organizer's name
 * @returns {string} Email template
 */
const getTemplate = (companyName: string, name: string): string => `
    <p>Hello!</p>

    <p>My name is ${name}, and I am a Sponsorship Coordinator at Hack the Hill, the University of Ottawa's newest Hackathon team.</p>

	<p>We are a hackathon organized in collaboration with seven significant uOttawa student organizations: the Engineering Student Society (ESS), IEEE uOttawa Student Branch, Computer Science Student Association (CSSA), Software Engineering Student Association (SESA), Women in Engineering uOttawa Branch, uOttawa Computer Science Club, uOttawa Game Development Club and Carleton’s IEEE Student Branch.</p>

    <p>Our mission is to provide opportunities for STEM students through an annual hackathon! We have also introduced a series of monthly events throughout the year to encourage students to network and expand their technical skills in preparation for the big day!</p>

    <p>This year, we will host about 750 hackers from across North America who will receive the opportunity to innovate software and hardware solutions from March 3rd to 5th, 2023. Events like these could not happen without the support of our sponsors and we would be thrilled to partner with ${companyName}. We encourage you to take a look at our <a href="https://drive.google.com/file/d/1wD9-VEt7WQ98w8MeBwEsF1y7i6JAqQf6/view" target="_blank" rel="noreferrer">sponsorship package</a>, which is attached to this email. I am happy to answer any questions you may have!</p>

    <p>Thank you for your time and consideration!</p>

	<p>Thank you,</p>

	<p>${name}</p>
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
			subject: "Hack the Hill 2 Sponsorship",
			message: getTemplate(companyName, companyRepName, name),
			labels: ["UNREAD", "2023-24", name],
			sender: "sponsorship@hackthehill.com",
			recipient: companyEmail,
		});
	}),
});
