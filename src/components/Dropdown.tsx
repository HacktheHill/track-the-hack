import React, { useState } from "react";
type DropdownProps = {
	name: string;
	options: string[];
	question? : string;
	required? : boolean;
};

const Dropdown = ({ required, options, name, question}: DropdownProps) => {
	const [selectedOption, setSelectedOption] = useState("");

	const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		setSelectedOption(event.target.value);
	};

	return (
		<div className="w-full h-full flex gap-2">
			<label htmlFor={name} className="inline-block w-full bg-dark">
				{question ? question : name}
				<select
					id={name}
					name={name}
					value={selectedOption}
					onChange={handleSelectChange}
					className="p-2 bg-white text-dark inline-block w-full "
					required = {required}
				>
					<option disabled selected className={`hidden`}></option>
					{options.map(option => (
						<option key={option} value={option}>
							{option}
						</option>
					))}
				</select>
			</label>
			<label className={`block w-full ${
					selectedOption === "Other" ? "visible" : "hidden"
				}`}>
			Please specify
			<input
			
				type="text"
				id="Other"
				className={`py-2 block w-full text-dark placeholder-dark bg-white p-4`}
				placeholder="Please specify"
			/>
			</label>
		</div>
	);
};

export default Dropdown;
