async function insertRecords(db: iDatabaseTable, rows: object[]) {
	try {
		rows.map(async row => {
			await db.create({
				data: row,
			});
		});
	} catch (e) {
		console.error(e);
	}
}

export interface iDatabaseTable {
	findMany(fields: object): any;
	findUnique(criteria: object): any;
	update(data: object): any;
	delete(data: object): any;
	create(data: object): any;
}

export { insertRecords };
