import { Role } from "@prisma/client";
import { signIn, signOut, useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import Link from "next/link";
import { trpc } from "../utils/api";
import Filter from "./Filter";

type LinkProps = {
	bottom?: boolean;
};

const Links = ({ bottom }: LinkProps) => {
	const { t } = useTranslation("navbar");
	const { data: sessionData } = useSession();

	const hackerId = trpc.users.getHackerId.useQuery(
		{ id: sessionData?.user?.id ?? "" },
		{ enabled: !!sessionData?.user?.id },
	);

	const role = trpc.users.getRole.useQuery({ id: sessionData?.user?.id ?? "" }, { enabled: !!sessionData?.user?.id });

	return (
		<>
			<Link
				href="/"
				className={bottom ? "" : "text-dark hover:text-light mx-4 flex items-center font-coolvetica text-2xl"}
			>
				{bottom ? <Image priority src="/assets/home.svg" height={32} width={32} alt={t("home")} /> : t("home")}
			</Link>
			{sessionData?.user && ((role.data === Role.HACKER && hackerId.data) || role.data === Role.ORGANIZER) && (
				<Link
					href="/qr"
					className={
						bottom ? "" : "text-dark hover:text-light mx-4 flex items-center font-coolvetica text-2xl"
					}
				>
					{bottom ? <Image priority src="/assets/qr.svg" height={32} width={32} alt={t("qr")} /> : t("qr")}
				</Link>
			)}
			<Link
				href="/schedule"
				className={bottom ? "" : "text-dark hover:text-light mx-4 flex items-center font-coolvetica text-2xl"}
			>
				{bottom ? (
					<Image priority src="/assets/schedule.svg" height={32} width={32} alt={t("schedule")} />
				) : (
					t("schedule")
				)}
			</Link>
			<Link
				href="/maps"
				className={bottom ? "" : "text-dark hover:text-light mx-4 flex items-center font-coolvetica text-2xl"}
			>
				{bottom ? <Image priority src="/assets/maps.svg" height={32} width={32} alt={t("maps")} /> : t("maps")}
			</Link>
			<Link
				href="/resources"
				className={bottom ? "" : "text-dark hover:text-light mx-4 flex items-center font-coolvetica text-2xl"}
			>
				{bottom ? (
					<Image priority src="/assets/resources.svg" height={32} width={32} alt="Resources" />
				) : (
					t("resources")
				)}
			</Link>
			{sessionData?.user && (
				<Filter filter={role => role === Role.ORGANIZER || role === Role.SPONSOR}>
					<Link
						href="/hackers"
						className={
							bottom ? "" : "text-dark hover:text-light mx-4 flex items-center font-coolvetica text-2xl"
						}
					>
						{bottom ? (
							<Image priority src="/assets/list.svg" height={32} width={32} alt={t("hackers")} />
						) : (
							t("hackers")
						)}
					</Link>
				</Filter>
			)}
		</>
	);
};

type NavbarProps = {
	integrated?: boolean;
};

const Navbar = ({ integrated }: NavbarProps) => {
	const { t } = useTranslation("navbar");
	const { data: sessionData } = useSession();

	return (
		<nav
			className={`sticky top-0 z-10 flex gap-4 whitespace-nowrap bg-light-quaternary-color p-4 ${
				integrated ? "" : "border-b border-dark-primary-color shadow-navbar"
			}`}
			aria-label={t("navigation")}
		>
			<div className="flex w-full items-center justify-start font-coolvetica mobile:w-auto mobile:justify-center">
				<Link href="/">
					<Image
						className="hidden mobile:block"
						priority
						src="/assets/hackthehill-logo.svg"
						height={64}
						width={64}
						alt={t("logo")}
					/>
					<Image
						className="block mobile:hidden"
						priority
						src="/assets/hackthehill-banner.svg"
						height={238}
						width={238}
						alt={t("logo")}
					/>
				</Link>
			</div>

			<div className="hidden flex-row mobile:flex">
				<Links />
			</div>

			<button
				className="hover:bg-light-quaternary right-4 ml-auto flex whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-dark-color transition-colors sm:visible logo-center:absolute"
				onClick={sessionData ? () => void signOut() : () => void signIn()}
			>
				{sessionData ? t("sign-out") : t("sign-in")}
			</button>
		</nav>
	);
};

const BottomMenu = () => {
	const { t } = useTranslation("navbar");

	return (
		<nav
			className="sticky bottom-0 flex w-full items-center justify-evenly gap-4 whitespace-nowrap bg-light-quaternary-color p-4 mobile:hidden xs:gap-8"
			aria-label={t("bottom-navigation")}
		>
			<Links bottom />
		</nav>
	);
};

export { BottomMenu, Navbar };
