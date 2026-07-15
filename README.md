# Track the Hack

Track the Hack is a comprehensive event management solution designed to streamline hackathon organization. This software is developed by and for [Hack the Hill](https://hackthehill.com), Ottawa's largest hackathon.

## Getting Started

1. Clone this repository and navigate to the project directory.
2. Install the required dependencies by running `npm install`.
3. Copy the `.env.example` file to create a `.env` file and configure the database and environment settings as per the provided guidelines.
4. Start the development server using `npm run dev`.
5. Access the application through your web browser at `http://localhost:3000`.

## Self-host the database

1. Install [Docker](https://docs.docker.com/get-docker/).
2. Run `docker compose up -d` to start the database.
3. Run `npx prisma db push` to push the database schema and create the tables.
4. Run `npx prisma db seed` to seed the database.

## Azure Container Apps deployment

The `container.yml` workflow deploys only from `main` through the `Production`
environment. Configure the environment variables `AZURE_RESOURCE_GROUP`,
`AZURE_ACR_LOGIN_SERVER`, `AWS_REGION`, and `SES_CONFIGURATION_SET` in that
GitHub environment. The workflow runs the migration job first, waits for a
successful execution, and only then promotes the web image. AWS/SES settings
are required at runtime because the server validates them during startup.

## Contributing

We appreciate your interest, but please note that we currently do not accept external contributions.

If you're part of the Hack the Hill team, refer to our [Contribution guidelines](https://github.com/HacktheHill/.github/blob/main/CONTRIBUTING.md).

## Contact

For inquiries, please contact us at [development@ctn-rtc.org](mailto:development@ctn-rtc.org).

Copyright © 2023 Hack the Hill. All Rights Reserved.
