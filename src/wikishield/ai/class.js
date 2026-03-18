import { namespaces } from "../data/namespaces.js";
import { fullTrim } from "../../../global/full-trim/script.esm.js";

export class AI {
    static providers = { };
    static registerProvider(name, providerClass) {
        AI.providers[name] = providerClass;
    }

    analysis = {
        "edit": new Map(),
        "username": new Map(),
    };

    cache = {
        "username": new Set(),
    };

    setup(type, item) {
        if (this.analysis[type].has(item.id)) {
            const analysis = this.analysis[type].get(item.id);
            analysis.count++;

            return analysis.request;
        }

        const abortController = new AbortController();
        const request = this.fetch(type, item, abortController.signal);

        this.analysis[type].set(item.id, {
            request,
            abortController,
            count: 1,
        });

        request.finally(() => {
            this.analysis[type].delete(item.id);
        });

        return request;
    }

    async fetch(type, item, abortSignal) {
        return { error: "No service has been selected" };
    }

    constructor(ws, config) {
        this.ws = ws;
        this.settings = ws.store.settings.AI;
        this.config = config;
    }

    async test() {
        return false;
    }

    async models() {
        return [ ];
    }

    analyze = {
        edit: (item) => {
            return this.setup("edit", item);
        },

        username: (item) => {
            if (this.cache["username"].has(item.user.name)) {
                return Promise.resolve({
                    flag: false,
                    confidence: 1,
                    issues: [ ],
                    explanation: "Username previously analyzed.",
                });
            }

            this.cache["username"].add(item.user.name);
            return this.setup("username", item);
        }
    };

    cancel = {
        all: (type = true) => {
            if (type === true) {
                for (const type of Object.keys(this.analysis))
                    for (const id of this.analysis[type]?.keys())
                        this.cancel[type](id);
            } else {
                for (const id of this.analysis[type]?.keys())
                    this.cancel[type](id);
            }
        },

        edit: (id) => {
            const analysis = this.analysis["edit"].get(id);
            if (analysis) {
                analysis.count--;
                if (analysis.count <= 0) {
                    analysis.abortController.abort("Edit analysis canceled by user");
                    this.analysis["edit"].delete(id);
                }
            }
        },
        username: (id) => {
            const analysis = this.analysis["username"].get(id);
            if (analysis) {
                analysis.count--;
                if (analysis.count <= 0) {
                    analysis.abortController.abort("Username analysis canceled by user");
                    this.analysis["username"].delete(id);
                }
            }
        },
    }

    #parseDiff(diffHtml) {
        const container = document.createElement("div");
        container.innerHTML = diffHtml;

        const lines = [];
        for (const row of container.querySelectorAll("tr")) {
            const deleted = row.querySelector(".diff-deletedline");
            const added = row.querySelector(".diff-addedline");
            const context = row.querySelector(".diff-context");

            if (deleted) lines.push(`- ${deleted.textContent.trim()}`);
            if (added) lines.push(`+ ${added.textContent.trim()}`);
            else if (context) lines.push(`  ${context.textContent.trim()}`);
        }

        if (lines.length > 0)
            return lines.join("\n");

        // Fallback: strip HTML tags and return plain text
        return container.textContent?.trim() || "";
    }

    prompt = {
        edit: async (item) => {
            const diffText = this.#parseDiff(item.diff);
            const namespace = namespaces.find(ns => ns.id === item.ns) ?? namespaces[0];

            let userType = "registered";
            if (item.user.temp)
                userType = "temporary (unregistered)";
            else if (item.user.ip)
                userType = "IP (unregistered)";

            const categories = item.page.categories.join(", ") || "(none)";
            const isBLP = item.page.categories.some(c => /living people/i.test(c));

            return fullTrim(`
You are an automated Wikipedia item reviewer. Analyze the following item and determine whether the CHANGES INTRODUCED violate Wikipedia policy.

CRITICAL: You are evaluating what this item CHANGED, not the page content before it. The diff shows removed lines (prefixed "-") and added lines (prefixed "+"). Only ADDED content can be a new violation. Removing bad content is a GOOD item. Adding references, citations, and sources is GOOD — it improves verifiability, not the opposite.

item CONTEXT:
- Page: "${item.page.title}" (${namespace.name} namespace)
- Categories: ${categories}${isBLP ? "\n- ⚠ BLP: This page is about a living person. Unsourced negative claims are a serious concern." : ""}
- User: "${item.user.name}" (${userType}, warning level: ${item.user.warning}/4)
- ORES vandalism probability: ${(item.ores * 100).toFixed(0)}%
- Size change: ${item.sizediff > 0 ? "+" : ""}${item.sizediff} bytes
- Flagged minor: ${item.minor ? "yes" : "no"}
- Summary: ${item.comment || "(empty)"}
- Tags: ${item.tags?.join(", ") || "(none)"}

WHAT TO CHECK:
1. VANDALISM: Does the item add nonsense, profanity as attacks, hoaxes, blanking, or deliberate misinformation? (WP:VANDALISM)
2. NPOV: Does the item add clearly biased or one-sided language that is not presented neutrally? (WP:NPOV)
3. VERIFIABILITY: Does the item add claims that are extraordinary or contentious WITHOUT any sourcing? Note: adding "<ref>" tags, URLs, or citation templates is adding sources — this is the OPPOSITE of a verifiability problem. (WP:V)
4. ORIGINAL RESEARCH: Does the item add novel analysis, synthesis, or unpublished interpretation not attributable to any source? Simply adding text IS NOT original research if it restates commonly known facts or is sourced. Adding citations is NEVER original research. (WP:NOR)
5. BLP: If this is a BLP article, does the item add unsourced or poorly-sourced negative material about the subject? (WP:BLP)

WHAT IS NOT A VIOLATION:
- Adding references, citations, "<ref>" tags, or URLs (this IMPROVES the article)
- Removing vandalism or bad content
- Fixing grammar, spelling, formatting, or wikilinks
- Content about controversial topics written in a neutral, encyclopedic tone
- Wikipedia is NOT censored — explicit content on appropriate pages is allowed (WP:NOTCENSORED)
- Absent or auto-generated item summaries (e.g. "/* Section name */") are normal, not violations
- ORES scores and warning levels are hints — do NOT treat them as evidence by themselves

ASSESSMENT SCALE:
- "Good": No policy issues. Normal constructive item.
- "Review": Minor concerns; a human should glance at it.
- "Suspicious": Likely problematic; warrants close scrutiny.
- "Bad": Clear policy violation.

When in doubt between two ratings, choose the LESS severe one. Most items on Wikipedia are constructive — reflect that in your assessments.

For issues, use short policy codes (e.g. "WP:VANDALISM", "WP:NPOV", "WP:BLP"). Keep your explanation to 1-3 sentences.

FORMATTING: Write your explanation as inline HTML with properly opened AND closed tags. Never use self-closing tags like <code/> or <b/> — always use an opening and closing pair.
Example: <b>Clear vandalism</b> — added <code>lol hacked</code> which violates <i>WP:VANDALISM</i>.
Allowed tags: <b>...</b>, <i>...</i>, <code>...</code>. No markdown, no block tags.

DIFF:
${diffText}
`);
        },

        username: async (item) => {
            return fullTrim(`
You are an automated Wikipedia username policy reviewer. Determine whether the username below violates Wikipedia's username policy.

USERNAME: ${item.user.name}
PAGE CONTEXT: ${item.page?.title || "(unknown)"}

The page context is provided ONLY to check for potential conflict-of-interest (e.g. a user named "AcmeCorp" iteming the Acme Corporation article). A controversial page topic does NOT make the username problematic.

VIOLATION CATEGORIES (flag ONLY if the username clearly and unambiguously fits one):

1. Offensive — The name is unambiguously profane, threatening, sexually explicit, or promotes vandalism. Merely edgy, weird, or humorous names do NOT qualify. (WP:U#OFFENSIVE)
2. Disruptive — The name clearly declares intent to disrupt or vandalize (e.g. "I Will Vandalize"). (WP:U#DISRUPTIVE)
3. Libelous — The name makes a clearly false or disparaging claim about a specific real person, or reveals private personal information. (WP:U#LIBEL)
4. Misleading — The name impersonates a specific real person, or falsely claims special permissions by including terms like "admin", "sysop", "bureaucrat", "checkuser". (WP:U#MISLEADING)
5. Promotional — The name is a URL or email address whose clear purpose is advertising or revenue. Containing a brand name alone is NOT enough. (WP:U#PROMO)
6. Shared — The name unambiguously represents a company, organization, or role rather than an individual (e.g. "XYZ Foundation", "Secretary of ABC"). Names like "JohnAtAcme" or "AcmeFan123" are fine — they clearly identify an individual. (WP:U#SHARED)

DECISION RULES:
- Flag ONLY clear, unambiguous violations. Borderline = no flag.
- Numbers at the end of a username (e.g. "itemor2847", "WikiFan99") are completely normal and NOT a violation of any kind.
- Creative, odd, humorous, or meaningless usernames are NOT violations.
- Containing a real word that could be offensive in some context is NOT enough — the name must be clearly and intentionally offensive.
- When in doubt: do NOT flag. Set flag to false.
- If not flagging, set explanation to "No violation."

FORMATTING: Write your explanation as inline HTML with properly opened AND closed tags. Never use self-closing tags like <code/> or <b/> — always use an opening and closing pair.
Example: Username contains <code>sysop</code> which falsely implies <i>WP:U#MISLEADING</i> permissions.
Allowed tags: <b>...</b>, <i>...</i>, <code>...</code>. No markdown, no block tags.
`);
        },
    };
}

const EDIT_RESPONSE_FORMAT = {
    type: "object",
    properties: {
        issues: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    policy: { type: "string" },
                    severity: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
                },
                required: ["policy", "severity"],
            },
        },
        explanation: { type: "string" },
        assessment: { type: "string", enum: ["Good", "Review", "Suspicious", "Bad"] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["assessment", "confidence", "issues", "explanation"],
};

const USERNAME_RESPONSE_FORMAT = {
    type: "object",
    properties: {
        issues: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    policy: { type: "string", enum: ["Offensive", "Disruptive", "Libelous", "Misleading", "Promotional", "Shared"] },
                    severity: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
                },
                required: ["policy", "severity"],
            },
        },
        explanation: { type: "string" },
        flag: { type: "boolean" },
        confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["flag", "confidence", "issues", "explanation"],
};

export class Ollama extends AI {
    async test() {
        try {
            const response = await fetch(`${this.config.server}/api/version`, { method: 'GET' });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async models() {
        try {
            const response = await fetch(`${this.config.server}/api/tags`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
            if (!response.ok)
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);

            const data = await response.json();
            return data.models || [ ];
        } catch (error) {
            throw error;
        }
    }

	async fetch(type, item, signal = null) {
		try {
            const prompt = this.prompt[type](item);

			const fetchOptions = {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
			};

			const body = {
				model: this.config.model,
				prompt: await prompt,
				stream: false,
				options: {
					temperature: 0.1,
					top_p: 0.9,
					num_predict: 1024,
				},
				format: type === "edit" ? EDIT_RESPONSE_FORMAT : USERNAME_RESPONSE_FORMAT,
			};

			fetchOptions.body = JSON.stringify(body);

			if (signal)
				fetchOptions.signal = signal;

            let response;
            try {
                response = await fetch(`${this.config.server}/api/generate`, fetchOptions);

                if (!response.ok)
                    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);

                const data = await response.json();

                if (!data.response)
                    throw new Error('Empty response from Ollama');

                return JSON.parse(data.response);
            } catch (err) { return { error: err.message || "Ollama request failed" }; }
		} catch (error) { return { error: error.message || "Ollama request failed" }; }
	}
}

AI.registerProvider('Ollama', Ollama);