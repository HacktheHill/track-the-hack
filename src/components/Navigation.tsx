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
	const { data: sessionData } = useSession();
	return (
		<nav
			className={`sticky top-0 z-10 flex gap-4 whitespace-nowrap bg-background1 p-4 ${
				integrated ? "" : "border-b border-dark shadow-navbar"
			}`}
			aria-label="Main navigation"
		>
			<div className="flex w-full items-center justify-center font-coolvetica mobile:w-auto">
				<Link href="/">
					<Image
						className="hidden mobile:block"
						priority
						src="/assets/hackthehill-logo.svg"
						height={64}
						width={64}
						alt="Home"
					/>
					<Image
						className="block mobile:hidden"
						priority
						src="/assets/hackthehill-banner.svg"
						height={238}
						width={238}
						alt="Home"
					/>
				</Link>
			</div>

			<div className="hidden flex-row mobile:flex">
				<Links />
			</div>

			<button
				className="right-4 ml-auto flex whitespace-nowrap rounded-lg border border-dark bg-background1 px-4 py-2 font-coolvetica text-dark transition-colors hover:bg-background3 sm:visible logo-center:absolute"
				onClick={sessionData ? () => void signOut() : () => void signIn()}
			>
				{sessionData ? "Sign out" : "Sign in"}
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
			aria-label="Bottom navigation"
		>
			<Link href="/">
				<Image priority src="/assets/home.svg" height={32} width={32} alt="Home" />
			</Link>
			{sessionData?.user && hackerQuery.data && (
				<OnlyRole filter={role => role === Role.HACKER}>
					<Link href="/qr">
						<Image priority src="/assets/qr.svg" height={32} width={32} alt="QR" />
					</Link>
				</OnlyRole>
			)}
			<Link href="/schedule">
				<Image priority src="/assets/schedule.svg" height={32} width={32} alt="Schedule" />
			</Link>
			<Link href="/maps">
				<Image priority src="/assets/maps.svg" height={32} width={32} alt="Maps" />
			</Link>
			<Link href="/resources">
				<Image priority src="/assets/resources.svg" height={32} width={32} alt="Resources" />
			</Link>
			{sessionData?.user && (
				<>
					<OnlyRole filter={role => role === Role.ORGANIZER || role === Role.SPONSOR}>
						<Link href="/hackers">
							<Image priority src="/assets/list.svg" height={32} width={32} alt="Hackers" />
						</Link>
					</OnlyRole>
					<OnlyRole filter={role => role === Role.ORGANIZER}>
						<Link href="/internal">Internal</Link>
					</OnlyRole>
				</>
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
				Home
			</Link>
			{sessionData?.user && hackerQuery.data && (
				<OnlyRole filter={role => role === Role.HACKER}>
					<Link
						href="/qr"
						className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light"
					>
						QR
					</Link>
				</OnlyRole>
			)}
			<Link
				href="/schedule"
				className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light"
			>
				Schedule
			</Link>
			<Link href="/maps" className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light">
				Maps
			</Link>
			<Link
				href="/resources"
				className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light"
			>
				Resources
			</Link>
			{sessionData?.user && (
				<>
					<OnlyRole filter={role => role === Role.ORGANIZER || role === Role.SPONSOR}>
						<Link
							href="/hackers"
							className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light"
						>
							Hackers
						</Link>
					</OnlyRole>
					<OnlyRole filter={role => role === Role.ORGANIZER}>
						<Link
							href="/walk-in"
							className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light"
						>
							Walk-In
						</Link>
						<Link
							href="/internal"
							className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light"
						>
							Internal
						</Link>
					</OnlyRole>
				</>
			)}
		</>
	);
};

export { BottomMenu, Navbar };
