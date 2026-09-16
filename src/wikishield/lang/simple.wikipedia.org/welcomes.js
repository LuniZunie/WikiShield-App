const welcomes = {
    "Auto": {
        title: "Auto",
        template: user => { }
    },
    "Default": {
        title: "Default",
        template: "Welcome",
        sign: true
    },

    "Personal": {
        title: "Personal",
        template: "Welcome-personal",
        parameters: (ws, item) => ws.api.username,
        sign: false
    },

    "Graphical": {
        title: "Graphical",
        template: "Welcomeq",
        sign: true
    },

    "COI": {
        title: "COI",
        template: "Welcome-COI",
        sign: true
    },
};

welcomes["Auto"].template = user => {
    return "Default";
};