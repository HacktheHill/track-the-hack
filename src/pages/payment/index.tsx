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

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "walk-in"]),
	};
};

const Payment: NextPage = () => {
	const router = useRouter();
	const { t } = useTranslation("schedule");
	const [idAndStatus] = [router.query.id].flat();
	const { data: sessionData } = useSession();

	const idQuery = idAndStatus ? idAndStatus.split("/")[0] : "";

	const status = idAndStatus ? idAndStatus.split("/")[1] : "";

	console.log("ID", idQuery);
	console.log("STATUS", status);

	if (!idQuery || idQuery.length < 1) {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={"You need to provide a valid id."} />
				</div>
			</App>
		);
	}

	const company = {
		id: "adezvezr",
		reps_name: "Mattia Vergnat",
		company_name: "Google",
		amount: 100,
		sponsor_reprentative: "Some guy",
		link_to_logo: "https://assets.stickpng.com/images/580b57fcd9996e24bc43c51f.png",
		sponsor_type: "Prime Minister Tier",
		payment_status: "no paid",
		payment_date: "2021-10-10",
		invoice_no: "123456789",
	};

	if (company.id !== idQuery) {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={"This company does not exist"} />
				</div>
			</App>
		);
	}

	if (status) {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<PaymentCard company={company} status={status} />
				</div>
			</App>
		);
	}

	return (
		<App className="overflow-y-auto bg-gradient3 p-8 sm:p-12" title={t("title")}>
			<OnlyRole filter={role => role === Role.HACKER || role === Role.ORGANIZER}>
				<PaymentCard company={company} status={status} />
			</OnlyRole>
			{!sessionData?.user && (
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={t("not-authorized-to-view-this-page")} />
				</div>
			)}
		</App>
	);
};

type Company = {
	id: string;
	reps_name: string;
	company_name: string;
	amount: number;
	sponsor_reprentative: string;
	link_to_logo: string;
	sponsor_type: string;
	payment_status: string;
	payment_date: string;
	invoice_no: string;
};

const PaymentCard = ({ company, status }) => {
	const stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

	const handlePayment = async () => {
		const successUrl = `http://localhost:3000/payment?id=${company.id}/success`;
		const cancelUrl = `http://localhost:3000/payment?id=${company.id}/cancelled`;

		const stripe = await stripePromise;

		console.log(stripe);

		if (stripe) {
			const { error } = await stripe.redirectToCheckout({
				lineItems: [
					{
						price: "price_1O1KIxBYkoTY5I5RQb8NYtJd", // Replace with the ID of your price
						quantity: 1,
					},
				],
				mode: "payment",
				successUrl: `https://7e10-2a09-bac1-14c0-188-00-28a-9d.ngrok-free.app/payment?id=${company.id}/success`,
				cancelUrl: `https://7e10-2a09-bac1-14c0-188-00-28a-9d.ngrok-free.app/payment?id=${company.id}/cancelled`,
			});

			// If `redirectToCheckout` fails due to a browser or network error,
			// display the localized error message to your customer
			// using `error.message`.
			if (error) {
				console.log(error);
			}
		} else {
			// Handle the case where 'stripe' is null or undefined
			console.log("Stripe is not available.");
		}
	};

	console.log(company.link_to_logo);

	return (
		<div className="flex flex-col items-center justify-center">
			{status ? (
				<div className="m-5 flex flex-col justify-center rounded-md bg-gray-50 p-8 text-center">
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
							<p className="px-3 py-3">Your payment of {company.amount}$ was successful.</p>
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
				<div className="m-5 flex flex-col justify-center rounded-md bg-gray-50 p-8">
					<div className="flex flex-col items-center">
						<img className="h-48 w-96 object-contain" alt={company.name} src={company.link_to_logo} />
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
							<p className="text-gray-700">{company.sponsor_type}</p>
						</div>
						<div className="mt-2">
							<h2 className="text-lg font-semibold">Contribution Amount</h2>
							<p className="text-gray-700">{company.amount}$</p>
						</div>
					</div>
					<button onClick={handlePayment} className="m-3 rounded-md bg-blue-500 p-2 text-white">
						<b>Checkout</b> with Stripe
					</button>
				</div>
			)}
		</div>
	);
};

export default Payment;
