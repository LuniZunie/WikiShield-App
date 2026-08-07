class Case {
    static Lower = Symbol("lower case");
    static Upper = Symbol("UPPER CASE");
    static Title = Symbol("Title Case");
    static Sentence = Symbol("Sentence case");
    static Camel = Symbol("camelCase");
    static Pascal = Symbol("PascalCase");
    static Snake = Symbol("snake_Case");
    static Split = Symbol("split,case");
}

export class Text {
    static pluralize(word, n, plural) {
        return new Text(word).plural(plural).get(n);
    }

    static Case = Case;

    // convert from case to array of words
    static #fromCase(text, type) {
        const temp = (text => {
            switch (type) {
                case Case.Lower:
                case Case.Upper:
                case Case.Title:
                case Case.Sentence:
                    return text.split(/\s+/);
                case Case.Camel:
                case Case.Pascal:
                    return text.split(/(?=[A-Z])/);
                case Case.Snake:
                    return text.split(/_/g);
                case Case.Split:
                    throw new TypeError("Split case is only used for output, not input");
                default:
                    throw new TypeError("Invalid case type, must be a Case value");
            }
        })(text.toString().trim());

        if (type === Case.Sentence)
            return {
                inSentenceCase: true,
                words: temp.map(word => word.trim()).filter(word => word.length > 0)
            };
        return {
            inSentenceCase: false,
            words: temp.map(word => word.trim().toLowerCase()).filter(word => word.length > 0)
        };
    };

    #inSentenceCase = false;
    #single;
    #plural;
    constructor(text, currentCase = Case.Sentence) {
        const fromCase = Text.#fromCase(text, currentCase);
        this.#inSentenceCase = fromCase.inSentenceCase;
        this.#single = fromCase.words;

        this.#plural = this.#getPlural();
    };

    #getPlural(plural) {
        if (plural ?? true === true) {
            const temp = [ ...this.#single ];

            const end = temp.length - 1;
            temp[end] = (single => {
                switch (single.toLowerCase()) {
                    // en
                    case "child": return `${single}ren`;
                    case "oxe": return `${single}n`;

                    default: {
                        let temp;

                        // s, sh, ch, x, z, consonant + o -> -es
                        temp = single.replace(/(?<=sh?|ch|x|z|[^aeiou]o)$/i, "es");
                        if (temp !== single) return temp;

                        // consonant + y -> -ies
                        temp = single.replace(/(?<=[^aeiou])y$/i, "ies");
                        if (temp !== single) return temp;

                        // f, fe -> -ves
                        temp = single.replace(/fe?$/i, "ves");
                        if (temp !== single) return temp;

                        return `${single}s`;
                    }
                }
            })(this.#single[end]);

            return temp;
        } else if (plural === false)
            return [ ...this.#single ];
        else if (plural instanceof Text)
            return plural.case(Case.Split).get();
        else
            throw new TypeError("Invalid plural argument, must be boolean or Text instance");
    };
    plural() {
        this.#plural = this.#getPlural(...arguments);
        return this;
    }

    case(type = Case.Sentence) {
        const format = text => {
            switch (type) {
                case Case.Lower:
                    return text.map(word => word.toLowerCase()).join(" ");
                case Case.Upper:
                    return text.map(word => word.toUpperCase()).join(" ");
                case Case.Title:
                    return text.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
                case Case.Sentence:
                    if (this.#inSentenceCase)
                        return text.join(" ");

                    let punctuation = true;
                    return text.map(word => {
                        let rtn = punctuation ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase();
                        punctuation = /[.!?]$/.test(word);
                        return rtn;
                    }).join(" ");
                case Case.Camel:
                    return text.map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
                case Case.Pascal:
                    return text.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
                case Case.Snake:
                    return text.map(word => word.toLowerCase()).join("_");
                case Case.Split:
                    return text;
                default:
                    throw new TypeError("Invalid case type, must be a Case value");
            }
        };

        const [ single, plural ] = [ format(this.#single), format(this.#plural) ];
        return Object.freeze({
            get(n = 1) {
                const text = Number.isNaN(Number(n)) || n === 1 || n === 1n || n === "1" ? single : plural;
                return text.replace(/(?<!\\)%n/g, n);
            }
        });
    };

    get(n = 1) {
        return this.case().get(n);
    }
};