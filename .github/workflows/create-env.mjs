#!/usr/bin/env node
import { writeFileSync } from "fs";

console.info("Creating .env file...");

const env = JSON.parse(process.argv[2]);

console.log(process.argv, env);

const envFile = Object.keys(env)
    .map((key) => `${key}=${env[key]}`)
    .join("\n");

writeFileSync(".env", envFile);

console.info(".env file created.");
