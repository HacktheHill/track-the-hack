import { EventType } from "@prisma/client";

const day1 = "2024-02-3";
import { faker } from "@faker-js/faker";
import { Role, Language,  } from "@prisma/client";
import { AttendanceType, PrismaClient, ShirtSize } from "@prisma/client";
import csv from "csvtojson";
import { create } from "domain";
import * as fs from "fs";
import { z } from "zod";
const prisma = new PrismaClient();


// const events = [
// 	{
// 		start: new Date(`${day1} 9:00`),
// 		end: new Date(`${day1} 11:00`),
// 		name: "Check In + Merch Distribution",
// 		type: EventType.ALL,
// 		description:
// 			"Get ready to kick off the event with ease! Swing by our Check-In and Merchandise Distribution station to collect exclusive event merchandise! Our team is ready and waiting to greet you with a smile and help you get the most out of your experience.",
// 		room: "Room 1",
// 	},
// 	{
// 		start: new Date(`${day1} 11:00`),
// 		end: new Date(`${day1} 12:00`),
// 		name: "Opening Ceremony",
// 		type: EventType.ALL,
// 		description:
// 			"Join us for the opening ceremony of Hack the Hill 2023! We will be welcoming our sponsors and announcing the challenges and much more, you won’t want to miss the start of the event!",
// 		room: "Room 2",
// 	},
// 	{
// 		start: new Date(`${day1} 12:00`),
// 		end: new Date(`${day1} 12:30`),
// 		name: "Launch",
// 		type: EventType.FOOD,
// 		description: "Come enjoy some launch",
// 		room: "Room 3",
// 	},
// 	{
// 		start: new Date(`${day1} 12:30`),
// 		end: new Date(`${day1} 14:00`),
// 		name: "Hardware Workshop",
// 		type: EventType.WORKSHOP,
// 		description: "Workshop 1",
// 		room: "Room 4",
// 	},
// 	{
// 		start: new Date(`${day1} 12:30`),
// 		end: new Date(`${day1} 14:00`),
// 		name: "Resume Workshop",
// 		type: EventType.WORKSHOP,
// 		description: "Workshop 1",
// 		room: "Room 5",
// 	},
// 	{
// 		start: new Date(`${day1} 12:30`),
// 		end: new Date(`${day1} 14:00`),
// 		name: "3D Printing",
// 		type: EventType.WORKSHOP,
// 		description: "Workshop 3",
// 		room: "Room 6",
// 	},
// 	{
// 		start: new Date(`${day1} 18:00`),
// 		end: new Date(`${day1} 20:00`),
// 		name: "Career Fair",
// 		type: EventType.CAREER_FAIR,
// 		description:
// 			"Looking for your next coop or internship? looking to hone your networking skills? you're in luck! we'll be having hiring managers and HR from our wonderful sponsors (Ciena, Canadian Tire, Blackberry, and CSE CST).",
// 		room: "Room 2",
// 	},
// 	{
// 		start: new Date(`${day1} 20:00`),
// 		end: new Date(`${day1} 21:00`),
// 		name: "Dinner",
// 		type: EventType.FOOD,
// 		description: "Come enjoy some Lunch",
// 		room: "Room 3",
// 	},
// ];

const events = async () => {
	const headers = [
		//headers on the csv file
        "start", 
		"end",
		"name",	
		"type",
		"description",	
		"room",	
		"image",	
	];

    const registrations = csv({
        headers: headers,
        trim: true,
        delimiter: ",",
    });

    void fs.createReadStream("prisma/events.csv").pipe(registrations);
	const temp = await registrations
	const events = temp.map(event => {
		const eventInfo =  
			{
				start: new Date(`${day1} ${event.start}`),
				end: new Date(`${day1} ${event.end}`),
				name: event.name,
				type: event.type,
				description: event.description,
				room: event.room,
				image: event.image,
			};
			return eventInfo;
		});

		return events;
}

export { events };
