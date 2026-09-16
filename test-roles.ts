import { hasRoles } from "./src/utils/helpers";
import { RoleName } from "@prisma/client";

const user = {
    roles: [RoleName.ADMIN]
};

console.log(hasRoles(user as any, [RoleName.ADMIN]));
