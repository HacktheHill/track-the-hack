import { RoleName } from "@prisma/client";
import { sponsorshipGmailDraftsSchema } from "../../../utils/common";
import { hasRoles } from "../../../utils/helpers";
import { createDraft } from "../../lib/gmail";
import { createTRPCRouter, protectedProcedure } from "../trpc";

/**
 * Get the email template
 *
 * @param {string} organizerFullName
 * @param {string} companyName
 * @param {string} companyRepName
 * @returns {string} Email template
 */

export const sponsorshipGmailDraftsRouter = createTRPCRouter({
	createGmailDraft: protectedProcedure.input(sponsorshipGmailDraftsSchema).mutation(async ({ ctx, input }) => {
		const userId = ctx.session.user.id;
		const user = await ctx.prisma.user.findUnique({
			where: {
				id: userId,
			},
			select: {
				name: true,
				roles: {
					select: {
						name: true,
					},
				},
			},
		});

		if (!user) {
			throw new Error("User not found");
		}

		if (!hasRoles(user, [RoleName.ORGANIZER])) {
			throw new Error("You do not have permission to do this");
		}

		const { organizerFullName, companyEmail, subject, emailHTML } = input;

		const name = organizerFullName ?? user.name;

		if (!name) {
			throw new Error("Organizer name is required");
		}

		return createDraft({
			subject,
			message: emailHTML,
			labels: ["UNREAD", "2023-24", name],
			sender: "sponsorship@hackthehill.com",
			recipient: companyEmail,
		});
	}),
});
