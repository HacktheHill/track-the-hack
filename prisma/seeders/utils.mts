// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
