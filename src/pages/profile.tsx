import { TShirtSize, type MealCategory } from "@prisma/client";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useEffect } from "react";
import App from "@/components/App";
import ParticipantSignOut from "@/components/ParticipantSignOut";
import NotificationPreferences from "@/components/NotificationPreferences";
import QRCode from "@/components/QRCode";
import { env } from "@/env/server.mjs";
import { prisma } from "@/server/db";
import { readParticipantSession } from "@/server/lib/participant-session";
import { PrismaHackerLifecycleRepository } from "@/server/repositories/prisma-hacker-lifecycle";
import { storeOfflineParticipantPass } from "@/utils/participant-pass";

export type ProfileData = {
	id: string;
	confirmed: boolean;
	tShirtSize: TShirtSize;
	mealCategory: MealCategory;
	presences: { id: string; label: string; value: number }[];
};

const lifecycleRepository = new PrismaHackerLifecycleRepository(prisma);

// Backed by the day-of participant session, not NextAuth. Organiser sessions
// never reach this page and this session never grants organiser access.
export const getServerSideProps: GetServerSideProps<{ profile: ProfileData }> = async ({ req, res, locale }) => {
	res.setHeader("Cache-Control", "private, no-store");
	const session = await readParticipantSession(req, env.PARTICIPANT_SESSION_SECRET, (verifier, now) =>
		lifecycleRepository.findParticipantSession(verifier, now),
	);
	if (!session) {
		return { redirect: { destination: "/", permanent: false } };
	}

	const hacker = await prisma.hacker.findUnique({
		where: { id: session.hackerId },
		select: {
			id: true,
			confirmed: true,
			tShirtSize: true,
			mealCategory: true,
			presences: {
				select: { id: true, value: true, event: { select: { name: true, nameFr: true } } },
			},
		},
	});

	// The Hacker can still disappear between the session lookup and this query.
	if (!hacker) {
		return { redirect: { destination: "/", permanent: false } };
	}

	const french = locale?.startsWith("fr") ?? false;
	return {
		props: {
			profile: {
				id: hacker.id,
				confirmed: hacker.confirmed,
				tShirtSize: hacker.tShirtSize,
				mealCategory: hacker.mealCategory,
				presences: hacker.presences.map(presence => ({
					id: presence.id,
					value: presence.value,
					label: french ? presence.event.nameFr : presence.event.name,
				})),
			},
			...(await serverSideTranslations(locale ?? "en", ["profile", "navbar", "common"])),
		},
	};
};

const Profile = ({
	profile,
	notificationPreferences,
}: InferGetServerSidePropsType<typeof getServerSideProps> & { notificationPreferences?: React.ReactNode }) => {
	const { t } = useTranslation("profile");

	useEffect(() => {
		storeOfflineParticipantPass(profile.id);
	}, [profile.id]);

	return (
		<App
			className="flex flex-col items-center gap-8 overflow-y-auto bg-default-gradient p-6"
			title={t("title")}
			noIndex
		>
			<section className="flex w-full max-w-xl flex-col items-center gap-4 rounded-xl bg-light-quaternary-color p-8 shadow-lg">
				<h1 className="text-center font-coolvetica text-3xl text-dark-color">{t("title")}</h1>
				<QRCode value={profile.id} label={t("qr-alt")} />
				<p className="text-center font-rubik text-sm text-dark-color">{t("qr-explanation")}</p>
			</section>

			<section className="w-full max-w-xl rounded-xl bg-light-quaternary-color p-8 shadow-lg">
				<h2 className="font-coolvetica text-2xl text-dark-color">{t("details")}</h2>
				<dl className="mt-4 grid gap-2 font-rubik text-dark-color">
					<Row label={t("confirmed")} value={profile.confirmed ? t("yes") : t("no")} />
					<Row
						label={t("t-shirt")}
						value={profile.tShirtSize === TShirtSize.NONE ? t("common:no-t-shirt") : profile.tShirtSize}
					/>
					<Row label={t("meal")} value={t(`meal-category.${profile.mealCategory}`)} />
				</dl>
			</section>

			<section className="w-full max-w-xl rounded-xl bg-light-quaternary-color p-8 shadow-lg">
				<h2 className="font-coolvetica text-2xl text-dark-color">{t("notifications.title")}</h2>
				<p className="mt-2 font-rubik text-sm text-dark-color">{t("notifications.explanation")}</p>
				{notificationPreferences === undefined ? <NotificationPreferences /> : notificationPreferences}
			</section>

			<section className="w-full max-w-xl rounded-xl bg-light-quaternary-color p-8 shadow-lg">
				<h2 className="font-coolvetica text-2xl text-dark-color">{t("attendance")}</h2>
				{profile.presences.length === 0 ? (
					<p className="mt-4 font-rubik text-dark-color">{t("no-attendance")}</p>
				) : (
					<dl className="mt-4 grid gap-2 font-rubik text-dark-color">
						{profile.presences.map(presence => (
							<Row key={presence.id} label={presence.label} value={String(presence.value)} />
						))}
					</dl>
				)}
			</section>

			<ParticipantSignOut />
		</App>
	);
};

const Row = ({ label, value }: { label: string; value: string }) => (
	<div className="flex justify-between gap-4 border-b border-dark-color/10 pb-2">
		<dt className="font-bold">{label}</dt>
		<dd>{value}</dd>
	</div>
);

export default Profile;
