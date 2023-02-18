import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { trpc } from "../utils/api";
import type { Role } from "../utils/common";

const RoleSelect = () => {
	const { data: sessionData } = useSession();
	const [role, setRole] = useState<Role | null>(null);

	const mutation = trpc.users.setRole.useMutation();
	const query = trpc.users.getRole.useQuery(
		{
			id: sessionData?.user?.id ?? "",
		},
		{
			enabled: !!sessionData?.user?.id,
		},
	);

	useEffect(() => {
		if (query.data) {
			setRole(query.data);
		}
	}, [query.data]);

	const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const { value } = event.target;
		mutation.mutate({
			id: sessionData?.user?.id ?? "",
			role: value.toUpperCase(),
		});
		setRole(value as Role);
	};

	return (
		<div>
			<label htmlFor="role">Role</label>
			<select id="role" onChange={handleChange} value={role ?? ""}>
				<option value="ORGANIZER">Organizer</option>
				<option value="SPONSOR">Sponsor</option>
				<option value="HACKER">Hacker</option>
			</select>
		</div>
	);
};

export default RoleSelect;
