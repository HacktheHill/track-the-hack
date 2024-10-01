interface SponsorData {
	id: string;
	name: string;
	tier: SponsorTier;
	logo: string;
	hiringLink: string;
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

const sizeByTier = {
	[SponsorTier.PREMIER]: 500,
	[SponsorTier.MAYOR]: 250,
	[SponsorTier.COUNCILLOR]: 100,
	[SponsorTier.BACKBENCHER]: 75,
	[SponsorTier.IN_KIND]: 50,
} satisfies Record<SponsorTier, number>;

const sponsorsData = [
	{
		id: "ross",
		name: "Ross Video",
		tier: SponsorTier.PREMIER,
		logo: "https://2024.hackthehill.com/Logos/Ross.svg",
		hiringLink: "https://www.rossvideo.com/company/careers/",
		websiteLink: "https://www.rossvideo.com/",
		additionalLink:
			"https://docs.google.com/spreadsheets/d/1QLVS6oEnce8fQmch0NeMT_ggp651Sph1/edit?gid=554881897#gid=554881897",
	},
	{
		id: "ciena",
		name: "Ciena",
		tier: SponsorTier.PREMIER,
		logo: "https://2024.hackthehill.com/Logos/Ciena.svg",
		hiringLink: "https://www.ciena.com/careers/",
		websiteLink: "https://www.ciena.com/",
	},
	{
		id: "lonehaven",
		name: "Lonehaven",
		tier: SponsorTier.MAYOR,
		logo: "https://2024.hackthehill.com/Logos/Lonehaven.svg",
	},
	{
		id: "cse",
		name: "CSE",
		tier: SponsorTier.COUNCILLOR,
		logo: "https://2024.hackthehill.com/Logos/CSE.svg",
		hiringLink: "https://www.cse-cst.gc.ca/en/careers",
		websiteLink: "https://www.cse-cst.gc.ca/en",
	},
	{
		id: "red-bull",
		name: "Red Bull",
		tier: SponsorTier.COUNCILLOR,
		logo: "https://2024.hackthehill.com/Logos/Redbull.svg",
		hiringLink: "https://jobs.redbull.com/ca-en",
		websiteLink: "https://www.redbull.com/ca-en",
	},
	{
		id: "p&g",
		name: "Procter & Gamble",
		tier: SponsorTier.BACKBENCHER,
		logo: "https://2024.hackthehill.com/Logos/P&G.svg",
	},
	{
		id: "liquid-iv",
		name: "Liquid IV",
		tier: SponsorTier.BACKBENCHER,
		logo: "https://2024.hackthehill.com/Logos/LiquidIV.png",
	},
	{
		id: "fantuan",
		name: "Fantuan",
		tier: SponsorTier.BACKBENCHER,
		logo: "https://2024.hackthehill.com/Logos/Fantuan.png",
	},
] as const as SponsorData[];

export { sizeByTier, sponsorsData, type SponsorData, SponsorTier };
