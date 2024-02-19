import dotenv from "dotenv";
dotenv.config();

import { ApplicationCommandOptionType, REST, Routes } from "discord.js";

const commands = [
  {
    name: "create-vote",
    description: "Create a new vote event!",
    options: [
      {
        name: "event-name",
        description: "vote1",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "options",
        description: "Option1,Option2,Option3... Re:Never include a dash(-)!",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_TOKEN as string
);

export async function registerSlashCommands(guild_id: string) {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID as string,
        guild_id
      ),
      {
        body: commands,
      }
    );
  } catch (e) {
    console.log(`There was an error: ${e}`);
  }
}
