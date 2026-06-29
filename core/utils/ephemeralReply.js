module.exports = {
  sendEphemeralReply: async (message, replyOptions, timeout = 5000) => {
    const m = await message.reply(replyOptions).catch(() => null);
    if (!m) return null;
    setTimeout(() => m.delete().catch(() => {}), timeout);
    return m;
  },
};
