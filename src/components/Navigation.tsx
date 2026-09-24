import { RoleName } from "@prisma/client";
import { signOut, useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useHasParticipantPass } from "@/utils/participant-pass";
import Filter from "./Filter";

type LinkItemProps = {
	href: string;
	bottom: boolean;
	text: string;
	src: string;
	alt: string;
};

const LinkItem = ({ href, bottom, text, src, alt }: LinkItemProps) => {
	const { asPath } = useRouter();
	const active = href === "/" ? asPath === "/" : asPath.split("?")[0]?.startsWith(href);
	return (
		<Link href={href} className="ui-nav-link" aria-current={active ? "page" : undefined} aria-label={text}>
			{bottom ? <Image priority src={src} height={32} width={32} alt={alt} /> : text}
		</Link>
	);
};

type LinkProps = {
	bottom: boolean;
};

const Links = ({ bottom }: LinkProps) => {
	const { t } = useTranslation("navbar");
	const { data: sessionData } = useSession();
	const hasPass = useHasParticipantPass();

	return (
		<>
			<LinkItem href="/" bottom={bottom} text={t("home")} src="/assets/home.svg" alt={t("home")} />
			{hasPass && <LinkItem href="/pass" bottom={bottom} text={t("pass")} src="/assets/qr.svg" alt={t("pass")} />}
			{hasPass && (
				<LinkItem
					href="/services"
					bottom={bottom}
					text={t("services")}
					src="/assets/resources.svg"
					alt={t("services")}
				/>
			)}
			<Filter value={[RoleName.ORGANIZER, RoleName.ADMIN]} silent method="some">
				<LinkItem href="/qr" bottom={bottom} text={t("qr")} src="/assets/qr.svg" alt={t("qr")} />
			</Filter>
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
				alt={t("resources")}
			/>
			{sessionData?.user && (
				<Filter value={[RoleName.PREMIER, RoleName.ORGANIZER, RoleName.ADMIN]} silent method="some">
					<LinkItem
						href="/metrics"
						bottom={bottom}
						text={t("metrics")}
						src="/assets/metrics.svg"
						alt={t("metrics")}
					/>
				</Filter>
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
			className={`ui-navbar sticky top-0 z-10 flex whitespace-nowrap bg-light-quaternary-color ${
				integrated ? "" : "border-b border-dark-primary-color shadow-navbar"
			}`}
			aria-label={t("navigation")}
		>
			<div className="mr-auto flex shrink-0 xl:mr-0">
				<Link href="/" className="flex min-h-11 items-center">
					<Image
						className="block"
						priority
						src="/assets/hackthehill-logo.svg"
						height={44}
						width={44}
						alt={t("logo")}
					/>
				</Link>
			</div>

			<div className="ui-nav-links">
				<Links bottom={false} />
			</div>

			<select
				aria-label={t("language")}
				className="hover:bg-light-quaternary ml-auto whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-dark-primary-color transition-colors sm:visible"
				onChange={handleLanguageChange}
				value={locale ?? "en"}
			>
				{["EN", "FR"].map(locale => (
					<option key={locale} value={locale.toLocaleLowerCase()}>
						{locale}
					</option>
				))}
			</select>

			{sessionData ? (
				<button className="ui-button" onClick={() => void signOut()}>
					{t("sign-out")}
				</button>
			) : (
				<button
					className="ui-button"
					onClick={() =>
						// Keep private fragment capabilities out of the server-bound login query.
						void router.push({
							pathname: "/auth/sign-in",
							query: { callbackUrl: router.asPath.split("#")[0] },
						})
					}
				>
					{t("sign-in")}
				</button>
			)}

			{sessionData?.user?.image && (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					className="rounded-full"
					src={sessionData.user.image}
					width={40}
					height={40}
					alt={t("user-avatar")}
				/>
			)}
		</nav>
	);
};

const BottomMenu = () => {
	const { t } = useTranslation("navbar");

	return (
		<nav
			className="ui-bottom-nav z-10 w-full items-center whitespace-nowrap bg-light-quaternary-color"
			aria-label={t("bottom-navigation")}
		>
			<Links bottom />
		</nav>
	);
};

export { BottomMenu, Navbar };
