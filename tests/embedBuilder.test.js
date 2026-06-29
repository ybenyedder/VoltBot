// Smoke tests for core/utils/embedBuilder.js
// Verifies every public helper returns an EmbedBuilder with a footer and color.

// describe/it/expect come from vitest globals (see vitest.config.js)
const { EmbedBuilder } = require("discord.js");
const eb = require("../core/utils/embedBuilder");

// Minimal client stub — embedBuilder only uses client?.user?.username and
// client?.user?.displayAvatarURL(). No Discord network involved.
const client = {
  user: {
    username: "TestBot",
    displayAvatarURL: () => "https://cdn.example.test/avatar.png",
  },
};

const assertEmbed = (embed) => {
  expect(embed).toBeInstanceOf(EmbedBuilder);
  const json = embed.toJSON();
  expect(json.footer).toBeTruthy();
  expect(json.footer.text).toBe("TestBot");
  expect(typeof json.color).toBe("number"); // discord.js normalizes hex -> int
};

describe("embedBuilder — status helpers", () => {
  it("success/info/warning/error all return a valid EmbedBuilder", () => {
    for (const fn of ["success", "info", "warning", "error"]) {
      const embed = eb[fn](client, `hello from ${fn}`);
      assertEmbed(embed);
      expect(embed.toJSON().description).toContain(fn);
    }
  });
});

describe("embedBuilder — premium / base", () => {
  it("premium() includes title author + description", () => {
    const embed = eb.premium(client, "Title", "Body");
    assertEmbed(embed);
    expect(embed.toJSON().author.name).toBe("Title");
    expect(embed.toJSON().description).toBe("Body");
  });

  it("base() works with no title/description", () => {
    const embed = eb.base(client);
    assertEmbed(embed);
  });
});

describe("embedBuilder — modLog", () => {
  it("modLog returns a valid embed with target/moderator fields", () => {
    const embed = eb.modLog(
      client,
      "Ban",
      { id: "111", displayAvatarURL: () => "https://x/y" },
      { id: "222" },
      "rule violation",
    );
    assertEmbed(embed);
    const fields = embed.toJSON().fields;
    expect(fields.find((f) => f.name === "Cible").value).toBe("<@111>");
    expect(fields.find((f) => f.name === "Modérateur").value).toBe("<@222>");
  });
});
