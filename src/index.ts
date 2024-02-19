import dotenv from "dotenv";
dotenv.config();

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ComponentType,
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

client.on("guildCreate", async (c) => {
  console.log(`🆕 VoteBot#${c.client.user.id} jumped into #${c.id}.`);

  await registerSlashCommands(c.id);
  console.log(`✅ Created slash command for server #${c.id}`);
});

client.on("ready", (c) => {
  console.log(`✅ VoteBot#${c.user.id} is now online.`);
});

const confirmCreateButton = new ButtonBuilder()
  .setLabel("Confirm")
  .setStyle(ButtonStyle.Primary)
  .setCustomId("confirm-create-vote-button");

const createVoteButtonRow = new ActionRowBuilder().addComponents(
  confirmCreateButton
);

// typo error for statistics and statics!!!

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

// to format options available into numbered list, with statics
const toFormattedOptions = (options: string[], statics?: DECRYPTED_STATICS) => {
  let formattedOptions = "";
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    formattedOptions += `${i + 1}. ${option}${
      !!statics ? `: got ${statics[i.toString()] || 0} votes` : ""
    }\n`;
  }
  return formattedOptions;
};

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    // request to create vote event
    if (interaction.commandName === "create-vote") {
      const rawEventName = interaction.options.get("event-name");
      const rawOptions = interaction.options.get("options");
      if (!rawEventName || !rawOptions) {
        interaction.reply("❌ You have to give me the field required ar!!");
        return;
      }

      const rawStringOfOptions = rawOptions.value?.toString() || "";
      if (
        !rawStringOfOptions.includes(",") ||
        rawStringOfOptions.includes("-")
      ) {
        interaction.reply(
          "❌ You have to give me at least **TWO** options ar!!"
        );
        return;
      }

      const eventName = rawEventName.value?.toString() || "Vote";

      const data: VOTEDATA = {
        eventName,
        options: rawStringOfOptions.split(","),
        userVoted: [],
        userWhoCreateIt: interaction.user.id,
        encryptedStatics: encryptText("{}", STATICS_PASSWORD),
        decrypted: false,
      };

      await interaction.reply({
        content: `hello! You are creating a new vote event called **${eventName}**; options are:
${toFormattedOptions(data.options)}


server usage (you may ignore it):
${JSON.stringify(data)}`,
        // @ts-ignore
        components: [createVoteButtonRow],
      });
    }
  }

  if (interaction.isButton()) {
    // confirm to create the vote event
    if (interaction.customId === "confirm-create-vote-button") {
      const messageContent = interaction.message.content;
      const lines = messageContent.split("\n");
      let data = JSON.parse(lines[lines.length - 1]) as VOTEDATA;

      if (interaction.user.id !== data.userWhoCreateIt) return;

      let optionsButton: ButtonBuilder[] = [];
      for (let i = 0; i < data.options.length; i++) {
        optionsButton.push(
          new ButtonBuilder()
            .setLabel((i + 1).toString())
            .setStyle(ButtonStyle.Primary)
            .setCustomId(`vote-for-${i}`)
        );
      }

      const decryptButton = new ButtonBuilder()
        .setLabel("Decrypt (開票)")
        .setStyle(ButtonStyle.Danger)
        .setCustomId("decrypt-vote");

      const voteButtonRow = new ActionRowBuilder().addComponents(
        ...optionsButton,
        decryptButton
      );

      await interaction.message.delete();

      await interaction.reply({
        content: `**${data.eventName}**
@everyone You all are welcome to vote; however, statistics are encrypted now!
${toFormattedOptions(data.options)}
${data.userVoted.length} voted!

server usage (you may ignore it):
${JSON.stringify(data)}`,
        // @ts-ignore
        components: [voteButtonRow],
      });
    }

    // user vote
    if (interaction.customId.includes("vote-for-")) {
      const messageContent = interaction.message.content;
      const lines = messageContent.split("\n");
      let data = JSON.parse(lines[lines.length - 1]) as VOTEDATA;
      if (data.userVoted.includes(interaction.user.id)) {
        await interaction.reply(
          `<@${interaction.user.id}> You have voted already!`
        );
        return;
      }

      const voteFor = interaction.customId.replace("vote-for-", "");

      let decryptedStatics = JSON.parse(
        decryptText(data.encryptedStatics, STATICS_PASSWORD)
      ) as DECRYPTED_STATICS;

      decryptedStatics = {
        ...decryptedStatics,
        [voteFor]: (decryptedStatics[voteFor] || 0) + 1,
      };

      data = {
        ...data,
        userVoted: [...data.userVoted, interaction.user.id],
        encryptedStatics: encryptText(
          JSON.stringify(decryptedStatics),
          STATICS_PASSWORD
        ),
      };

      await interaction.message.edit(`**${data.eventName}**
You all are welcome to vote; however, statistics are encrypted now!
${toFormattedOptions(data.options)}
${data.userVoted.length} voted!

server usage (you may ignore it):
${JSON.stringify(data)}`);

      await interaction.reply(
        `<@${interaction.user.id}> You have successfully voted for event: **${data.eventName}**!`
      );
    }

    // decrypt the vote event
    if (interaction.customId === "decrypt-vote") {
      const messageContent = interaction.message.content;
      const lines = messageContent.split("\n");
      let data = JSON.parse(lines[lines.length - 1]) as VOTEDATA;

      if (interaction.user.id !== data.userWhoCreateIt) {
        await interaction.reply(
          `<@${interaction.user.id}> Have to ask who create the event to decrypt!!`
        );
        return;
      }

      if (data.decrypted) {
        await interaction.reply(
          `<@${interaction.user.id}> The vote is decrypted!!`
        );
        return;
      }

      await interaction.message.delete();

      await interaction.reply(`So....The result for **${data.eventName}** are
${toFormattedOptions(
  data.options,
  JSON.parse(
    decryptText(data.encryptedStatics, STATICS_PASSWORD)
  ) as DECRYPTED_STATICS
)}
`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN as string);
