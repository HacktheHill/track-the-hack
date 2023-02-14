import { type Prisma } from "@prisma/client";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import React, { useMemo } from "react";
import { trpc } from "../utils/api";

type Hacker = Prisma.HackerInfoGetPayload<true>;

const Table = () => {
	const [sorting, setSorting] = React.useState<SortingState>([]);

	const columns = useMemo<ColumnDef<Hacker>[]>(
		() => [
			{
				header: "Name",
				footer: props => props.column.id,
				columns: [
					{
						id: "firstName",
						accessorKey: "firstName",
						cell: info => info.getValue() as React.ReactNode,
						header: () => "First Name",
						footer: props => props.column.id,
					},
					{
						id: "lastName",
						accessorKey: "lastName",
						cell: info => info.getValue() as React.ReactNode,
						header: () => "Last Name",
						footer: props => props.column.id,
					},
				],
			},
			{
				header: "Info",
				footer: props => props.column.id,
				columns: [
					{
						id: "school",
						accessorKey: "school",
						cell: info => info.getValue() as React.ReactNode,
						header: () => "School",
						footer: props => props.column.id,
					},
					{
						id: "email",
						accessorKey: "email",
						cell: info => info.getValue() as React.ReactNode,
						header: () => "Email",
						footer: props => props.column.id,
					},
				],
			},
		],
		[],
	);

	const data = trpc.hackers.all.useQuery().data ?? [];

	const table = useReactTable({
		data,
		columns,
		enableColumnResizing: true,
		columnResizeMode: "onChange",
		getCoreRowModel: getCoreRowModel(),
		state: {
			sorting,
		},
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
	});

	return (
		<div className="block max-w-full overflow-y-hidden overflow-x-scroll p-2">
			<div className="h-2" />
			<table className="w-full border border-gray-300">
				<thead className="bg-gray-100">
					{table.getHeaderGroups().map(headerGroup => (
						<tr key={headerGroup.id}>
							{headerGroup.headers.map(header => {
								return (
									<th
										className="border-b border-r border-gray-300 px-2 py-4"
										key={header.id}
										colSpan={header.colSpan}
										style={{ position: "relative", width: header.getSize() }}
									>
										{header.isPlaceholder ? null : (
											<div
												{...{
													className: header.column.getCanSort()
														? "cursor-pointer select-none"
														: "",
													onClick: header.column.getToggleSortingHandler(),
												}}
											>
												{flexRender(header.column.columnDef.header, header.getContext())}
												{{
													asc: "▲",
													desc: "▼",
												}[header.column.getIsSorted() as string] ?? null}
											</div>
										)}
										{header.column.getCanResize() && (
											<div
												onMouseDown={header.getResizeHandler()}
												onTouchStart={header.getResizeHandler()}
												className={`absolute top-0 right-0 bottom-0 h-full w-2 cursor-col-resize touch-none select-none bg-gray-700 opacity-0 transition-opacity hover:opacity-100 ${
													header.column.getIsResizing() ? "bg-blue-700 opacity-100" : ""
												}`}
											></div>
										)}
									</th>
								);
							})}
						</tr>
					))}
				</thead>
				<tbody className="border border-gray-300">
					{table.getRowModel().rows.map(row => {
						return (
							<tr key={row.id}>
								{row.getVisibleCells().map(cell => {
									return (
										<td
											key={cell.id}
											style={{ width: cell.column.getSize() }}
											className={`border-r px-2 py-1 ${
												row.index % 2 === 0 ? "bg-gray-100" : "bg-white"
											}`}
										>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</td>
									);
								})}
							</tr>
						);
					})}
				</tbody>
			</table>
			<div className="h-4" />
		</div>
	);
};

export default Table;
