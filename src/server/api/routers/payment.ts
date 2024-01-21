import { z } from "zod";
import { addSponsorshipSchema, sponsorshipSchema } from "../../../utils/common";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const paymentRouter = createTRPCRouter({
	getCompany: protectedProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const company = await ctx.prisma.payment.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!company) {
				throw new Error("Company not found");
			}

			return company;
		}),

	getAllCompanies: protectedProcedure.query(async ({ ctx }) => {
		return await ctx.prisma.payment.findMany();
	}),

	updateCompany: protectedProcedure
		.input(
			sponsorshipSchema.extend({
				id: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existingCompany = await ctx.prisma.payment.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!existingCompany) {
				throw new Error("Company not found");
			}

			const updatedCompany = await ctx.prisma.payment.update({
				where: {
					id: input.id,
				},
				data: input,
			});

			return updatedCompany;
		}),

	addCompany: protectedProcedure
		.input(
			addSponsorshipSchema.extend({
				id: z.string(),
				logo: z.string().default("default_logo_url"),
				date: z.date().default(() => new Date()),
				invoice: z.string().default("default_invoice"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const newCompany = await ctx.prisma.payment.create({
				data: input,
			});

			return newCompany;
		}),
});
