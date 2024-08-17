import { faker } from "@faker-js/faker";
import { Locale, TravelAccommodations, TShirtSize } from "@prisma/client";

const generateHackerData = () => {
	const firstName = faker.person.firstName();
	const lastName = faker.person.lastName();
	const email = faker.internet.email();
	const phoneNumber = faker.phone.number();
	const emergencyContactName = faker.person.firstName();
	const emergencyContactRelationship = faker.helpers.arrayElement(["Mother", "Father", "Sibling", "Friend"]);
	const emergencyContactPhoneNumber = faker.phone.number();

	return {
		preferredLanguage: faker.helpers.arrayElement(Object.values(Locale)),
		firstName,
		lastName,
		email,
		phoneNumber,
		country: faker.location.countryCode(),
		age: faker.number.int({ min: 15, max: 30 }),
		dietaryRestrictions: faker.helpers.arrayElement([
			"Halal",
			"Gluten-Free",
			"Vegetarian",
			"Vegan",
			"Kosher",
			"Lactose Intolerance",
			"Nuts",
			"Soy",
			"None",
			"Pescetarian",
		]),
		specialAccommodations: faker.helpers.arrayElement([null, "Wheelchair access", "Sign language interpreter"]),
		emergencyContactName,
		emergencyContactRelation: emergencyContactRelationship,
		emergencyContactPhoneNumber,
		gender: faker.helpers.arrayElement(["Male", "Female", "Non-Binary", "Gender Fluid", "Prefer Not to Answer"]),
		pronouns: faker.helpers.arrayElement(["He/Him", "She/Her", "They/Them", "Ze/Zir", "Prefer not to say"]),
		raceEthnicity: faker.helpers.arrayElement([
			"Caucasian (White)",
			"South Asian",
			"African",
			"East Asian",
			"Hispanic / Latino / Spanish Origin",
			"Middle Eastern",
			"Native American or Alaskan Native",
			"African American",
			"Prefer Not to Answer",
		]),
		currentSchoolOrganization: faker.helpers.arrayElement([
			"University of Ottawa",
			"Carleton University",
			"University of Waterloo",
			"McGill University",
			"University of Toronto",
		]),
		educationLevel: faker.helpers.arrayElement([
			"High School (Grades 11/12)",
			"Undergraduate",
			"Graduate (Masters, Professional, Doctoral, etc.)",
			"College",
		]),
		major: faker.helpers.arrayElement([
			"Computer Science",
			"Software Engineering",
			"Electrical Engineering",
			"Data Science",
			"Information Technology",
		]),
		linkedin: faker.internet.url(),
		github: faker.internet.url(),
		personalWebsite: faker.internet.url(),
		hackathonBefore: faker.datatype.boolean(),
		hackathonDetails: faker.helpers.arrayElement([
			"Participated in Hack the North 2020",
			"Won the best project award at Local Hack Day",
		]),
		programmingLanguagesTechnologies: "JavaScript, Python, HTML, CSS",
		projectDescription: "Developed a full-stack web application for managing event registrations.",
		participationReason: "To learn more about AI and machine learning.",
		learningGoals: "To improve my skills in backend development.",
		tShirtSize: faker.helpers.arrayElement(Object.values(TShirtSize)),
		travelOrigin: faker.helpers.arrayElement([null, "Ottawa", "Toronto", "Vancouver"]),
		travelAccommodations: faker.helpers.arrayElement(Object.values(TravelAccommodations)),
		referralSource: faker.helpers.arrayElement([
			"Student Organizations or Clubs",
			"Friends or Classmates",
			"University Website",
			"LinkedIn",
			"Instagram",
			"TikTok",
			"Facebook",
			"University Email",
			"Class Announcements",
			"Hackathon Websites (e.g. MLH)",
			"Flyers or Posters on Campus",
			"Professors or Academic Advisors",
			"Career Services",
			"Online Forums or Groups (e.g. Reddit, Discord)",
			"Alumni Networks",
			"Mentors or Coaches",
		]),
		hthAgreements: faker.datatype.boolean(),
		hthPromotions: faker.datatype.boolean(),
		mlhCodeOfConduct: faker.datatype.boolean(),
		mlhPrivacyTerms: faker.datatype.boolean(),
		mlhPromotions: faker.datatype.boolean(),
		hasResume: faker.datatype.boolean(),
		confirmed: faker.datatype.boolean(),
		unsubscribed: faker.datatype.boolean(),
		walkIn: faker.datatype.boolean(),
		winner: faker.datatype.boolean(),
	};
};

/**
 * generates an array of hackers
 * @param n number of hackers to generate
 * @returns [] array of hackers
 */
function generateHackers(n = 10) {
	const hackers = [];
	for (let i = 0; i < n; i++) {
		hackers.push(generateHackerData());
	}
	return hackers;
}

export { generateHackerData, generateHackers };
