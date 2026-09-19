import { EventType, ScannerWorkflow } from "@prisma/client";

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

const at = (hours: number, minutes = 0) => {
	const date = new Date(tomorrow);
	date.setHours(hours, minutes, 0, 0);
	return date;
};

const events = [
	{
		id: "dev-event-check-in",
		start: at(9),
		end: at(11),
		name: "Check In",
		nameFr: "Enregistrement",
		type: EventType.ALL,
		scannerWorkflow: ScannerWorkflow.CHECK_IN,
		description: "Get ready to kick off the event with ease!",
		descriptionFr: "Préparez-vous à démarrer l'événement en toute simplicité!",
		room: "Room 1",
		maxCheckIns: 1,
	},
	{
		id: "dev-event-merchandise",
		start: at(9),
		end: at(11),
		name: "Merchandise Pickup",
		nameFr: "Ramassage de marchandise",
		type: EventType.ALL,
		scannerWorkflow: ScannerWorkflow.MERCHANDISE,
		description: "Pick up event merchandise.",
		descriptionFr: "Ramassez la marchandise de l’événement.",
		room: "Room 1",
		maxCheckIns: 1,
	},
	{
		id: "dev-event-opening",
		start: at(11),
		end: at(12),
		name: "Opening Ceremony",
		nameFr: "Cérémonie d'ouverture",
		type: EventType.ALL,
		scannerWorkflow: ScannerWorkflow.ATTENDANCE,
		description: "Welcome to the Hack the Hill III event! We're excited to have you here.",
		descriptionFr: "Bienvenue à l'événement Hack the Hill III! Nous sommes ravis de vous avoir ici.",
		room: "Room 2",
		maxCheckIns: 1,
	},
	{
		id: "dev-event-lunch",
		start: at(12),
		end: at(12, 30),
		name: "Lunch",
		nameFr: "Déjeuner",
		type: EventType.FOOD,
		scannerWorkflow: ScannerWorkflow.FOOD,
		description: "Come enjoy some Lunch",
		descriptionFr: "Venez profiter d'un déjeuner",
		room: "Room 3",
	},
	{
		id: "dev-event-hardware-workshop",
		start: at(12, 30),
		end: at(14),
		name: "Hardware Workshop",
		nameFr: "Atelier de matériel",
		type: EventType.WORKSHOP,
		scannerWorkflow: ScannerWorkflow.ATTENDANCE,
		description: "Workshop 1",
		descriptionFr: "Atelier 1",
		room: "Room 4",
	},
	{
		id: "dev-event-resume-workshop",
		start: at(12, 30),
		end: at(14),
		name: "Resume Workshop",
		nameFr: "Atelier de CV",
		type: EventType.WORKSHOP,
		scannerWorkflow: ScannerWorkflow.ATTENDANCE,
		description: "Workshop 1",
		descriptionFr: "Atelier 1",
		room: "Room 5",
	},
	{
		id: "dev-event-3d-printing",
		start: at(12, 30),
		end: at(14),
		name: "3D Printing",
		nameFr: "Impression 3D",
		type: EventType.WORKSHOP,
		scannerWorkflow: ScannerWorkflow.ATTENDANCE,
		description: "Workshop 3",
		descriptionFr: "Atelier 3",
		room: "Room 6",
	},
	{
		id: "dev-event-career-fair",
		start: at(18),
		end: at(20),
		name: "Career Fair",
		nameFr: "Salon de l'emploi",
		type: EventType.CAREER_FAIR,
		scannerWorkflow: ScannerWorkflow.ATTENDANCE,
		description:
			"Looking for your next coop or internship? looking to hone your networking skills? you're in luck! we'll be having hiring managers and HR from our wonderful sponsors.",
		descriptionFr:
			"Vous cherchez votre prochain stage ou votre prochain emploi? Vous cherchez à perfectionner vos compétences en matière de réseautage? vous avez de la chance! nous aurons des responsables du recrutement et des ressources humaines de nos merveilleux sponsors.",
		room: "Room 2",
	},
	{
		id: "dev-event-dinner",
		start: at(20),
		end: at(21),
		name: "Dinner",
		nameFr: "Dîner",
		type: EventType.FOOD,
		scannerWorkflow: ScannerWorkflow.FOOD,
		description: "Come enjoy some Dinner",
		descriptionFr: "Venez profiter d'un dîner",
		room: "Room 3",
	},
];

export { events };
