import { Role } from "@prisma/client";
import { signIn, signOut, useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import Link from "next/link";
import { trpc } from "../utils/api";
import OnlyRole from "./OnlyRole";

type NavbarProps = {
	integrated?: boolean;
};

const Navbar = ({ integrated }: NavbarProps) => {
	const { t } = useTranslation("navbar");
	const { data: sessionData } = useSession();
	return (
		<nav
			className={`sticky top-0 z-10 flex gap-4 whitespace-nowrap bg-background1 p-4 ${
				integrated ? "" : "border-b border-dark shadow-navbar"
			}`}
			aria-label={t("main-navigation")}
		>
			<div className="flex w-full items-center justify-center font-coolvetica mobile:w-auto">
				<Link href="/">
					<Image
						className="hidden mobile:block"
						priority
						src="/assets/hackthehill-logo.svg"
						height={64}
						width={64}
						alt={t("home")}
					/>
					<Image
						className="block mobile:hidden"
						priority
						src="/assets/hackthehill-banner.svg"
						height={238}
						width={238}
						alt={t("home")}
					/>
				</Link>
			</div>

			<div className="hidden flex-row mobile:flex">
				<Links />
			</div>

			<button
				className="right-4 ml-auto flex whitespace-nowrap rounded-lg border border-dark bg-background1 py-2 px-4 font-coolvetica text-dark transition-colors hover:bg-background3 sm:visible logo-center:absolute"
				onClick={sessionData ? () => void signOut() : () => void signIn()}
			>
				{sessionData ? t("sign-out") : t("sign-in")}
			</button>
		</nav>
	);
};

const BottomMenu = () => {
	const { t } = useTranslation("navbar");
	const { data: sessionData } = useSession();
	const hackerQuery = trpc.users.getHackerId.useQuery(
		{ id: sessionData?.user?.id ?? "" },
		{ enabled: !!sessionData?.user?.id },
	);

	return (
		<nav
			className="sticky bottom-0 flex w-full items-center justify-evenly gap-4 whitespace-nowrap bg-background1 p-4 mobile:hidden xs:gap-8"
			aria-label={t("bottom-navigation")}
		>
			<Link href="/">
				<Image priority src="/assets/home.svg" height={32} width={32} alt={t("home")} />
			</Link>
			{sessionData?.user && hackerQuery.data && (
				<OnlyRole filter={role => role === Role.HACKER}>
					<Link href="/qr">
						<Image priority src="/assets/qr.svg" height={32} width={32} alt={t("qr")} />
					</Link>
				</OnlyRole>
			)}
			<Link href="/schedule">
				<Image priority src="/assets/schedule.svg" height={32} width={32} alt={t("schedule")} />
			</Link>
			<Link href="/maps">
				<Image priority src="/assets/maps.svg" height={32} width={32} alt={t("maps")} />
			</Link>
			<Link href="/resources">
				<Image priority src="/assets/resources.svg" height={32} width={32} alt={t("resources")} />
			</Link>
			{sessionData?.user && (
				<OnlyRole filter={role => role === Role.ORGANIZER || role === Role.SPONSOR}>
					<Link href="/hackers">
						<Image priority src="/assets/list.svg" height={32} width={32} alt="Hackers" />
					</Link>
				</OnlyRole>
			)}
		</nav>
	);
};

const Links = () => {
	const { t } = useTranslation("navbar");
	const { data: sessionData } = useSession();

	const hackerQuery = trpc.users.getHackerId.useQuery(
		{ id: sessionData?.user?.id ?? "" },
		{ enabled: !!sessionData?.user?.id },
	);

	return (
		<>
			<Link href="/" className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light">
				{t("home")}
			</Link>
			{sessionData?.user && hackerQuery.data && (
				<OnlyRole filter={role => role === Role.HACKER}>
					<Link
						href="/qr"
						className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light"
					>
						{t("qr")}
					</Link>
				</OnlyRole>
			)}
			<Link
				href="/schedule"
				className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light"
			>
				{t("schedule")}
			</Link>
			<Link href="/maps" className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light">
				{t("maps")}
			</Link>
			<Link
				href="/resources"
				className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light"
			>
				{t("resources")}
			</Link>
			{sessionData?.user && (
				<>
					<OnlyRole filter={role => role === Role.ORGANIZER || role === Role.SPONSOR}>
						<Link
							href="/hackers"
							className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light"
						>
							{t("hackers")}
						</Link>
					</OnlyRole>
					<OnlyRole filter={role => role === Role.ORGANIZER}>
						<Link
							href="/walk-in"
							className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light"
						>
							{t("walk-in")}
						</Link>
					</OnlyRole>
				</>
			)}
		</>
	);
};

export { BottomMenu, Navbar };
