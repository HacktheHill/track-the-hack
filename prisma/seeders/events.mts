import { EventType } from "@prisma/client";

const day1 = "2025-09-27";

const events = [
	{
		start: new Date(`${day1} 9:00`),
		end: new Date(`${day1} 11:00`),
		name: "Check In",
		nameFr: "Enregistrement",
		type: EventType.ALL,
		description: "Get ready to kick off the event with ease!",
		descriptionFr: "Préparez-vous à démarrer l'événement en toute simplicité!",
		room: "Room 1",
	},
	{
		start: new Date(`${day1} 11:00`),
		end: new Date(`${day1} 12:00`),
		name: "Opening Ceremony",
		nameFr: "Cérémonie d'ouverture",
		type: EventType.ALL,
		description: "Welcome to the Hack The Hill III event! We're excited to have you here.",
		descriptionFr: "Bienvenue à l'événement Hack The Hill III! Nous sommes ravis de vous avoir ici.",
		room: "Room 2",
		maxCheckIns: 1,
	},
	{
		start: new Date(`${day1} 12:00`),
		end: new Date(`${day1} 12:30`),
		name: "Lunch",
		nameFr: "Déjeuner",
		type: EventType.FOOD,
		description: "Come enjoy some Lunch",
		descriptionFr: "Venez profiter d'un déjeuner",
		room: "Room 3",
	},
	{
		start: new Date(`${day1} 12:30`),
		end: new Date(`${day1} 14:00`),
		name: "Hardware Workshop",
		nameFr: "Atelier de matériel",
		type: EventType.WORKSHOP,
		description: "Workshop 1",
		descriptionFr: "Atelier 1",
		room: "Room 4",
	},
	{
		start: new Date(`${day1} 12:30`),
		end: new Date(`${day1} 14:00`),
		name: "Resume Workshop",
		nameFr: "Atelier de CV",
		type: EventType.WORKSHOP,
		description: "Workshop 1",
		descriptionFr: "Atelier 1",
		room: "Room 5",
	},
	{
		start: new Date(`${day1} 12:30`),
		end: new Date(`${day1} 14:00`),
		name: "3D Printing",
		nameFr: "Impression 3D",
		type: EventType.WORKSHOP,
		description: "Workshop 3",
		descriptionFr: "Atelier 3",
		room: "Room 6",
	},
	{
		start: new Date(`${day1} 18:00`),
		end: new Date(`${day1} 20:00`),
		name: "Career Fair",
		nameFr: "Salon de l'emploi",
		type: EventType.CAREER_FAIR,
		description:
			"Looking for your next coop or internship? looking to hone your networking skills? you're in luck! we'll be having hiring managers and HR from our wonderful sponsors.",
		descriptionFr:
			"Vous cherchez votre prochain stage ou votre prochain emploi? Vous cherchez à perfectionner vos compétences en matière de réseautage? vous avez de la chance! nous aurons des responsables du recrutement et des ressources humaines de nos merveilleux sponsors.",
		room: "Room 2",
	},
	{
		start: new Date(`${day1} 20:00`),
		end: new Date(`${day1} 21:00`),
		name: "Dinner",
		nameFr: "Dîner",
		type: EventType.FOOD,
		description: "Come enjoy some Dinner",
		descriptionFr: "Venez profiter d'un dîner",
		room: "Room 3",
	},
];

export { events };
