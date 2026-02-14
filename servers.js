const __servers__ = [
    {
        name: "English",

        host: "en.wikipedia.org",
        language_code: "en",

        tag: true,
        pending_changes: true
    },
    { name: "seperator" },
    {
        name: "Test",

        host: "test2.wikipedia.org",
        language_code: "en",

        tag: false,
        pending_changes: true
    }
];

module.exports = __servers__;