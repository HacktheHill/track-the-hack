import { z } from "zod";

export const roles = z.enum(["HACKER", "SPONSOR", "ORGANIZER"]);
export type Role = z.infer<typeof roles>;
