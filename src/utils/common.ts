import { z } from "zod";
import { Role } from "@prisma/client";

export const roles = z.enum([Role.HACKER, Role.SPONSOR, Role.ORGANIZER]);
export type Roles = z.infer<typeof roles>;
