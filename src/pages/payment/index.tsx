import { Role } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps, NextPage } from "next/types";

import App from "../../components/App";

import { useRouter } from "next/router";
import Error from "../../components/Error";
import OnlyRole from "../../components/OnlyRole";
import { loadStripe } from "@stripe/stripe-js";

import { env } from "../../env/client.mjs";
import { trpc } from "../../utils/api";
import Loading from "../../components/Loading";
import * as React from "react";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "walk-in"]),
	};
};

type Company = {
	id: string;
	reps_name: string;
	company_name: string;
	amount: number;
	tier: string;
	logo: string;
	paid: string;
	date: Date;
};

type PaymentCardProps = {
	company: Company;
	status: string | undefined;
};

const Payment: NextPage = () => {
	const router = useRouter();
	const { t } = useTranslation("payment");
	const { data: sessionData } = useSession();

	const [idQuery] = [router.query.id].flat();
	const companyQuery = trpc.payment.getCompany.useQuery({ id: idQuery ?? "" });

	if (companyQuery.isLoading) {
		return (
			<App className="from-background2 to-background1 h-full bg-gradient-to-b px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<Loading />
				</div>
			</App>
		);
	}

	if (!idQuery || idQuery.length < 1) {
		return (
			<App className="from-background2 to-background1 h-full bg-gradient-to-b px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={"You need to provide a valid id."} />
				</div>
			</App>
		);
	}

	if (!companyQuery.isLoading && !companyQuery.data) {
		return (
			<App className="from-background2 to-background1 h-full bg-gradient-to-b px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={"This company does not exist"} />
				</div>
			</App>
		);
	}

	let status;

	if (companyQuery.data.paid === "paid") {
		status = "success";
	} else if (companyQuery.data.paid === "cancelled") {
		status = "cancelled";
	} else {
		status = undefined;
	}

	if (status) {
		return (
			<App className="from-background2 to-background1 h-full bg-default-gradient px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<PaymentCard company={companyQuery.data} status={status} />
				</div>
			</App>
		);
	}

	return (
		<App className="overflow-y-auto bg-default-gradient p-8 sm:p-12" title={t("title")}>
			<OnlyRole filter={role => role === Role.HACKER || role === Role.ORGANIZER}>
				<PaymentCard company={companyQuery.data} status={status} />
			</OnlyRole>
			{!sessionData?.user && (
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={t("not-authorized-to-view-this-page")} />
				</div>
			)}
		</App>
	);
};

const PaymentCard: React.FC<PaymentCardProps> = ({ company, status }) => {
	const stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

	const handlePaymentOnClick = () => {
		handlePayment()
			.then(() => {
				console.log("Payment successful");
			})
			.catch(err => {
				console.log(err);
			});
	};

	const handlePayment = async () => {
		const url = `${env.NEXT_PUBLIC_REDIRECT_URL}payment?id=${company.id}`;

		try {
			const stripe = await stripePromise;

			console.log(stripe);

			const price_id: { [key: string]: string } = {
				Test: env.NEXT_PUBLIC_PRICE_ID_TEST,
				STARTUP: env.NEXT_PUBLIC_PRICE_ID_STARTUP,
				MAYOR: env.NEXT_PUBLIC_PRICE_ID_MAYOR,
				PREMIER: env.NEXT_PUBLIC_PRICE_ID_PREMIER,
				GOVERNOR: env.NEXT_PUBLIC_PRICE_ID_GOVERNOR,
				PRIME_MINISTER: env.NEXT_PUBLIC_PRICE_ID_PRIME_MINISTER,
				CUSTOM: env.NEXT_PUBLIC_PRICE_ID_CUSTOM,
			};

			if (stripe) {
				const { error } = await stripe.redirectToCheckout({
					lineItems: [
						{
							price: price_id[company.tier],
							quantity: 1,
						},
					],
					mode: "payment",
					successUrl: url,
					cancelUrl: url,
				});
				if (error) {
					console.log(error);
				}
			} else {
				console.log("Stripe is not available.");
			}
		} catch (err) {
			console.log(err);
		}
	};

	return (
		<div className="flex flex-col items-center justify-center">
			{status ? (
				<div className="flex flex-col justify-center rounded-md bg-light-quaternary-color p-8 text-center">
					<div className="flex flex-col items-center">
						<img
							className="h-48 w-96 object-contain"
							src="/assets/hackthehill-logo.svg"
							alt="HackTheHill Logo"
						/>
					</div>
					{status == "success" ? (
						<div className="px-3 py-3">
							<h1 className="px-3 py-3 text-2xl font-bold ">
								Thank you for your sponsorship of Hack the Hill.
							</h1>
							<p className="px-3 py-3">Your payment of ${company.amount} was successful.</p>
						</div>
					) : (
						<div className="px-3 py-3">
							<h1 className="px-3 py-3 text-2xl font-bold">Payment Cancelled</h1>
							<p className="px-3 py-3">
								❌ Transaction was cancelled by Stripe API. If this error persists, please contact a
								Hack the Hill team member.
							</p>
						</div>
					)}
				</div>
			) : (
				<div className="flex flex-col justify-center rounded-md bg-light-quaternary-color p-8">
					<div className="flex flex-col items-center">
						<img className="m-2 h-48 w-96 object-contain" alt={company.company_name} src={company.logo} />
					</div>
					<h1>Thank you for considering your sponsorship of Hack the Hill.</h1>
					<h1>By submitting the form below, you are making a secure payment via Stripe.</h1>
					<div className="p-4">
						<div className="mt-2">
							<h2 className="text-lg font-semibold">Company Name</h2>
							<p className="text-gray-700">{company.company_name}</p>
						</div>
						<div className="mt-2">
							<h2 className="text-lg font-semibold">Sponsorship Tier</h2>
							<p className="text-gray-700">{company.tier.toLowerCase()}</p>
						</div>
						<div className="mt-2">
							<h2 className="text-lg font-semibold">Contribution Amount</h2>
							<p className="text-gray-700">${company.amount}</p>
						</div>
					</div>
					<button
						onClick={handlePaymentOnClick}
						className="m-3 rounded-md bg-dark-primary-color p-2 text-white"
					>
						<b>Checkout</b> with Stripe
					</button>
					{`${env.NEXT_PUBLIC_REDIRECT_URL}payment?id=${company.id}`}
					<br />
					{"https://ba61-2a09-bac1-14c0-188-00-28a-b0.ngrok-free.app/payment?id=dYWY1qkF"}
				</div>
			)}
		</div>
	);
};

export default Payment;
