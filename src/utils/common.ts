import { RoleName } from "@prisma/client";
import { z } from "zod";

export const roleHierarchy: RoleName[] = [RoleName.MAYOR, RoleName.PREMIER, RoleName.ORGANIZER, RoleName.ADMIN];

export const sponsorshipGmailDraftsSchema = z.object({
	organizerFullName: z.string(),
	companyEmail: z.string().email(),
	subject: z.string(),
	emailHTML: z.string(),
});
