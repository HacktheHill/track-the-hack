type DatabaseTable = {
	create(input: { data: object }): Promise<unknown>;
};

export const insertRecords = async (table: DatabaseTable, rows: object[]) => {
	await Promise.all(rows.map(data => table.create({ data })));
};
