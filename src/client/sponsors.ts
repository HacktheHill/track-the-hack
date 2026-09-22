interface SponsorData {
	id: string;
	name: string;
	tier: SponsorTier;
	logo: string;
	displayWidth: number;
	hiringLink?: string;
	websiteLink?: string;
	additionalLink?: string;
}

enum SponsorTier {
	PREMIER = "premier",
	MAYOR = "mayor",
	COUNCILLOR = "councillor",
	BACKBENCHER = "backbencher",
	IN_KIND = "in-kind",
}

const sizeByTier = {
	[SponsorTier.PREMIER]: 500,
	[SponsorTier.MAYOR]: 250,
	[SponsorTier.COUNCILLOR]: 100,
	[SponsorTier.BACKBENCHER]: 75,
	[SponsorTier.IN_KIND]: 50,
} satisfies Record<SponsorTier, number>;

const sponsorsData = [
	{
		id: "cgi",
		name: "CGI",
		tier: SponsorTier.MAYOR,
		logo:
			"https://raw.githubusercontent.com/HacktheHill/hackathon-website/8fff547518da8af294d54c4fda287d44f5eda080/src/assets/Logos/CGI.svg",
		displayWidth: 500,
		websiteLink: "https://www.cgi.com/",
	},
	{
		id: "ciena",
		name: "Ciena",
		tier: SponsorTier.BACKBENCHER,
		logo:
			"https://raw.githubusercontent.com/HacktheHill/hackathon-website/8fff547518da8af294d54c4fda287d44f5eda080/src/assets/Logos/Ciena.svg",
		displayWidth: 500,
		hiringLink: "https://www.ciena.com/careers/",
		websiteLink: "https://www.ciena.ca/",
	},
	{
		id: "elevenlabs",
		name: "ElevenLabs",
		tier: SponsorTier.IN_KIND,
		logo:
			"https://raw.githubusercontent.com/HacktheHill/hackathon-website/8fff547518da8af294d54c4fda287d44f5eda080/src/assets/Logos/ElevenLabs.svg",
		displayWidth: 220,
		websiteLink: "https://elevenlabs.io/",
	},
	{
		id: "backboard",
		name: "Backboard",
		tier: SponsorTier.IN_KIND,
		logo: "/assets/sponsors/backboard.svg",
		displayWidth: 220,
		websiteLink: "https://backboard.io/",
	},
] satisfies SponsorData[];

export { sizeByTier, sponsorsData, type SponsorData, SponsorTier };
