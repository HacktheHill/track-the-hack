async function insertRecords(db: any, rows: object[]) {
	try {
		rows.forEach(row =>
			db.create({
				data: row,
			}),
		);
	} catch (error) {
		console.log(error);
	}
}

export { insertRecords };
