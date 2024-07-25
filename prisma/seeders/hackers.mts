import { faker } from "@faker-js/faker";
import {
	Locale,
	TShirtSize,
	Gender,
	Pronouns,
	RaceEthnicity,
	EducationLevel,
	DietaryRestrictions,
	TravelAccommodations,
	ReferralSource,
} from "@prisma/client";

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
		dietaryRestrictions: faker.helpers.arrayElement(Object.values(DietaryRestrictions)),
		specialAccommodations: faker.helpers.arrayElement([null, "Wheelchair access", "Sign language interpreter"]),
		emergencyContactName,
		emergencyContactRelation: emergencyContactRelationship,
		emergencyContactPhoneNumber,
		gender: faker.helpers.arrayElement(Object.values(Gender)),
		pronouns: faker.helpers.arrayElement(Object.values(Pronouns)),
		raceEthnicity: faker.helpers.arrayElement(Object.values(RaceEthnicity)),
		currentSchoolOrganization: faker.helpers.arrayElement([
			"University of Ottawa",
			"Carleton University",
			"University of Waterloo",
			"McGill University",
			"University of Toronto",
		]),
		educationLevel: faker.helpers.arrayElement(Object.values(EducationLevel)),
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
			null,
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
		referralSource: faker.helpers.arrayElements(Object.values(ReferralSource), 2),
		referralOther: faker.helpers.arrayElement([null, "Through a friend"]),
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

export { generateHackers, generateHackerData };
