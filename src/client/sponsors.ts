interface SponsorData {
	id: string;
	name: string;
	tier: SponsorTier;
	logo: string;
	displayWidth: number;
	displayHeight: number;
	hiringLink?: string;
	websiteLink: string;
	additionalLink?: string;
}

enum SponsorTier {
	PREMIER = "premier",
	MAYOR = "mayor",
	COUNCILLOR = "councillor",
	BACKBENCHER = "backbencher",
	IN_KIND = "in-kind",
}

const sponsorsData = [
	{
		id: "cgi",
		name: "CGI",
		tier: SponsorTier.MAYOR,
		logo: "/assets/sponsors/cgi.svg",
		displayWidth: 500,
		displayHeight: 244,
		websiteLink: "https://www.cgi.com/",
	},
	{
		id: "ciena",
		name: "Ciena",
		tier: SponsorTier.BACKBENCHER,
		logo: "/assets/sponsors/ciena.svg",
		displayWidth: 500,
		displayHeight: 159,
		hiringLink: "https://www.ciena.com/careers/",
		websiteLink: "https://www.ciena.ca/",
	},
	{
		id: "elevenlabs",
		name: "ElevenLabs",
		tier: SponsorTier.IN_KIND,
		logo: "/assets/sponsors/elevenlabs.svg",
		displayWidth: 220,
		displayHeight: 29,
		websiteLink: "https://elevenlabs.io/",
	},
	{
		id: "backboard",
		name: "Backboard",
		tier: SponsorTier.IN_KIND,
		logo: "/assets/sponsors/backboard.svg",
		displayWidth: 220,
		displayHeight: 27,
		websiteLink: "https://backboard.io/",
	},
	{
		id: "uosu",
		name: "University of Ottawa Students' Union",
		tier: SponsorTier.BACKBENCHER,
		logo: "/assets/sponsors/UOSU.svg",
		displayWidth: 500,
		displayHeight: 157,
		websiteLink: "https://www.seuo-uosu.com/",
	},
	{
		id: "eef",
		name: "Engineering Endowment Fund",
		tier: SponsorTier.IN_KIND,
		logo: "/assets/sponsors/EEF.svg",
		displayWidth: 220,
		displayHeight: 68,
		websiteLink: "https://www.uottawa.ca/faculty-engineering/student-hub/funding-student-initiatives",
	},
	{
		id: "mathematech",
		name: "MathemaTech",
		tier: SponsorTier.IN_KIND,
		logo: "/assets/sponsors/MathemaTech.svg",
		displayWidth: 220,
		displayHeight: 41,
		websiteLink: "https://www.mthm.tech/",
	},
] satisfies SponsorData[];

export { sponsorsData, type SponsorData, SponsorTier };
