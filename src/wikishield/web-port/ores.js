export class ORES {
    static extract(data, bias = 0.5) {
        const models = [ {
            key: "goodfaith",
            field: "false",
            bias: bias
        }, {
            key: "damaging",
            field: "true",
            bias: 1 - bias
        } ];

        const result = { };
        for (const [ revid, scores ] of Object.entries(data)) {
            const values = [ ];
            for (const model of models) {
                const score = scores[model.key];
                if (!score) continue;

                let value = score.probability?.[model.field] ?? score[model.field];
                if (value === undefined && score.prediction !== undefined)
                    value = +score.prediction;

                if (value !== undefined && !isNaN(value))
                    values.push(value * (model.bias || 0));
            }

            result[revid] = values.length === 0 ? NaN : values.reduce((a, b) => a + b, 0) / values.length;
        }

        return result;
    }
}