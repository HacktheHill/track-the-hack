import { faker } from "@faker-js/faker";
import { Role, Language,  } from "@prisma/client";
import { AttendanceType, PrismaClient, ShirtSize } from "@prisma/client";
import csv from "csvtojson";
import * as fs from "fs";
import { z } from "zod";
const prisma = new PrismaClient();


// Generates dummy users
const hackers = async () => {
    const headers = [
		//headers on the csv file
        "fullName", 
		"email",
		"pronouns",	
		"gender",
		"linkedin",	
		"university",	
		"dietaryRestrictions",	
		"accommodations",
	];

    const registrations = csv({
        headers: headers,
        trim: true,
        delimiter: ",",
    });

    void fs.createReadStream("prisma/responses.csv").pipe(registrations);
	const temp = await registrations
	const hackers = temp.map(hacker => {
		const names = hacker.fullName.split(' ');
		const firstName = names[0];
		const lastName = names.slice(1, names.length - 1).join(' ')  == "" ? names[1] ?? "" : names.slice(1, names.length - 1).join(' ') ?? "";
		const hackerInfo =  
			{
				preferredLanguage: "EN",
				email: hacker.email,
				firstName: firstName,
				lastName: lastName,
				gender: hacker.gender,
				phoneNumber: "111-111-1111",
				university: hacker.university,
				attendanceType: "IN_PERSON",
				transportationRequired: false,
				dietaryRestrictions: hacker.dietaryRestrictions,
				accessibilityRequirements: hacker.accommodations,
				emergencyContactName: "John Doe",
				emergencyContactRelationship: "Friend",
				emergencyContactPhoneNumber: "111-111-1111",
				confirmed: true,
				unsubscribed: false,
				onlyOnline: false,
				walkIn: false,
				winner: false,
			};

			return hackerInfo;
	});


	return hackers;
};

export {hackers}