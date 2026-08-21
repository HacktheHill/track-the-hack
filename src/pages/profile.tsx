import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import App from "../components/App";
import QRCode from "../components/QRCode";
import { env } from "../env/server.mjs";
import { prisma } from "../server/db";
import { readParticipantSession } from "../server/lib/participant-session";

type ProfileData = {
	id: string;
	confirmed: boolean;
	walkIn: boolean;
	tShirtSize: string;
	mealCategory: string;
	teamName: string | null;
	presences: { id: string; label: string; value: number }[];
};

// Backed by the day-of participant session, not NextAuth. Organiser sessions
// never reach this page and this session never grants organiser access.
export const getServerSideProps: GetServerSideProps<{ profile: ProfileData }> = async ({ req, locale }) => {
	const session = readParticipantSession(req, env.PARTICIPANT_SESSION_SECRET);
	if (!session) {
		return { redirect: { destination: "/", permanent: false } };
	}

	const hacker = await prisma.hacker.findUnique({
		where: { id: session.hackerId },
		select: {
			id: true,
			confirmed: true,
			walkIn: true,
			tShirtSize: true,
			mealCategory: true,
			Team: { select: { name: true } },
			presences: { select: { id: true, label: true, value: true } },
		},
	});

	// The record can be gone even with a valid cookie, since the session is not
	// checked against the database on every request.
	if (!hacker) {
		return { redirect: { destination: "/", permanent: false } };
	}

	return {
		props: {
			profile: {
				id: hacker.id,
				confirmed: hacker.confirmed,
				walkIn: hacker.walkIn,
				tShirtSize: hacker.tShirtSize,
				mealCategory: hacker.mealCategory,
				teamName: hacker.Team?.name ?? null,
				presences: hacker.presences,
			},
			...(await serverSideTranslations(locale ?? "en", ["profile", "navbar", "common"])),
		},
	};
};

const Profile = ({ profile }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
	const { t } = useTranslation("profile");

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
					<Row label={t("t-shirt")} value={profile.tShirtSize} />
					<Row label={t("meal")} value={profile.mealCategory} />
					{profile.teamName && <Row label={t("team")} value={profile.teamName} />}
					{profile.walkIn && <Row label={t("walk-in")} value={t("yes")} />}
				</dl>
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
