export const welcomes = {
    "Auto": {
        title: "Auto",
        template: (user) => { }
    },
    "Default": {
        title: "Default",
        template: "Welcome",
        sign: true
    },

    "Basic": {
        title: "Basic",
        template: "W-basic",
        sign: false
    },
    "Non-Latin": {
        title: "Non-Latin",
        template: "Welcome-non-latin",
        sign: true
    },

    "Vandalism fighter": {
        title: "Vandalism fighter",
        template: "Welcome-vandalism fighter",
        sign: false
    },

    "Personal": {
        title: "Personal",
        template: "Welcome-personal",
        sign: true
    },
    "Cookie": {
        title: "Cookie",
        template: "Welcome cookie",
        sign: true
    },
    "Kitten": {
        title: "Kitten",
        template: "Welcome kitten",
        sign: false
    },

    "Graphical": {
        title: "Graphical",
        template: "W-graphical",
        sign: false
    },
    "Screen": {
        title: "Screen",
        template: "W-screen",
        sign: false
    },

    "Autobiography": {
        title: "Autobiography",
        template: "Welcome-auto",
        sign: true
    },
    "COI": {
        title: "COI",
        template: "Welcome-COI",
        sign: true
    },
};

welcomes["Auto"].template = user => {
    if (!welcomes["Non-Latin"].hide && /[^\u0000-\u007F]/.test(user.name)) {
        return "Non-Latin";
    }

    return "Default";
};