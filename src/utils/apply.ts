export type ProcessedEntryValue = string | boolean | number | Date | File | undefined;

export const processValue = (key: string, value: string): ProcessedEntryValue => {
	if (value === "") {
		return undefined;
	} else if (value === "true") {
		return true;
	} else if (value === "false") {
		return false;
	} else if (key === "age") {
		return parseInt(value);
	} else {
		return value;
	}
};

export const processFormData = (formData: FormData) => {
	const processedEntries: [string, ProcessedEntryValue][] = [];

	formData.forEach((value, key) => {
		if (key.endsWith("-other")) {
			const baseKey = key.replace("-other", "");
			const baseValue = formData.get(baseKey);
			if (baseValue === "other") {
				processedEntries.push([baseKey, value]);
			}
		} else if (key.endsWith("[]")) {
			const allValues = formData.getAll(key);
			const otherKey = `${key.replace("[]", "")}-other`;
			const otherValue = formData.get(otherKey);
			if (allValues.includes("other") && otherValue) {
				allValues.push(otherValue);
			}
			const values = allValues.filter(v => v !== "other").join(", ");
			processedEntries.push([key.replace("[]", ""), values]);
		} else if (value instanceof File) {
			processedEntries.push([key, value]);
		} else {
			const processedValue = processValue(key, value);
			if (processedValue !== undefined) {
				processedEntries.push([key, processedValue]);
			}
		}
		console.log(processedEntries);
	});

	return Object.fromEntries(processedEntries);
};

export const saveToLocalStorage = (formData: FormData) => {
	const data: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};

	formData.forEach((value, key) => {
		if (key.endsWith("[]")) {
			if (!data[key]) {
				data[key] = [];
			}
			(data[key] as FormDataEntryValue[]).push(value);
		} else {
			data[key] = value;
		}
	});

	localStorage.setItem("applyFormData", JSON.stringify(data));
	console.log(data);
};
