import dotenv from "dotenv";
dotenv.config();

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  IntentsBitField,
} from "discord.js";
import { decryptText, encryptText } from "./encrypt";
import { registerSlashCommands } from "./register-commands";

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

client.on("guildCreate", async (guild) => {
  console.log(`🆕 VoteBot#${client.user?.id} joined #${guild.id}.`);
  await registerSlashCommands(guild.id);
  console.log(`✅ Created slash command for server #${guild.id}`);
});

client.on("ready", (c) => {
  console.log(`✅ VoteBot#${c.user.id} is now online.`);
});

const confirmCreateButton = new ButtonBuilder()
  .setLabel("Confirm")
  .setStyle(ButtonStyle.Primary)
  .setCustomId("confirm-create-vote-button");

const createVoteButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
  confirmCreateButton
);

type VOTEDATA = {
  eventName: string;
  options: string[];
  userVoted: string[];
  userWhoCreateIt: string;
  encryptedStatics: string;
  decrypted: boolean;
};

type DECRYPTED_STATICS = {
  [key: string]: number;
};

const STATICS_PASSWORD = process.env.STATICS_PASSWORD as string;

const toFormattedOptions = (options: string[], statics?: DECRYPTED_STATICS) => {
  return options
    .map(
      (option, index) =>
        `${index + 1}. ${option}${
          statics ? `: got ${statics[index.toString()] || 0} votes` : ""
        }`
    )
    .join("\n");
};

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "create-vote") {
      const eventName = interaction.options.getString("event-name");
      const options = interaction.options.getString("options");

      if (!eventName || !options || !options.includes(",")) {
        await interaction.reply(
          "❌ You must provide an event name and at least two options separated by commas!"
        );
        return;
      }

      const data: VOTEDATA = {
        eventName,
        options: options.split(","),
        userVoted: [],
        userWhoCreateIt: interaction.user.id,
        encryptedStatics: encryptText("{}", STATICS_PASSWORD),
        decrypted: false,
      };

      await interaction.reply({
        content: `You are creating a new vote event called **${eventName}**; options are:\n${toFormattedOptions(
          data.options
        )}\n\nServer usage (you may ignore it):\n${JSON.stringify(data)}`,
        components: [createVoteButtonRow],
      });
    }
  }

  if (interaction.isButton()) {
    const messageContent = interaction.message.content;
    const lines = messageContent.split("\n");
    const data = JSON.parse(lines[lines.length - 1]) as VOTEDATA;

    if (interaction.customId === "confirm-create-vote-button") {
      if (interaction.user.id !== data.userWhoCreateIt) return;

      const optionsButton = data.options.map((_, index) =>
        new ButtonBuilder()
          .setLabel((index + 1).toString())
          .setStyle(ButtonStyle.Primary)
          .setCustomId(`vote-for-${index}`)
      );

      const decryptButton = new ButtonBuilder()
        .setLabel("Decrypt (開票)")
        .setStyle(ButtonStyle.Danger)
        .setCustomId("decrypt-vote");

      const voteButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...optionsButton,
        decryptButton
      );

      await interaction.message.delete();

      await interaction.reply({
        content: `**${
          data.eventName
        }**\n@everyone You are welcome to vote! Statistics are encrypted.\n${toFormattedOptions(
          data.options
        )}\n${
          data.userVoted.length
        } voted!\n\nServer usage (you may ignore it):\n${JSON.stringify(data)}`,
        components: [voteButtonRow],
      });
    }

    if (interaction.customId.startsWith("vote-for-")) {
      if (data.userVoted.includes(interaction.user.id)) {
        await interaction.reply(
          `<@${interaction.user.id}> You have already voted!`
        );
        return;
      }

      const voteFor = interaction.customId.replace("vote-for-", "");
      const decryptedStatics = JSON.parse(
        decryptText(data.encryptedStatics, STATICS_PASSWORD)
      ) as DECRYPTED_STATICS;

      decryptedStatics[voteFor] = (decryptedStatics[voteFor] || 0) + 1;

      const updatedData: VOTEDATA = {
        ...data,
        userVoted: [...data.userVoted, interaction.user.id],
        encryptedStatics: encryptText(
          JSON.stringify(decryptedStatics),
          STATICS_PASSWORD
        ),
      };

      await interaction.message.edit({
        content: `**${
          updatedData.eventName
        }**\nYou are welcome to vote! Statistics are encrypted.\n${toFormattedOptions(
          updatedData.options
        )}\n${
          updatedData.userVoted.length
        } voted!\n\nServer usage (you may ignore it):\n${JSON.stringify(
          updatedData
        )}`,
      });

      await interaction.reply(
        `<@${interaction.user.id}> You have successfully voted for **${updatedData.eventName}**!`
      );
    }

    if (interaction.customId === "decrypt-vote") {
      if (interaction.user.id !== data.userWhoCreateIt) {
        await interaction.reply(
          `<@${interaction.user.id}> Only the event creator can decrypt the results!`
        );
        return;
      }

      if (data.decrypted) {
        await interaction.reply(
          `<@${interaction.user.id}> The results are already decrypted!`
        );
        return;
      }

      const decryptedStatics = JSON.parse(
        decryptText(data.encryptedStatics, STATICS_PASSWORD)
      ) as DECRYPTED_STATICS;

      await interaction.message.delete();
      await interaction.reply(
        `The results for **${data.eventName}** are:\n${toFormattedOptions(
          data.options,
          decryptedStatics
        )}`
      );
    }
  }
});

client.login(process.env.DISCORD_TOKEN as string);
