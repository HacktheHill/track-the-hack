import { Locale, RoleName } from "@prisma/client";
import { signIn, signOut, useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import Filter from "./Filter";
import { trpc } from "../server/api/api";
import { AcceptanceStatus } from "@prisma/client";

type LinkItemProps = {
	href: string;
	bottom: boolean;
	text: string;
	src: string;
	alt: string;
};

const LinkItem = ({ href, bottom, text, src, alt }: LinkItemProps) => (
	<Link
		href={href}
		className={
			bottom ? "" : "hover:text-light mx-4 flex items-center font-coolvetica text-2xl text-dark-primary-color"
		}
	>
		{bottom ? <Image priority src={src} height={32} width={32} alt={alt} /> : text}
	</Link>
);

type LinkProps = {
	bottom: boolean;
};

const Links = ({ bottom }: LinkProps) => {
	const { t } = useTranslation("navbar");
	const { data: sessionData } = useSession();
	// Fetch acceptance status to decide when to show QR even if HACKER role not yet granted
	const { data: acceptanceStatus } = trpc.users.acceptanceStatus.useQuery(undefined, { enabled: !!sessionData });

	const isOrganizer = sessionData?.user?.roles.includes(RoleName.ORGANIZER);
	const hasApplied = !!sessionData?.user?.hackerId; // application submitted
	const isAccepted = acceptanceStatus === AcceptanceStatus.ACCEPTED;

	return (
		<>
			<LinkItem href="/" bottom={bottom} text={t("home")} src="/assets/home.svg" alt={t("home")} />
			{(isOrganizer || (isAccepted && hasApplied)) && (
				<LinkItem href="/qr" bottom={bottom} text={t("qr")} src="/assets/qr.svg" alt={t("qr")} />
			)}
			<LinkItem
				href="/schedule"
				bottom={bottom}
				text={t("schedule")}
				src="/assets/schedule.svg"
				alt={t("schedule")}
			/>
			<LinkItem href="/maps" bottom={bottom} text={t("maps")} src="/assets/maps.svg" alt={t("maps")} />
			<LinkItem
				href="/resources"
				bottom={bottom}
				text={t("resources")}
				src="/assets/resources.svg"
				alt="Resources"
			/>
			<LinkItem
				href="/sponsors"
				bottom={bottom}
				text={t("sponsors")}
				src="/assets/sponsors.svg"
				alt={t("sponsors")}
			/>
			{sessionData?.user && (
				<Filter value={[RoleName.MAYOR, RoleName.PREMIER, RoleName.ORGANIZER]} silent method="some">
					<LinkItem
						href="/hackers"
						bottom={bottom}
						text={t("hackers")}
						src="/assets/list.svg"
						alt={t("hackers")}
					/>
				</Filter>
			)}
			{sessionData?.user && (
				<Filter value={[RoleName.PREMIER, RoleName.ORGANIZER]} silent method="some">
					<LinkItem
						href="/metrics"
						bottom={bottom}
						text={t("metrics")}
						src="/assets/metrics.svg"
						alt={t("metrics")}
					/>
				</Filter>
			)}
			{/* Show profile link if user has applied (hackerId), even if not yet accepted */}
			{hasApplied && (
				<LinkItem
					href={`/hackers/hacker?id=${sessionData?.user?.hackerId ?? ""}`}
					bottom={bottom}
					text={t("profile")}
					src="/assets/profile.svg"
					alt={t("profile")}
				/>
			)}
		</>
	);
};

type NavbarProps = {
	integrated?: boolean;
};

const Navbar = ({ integrated }: NavbarProps) => {
	const { t, i18n } = useTranslation("navbar");
	const { data: sessionData } = useSession();

	const router = useRouter();
	const { locale } = router;

	const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		void i18n.changeLanguage(e.target.value.toLocaleLowerCase());
		void router.push(
			{
				pathname: router.pathname,
				query: router.query,
			},
			router.asPath,
			{
				locale: e.target.value.toLocaleLowerCase(),
			},
		);
	};

	return (
		<nav
			className={`sticky top-0 z-10 flex gap-4 whitespace-nowrap bg-light-quaternary-color p-4 ${
				integrated ? "" : "border-b border-dark-primary-color shadow-navbar"
			}`}
			aria-label={t("navigation")}
		>
			<div className="flex w-full justify-between font-coolvetica mobile:w-auto">
				<Link href="/">
					<Image
						className="block"
						priority
						src="/assets/hackthehill-logo.svg"
						height={64}
						width={64}
						alt={t("logo")}
					/>
				</Link>
			</div>

			<div className="hidden flex-row mobile:flex">
				<Links bottom={false} />
			</div>

			<select
				className="hover:bg-light-quaternary ml-auto whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-dark-primary-color transition-colors sm:visible"
				onChange={handleLanguageChange}
				value={locale ?? "en"}
			>
				{Object.keys(Locale).map(locale => (
					<option key={locale} value={locale.toLocaleLowerCase()}>
						{locale}
					</option>
				))}
			</select>

			{sessionData ? (
				<button
					className="hover:bg-light-quaternary whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-dark-primary-color transition-colors sm:visible"
					onClick={() => void signOut()}
				>
					{t("sign-out")}
				</button>
			) : (
				<>
					<button
						className="hover:bg-light-quaternary whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-dark-primary-color transition-colors sm:visible"
						onClick={() => void signIn()}
					>
						{t("sign-in")}
					</button>
					<button
						className="hover:bg-light-quaternary whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-dark-primary-color transition-colors sm:visible"
						onClick={() => void router.push("/auth/sign-up")}
					>
						{t("sign-up")}
					</button>
				</>
			)}

			{sessionData?.user?.image && (
				// eslint-disable-next-line @next/next/no-img-element
				<img className="rounded-full" src={sessionData.user.image} width={40} height={40} alt="User avatar" />
			)}
		</nav>
	);
};

const BottomMenu = () => {
	const { t } = useTranslation("navbar");

	return (
		<nav
			className="z-10 flex w-full items-center justify-evenly gap-4 whitespace-nowrap bg-light-quaternary-color p-4 mobile:hidden xs:gap-8"
			aria-label={t("bottom-navigation")}
		>
			<Links bottom />
		</nav>
	);
};

export { BottomMenu, Navbar };
