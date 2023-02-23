import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Role } from "@prisma/client";
import type { Roles } from "../utils/common";

import { trpc } from "../utils/api";

const RoleSelect = () => {
	const { data: sessionData } = useSession();
	const [role, setRole] = useState<Roles | null>(null);

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
		setRole(value as Roles);
	};

	return (
		<div>
			<label htmlFor="role">Role</label>
			<select id="role" onChange={handleChange} value={role ?? ""}>
				{Object.values(Role).map(role => (
					<option key={role} value={role}>
						{role}
					</option>
				))}
			</select>
		</div>
	);
};

export default RoleSelect;