const warnings = {
	"Vandalism": {
		title: "Vandalism",
		icon: "fas fa-skull-crossbones",
		description: "Warnings for different types of vandalism.",

		warnings: [
			{
				reportable: true,

				queueType: [ "edit", "abuselog" ],

				title: "Vandalism",
				name: "vandalism",
				icon: "fas fa-skull-crossbones",
				description: "Warning for general vandalism.",

				summary: "vandalism",

				auto: {
					"0": "1",
					"1": "2",
					"2": "3",
					"3": "4",
					"4": "report",
					"4im": "report"
				},
				templates: [
					{ name: "1", template: "uw-vandalism1" },
					{ name: "2", template: "uw-vandalism2" },
					{ name: "3", template: "uw-vandalism3" },
					{ name: "4", template: "uw-vandalism4" },
					{ name: "4im", template: "uw-vandalism4im" }
				],
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Page creation vandalism",
				name: "page creation vandalism",
				icon: "fas fa-skull-crossbones",
				description: "Warning for creating vandalism pages.",

				auto: {
					"0": "1",
					"1": "2",
					"2": "3",
					"3": "4",
					"4": "report",
					"4im": "report"
				},
				templates: [
					{ name: "1", template: "uw-create1" },
					{ name: "2", template: "uw-create2" },
					{ name: "3", template: "uw-create3" },
					{ name: "4", template: "uw-create4" },
					{ name: "4im", template: "uw-create4im" }
				],
			},
            {
				reportable: true,

				queueType: [ "edit" ],

				title: "Deliberate errors",
				name: "deliberate errors",
				icon: "fas fa-bug",
				description: "Adding deliberate errors to articles.",

				summary: "deliberate errors",

				auto: {
					"0": "1",
					"1": "2",
					"2": "3",
					"3": "4",
					"4": "report",
					"4im": "report"
				},
				templates: [
					{ name: "1", template: "uw-error1" },
					{ name: "2", template: "uw-error2" },
					{ name: "3", template: "uw-error3" },
					{ name: "4", template: "uw-error4" }
				],
			},
		]
	},
	"Disruption": {
		title: "Disruption",
		icon: "fas fa-exclamation",
		description: "Warnings for different types of disruptive behavior.",

		warnings: [
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Editing tests",
				name: "editing tests",
				icon: "fas fa-flask",
				description: "Making test edits on live articles.",

				summary: "test edits",

				auto: {
					"0": "1",
					"1": "2",
					"2": "3",
					"3": "4",
					"4": "report",
					"4im": "report"
				},
				templates: [
					{ name: "1", template: "uw-test1" },
					{ name: "2", template: "uw-test2" },
					{ name: "3", template: "uw-test3" },
					{ name: "4", template: "uw-test4" },
                    { name: "4im", template: "uw-test4im" }
				]
			},
            {
				reportable: false,

				queueType: [ "edit" ],

				title: "Inappropriate jokes",
				name: "inappropriate humor",
				icon: "fas fa-grin-squint",
				description: "Adding inappropriate humor to an article.",

				summary: "inappropriate humor",

				auto: "notice",
				templates: [
					{ name: "notice", template: "uw-joke" }
				]
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Deleting",
				name: "unexplained deletion",
				icon: "fas fa-trash",
				description: "Used when a user does not explain deletion of part of an article.",

				summary: "unexplained deletion",

				auto: {
					"0": "1",
					"1": "2",
					"2": "3",
					"3": "4",
					"4": "report",
					"4im": "report"
				},
				templates: [
					{ name: "1", template: "uw-delete1" },
					{ name: "2", template: "uw-delete2" },
					{ name: "3", template: "uw-delete3" },
					{ name: "4", template: "uw-delete4" },
					{ name: "4im", template: "uw-delete4im" }
				],
			},
		]
	},
	"Content Issues": {
		title: "Content Issues",
		icon: "fas fa-file-alt",
		description: "Warnings for different types of content issues.",

		warnings: [
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Unsourced",
				name: "unsourced changes",
				icon: "fas fa-question",
				description: "Warning for unsourced content.",

				summary: "unsourced changes",

				auto: {
					"0": "1",
					"1": "2",
					"2": "3",
					"3": "4",
					"4": "report",
					"4im": "report"
				},
				templates: [
					{ name: "1", template: "uw-unsourced1" },
					{ name: "2", template: "uw-unsourced2" },
					{ name: "3", template: "uw-unsourced3" },
					{ name: "4", template: "uw-unsourced4" }
				],
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Unsourced (BLP)",
				name: "unsourced [[WP:BLP|biographies of living persons']] changes",
				icon: "fas fa-person-circle-question",
				description: "Warning for unsourced BLP content.",

				summary: "unsourced [[WP:BLP|biographies of living persons']] changes",

				auto: {
					"0": "1",
					"1": "2",
					"2": "3",
					"3": "4",
					"4": "report",
					"4im": "report"
				},
				templates: [
					{ name: "1", template: "uw-biog1" },
					{ name: "2", template: "uw-biog2" },
					{ name: "3", template: "uw-biog3" },
					{ name: "4", template: "uw-biog4" },
					{ name: "4im", template: "uw-biog4im" }
				],
			},

			{
				reportable: true,

				queueType: [ "edit" ],

				title: "POV",
				name: "[[WP:NPOV|non-neutral changes]]",
				icon: "fas fa-balance-scale-left",
				description: "Adding content which violates the neutral point of view policy.",

				summary: "[[WP:NPOV|non-neutral changes]]",

				auto: {
					"0": "1",
					"1": "2",
					"2": "3",
					"3": "4",
					"4": "report",
					"4im": "report"
				},
				templates: [
					{ name: "1", template: "uw-npov1" },
					{ name: "2", template: "uw-npov2" },
					{ name: "3", template: "uw-npov3" },
					{ name: "4", template: "uw-npov4" },
                    { name: "4im", template: "uw-npov4im" }
				]
			},

			{
				reportable: true,

				queueType: [ "edit" ],

				title: "MOS violation",
				name: "[[WP:MOS|manual of style]] violation",
				icon: "fas fa-spell-check",
				description: "Not following the Manual of Style.",

				summary: "[[WP:MOS|manual of style]] violation",

				auto: {
					"0": "1",
					"1": "2",
					"2": "3",
					"3": "4",
					"4": "report",
					"4im": "report"
				},
				templates: [
					{ name: "1", template: "uw-mos1" },
					{ name: "2", template: "uw-mos2" },
					{ name: "3", template: "uw-mos3" },
					{ name: "4", template: "uw-mos4" },
                    { name: "4im", template: "uw-mos4im" }
				],
			},
			{
				reportable: false,

				queueType: [ "edit" ],

				title: "English variant",
				name: "[[WP:ENGVAR|different English variant]]",
				icon: "fas fa-globe",
				description: "Content added in a different English variant than the rest of the article.",

				summary: "[[WP:ENGVAR|different English variant]]",

				auto: "notice",
				templates: [
					{ name: "notice", template: "uw-lang" }
				]
			},
			{
				reportable: false,

				queueType: [ "edit" ],

				title: "Not English",
				name: "non-English content",
				icon: "fas fa-language",
				description: "Content added in a language other than English.",

				summary: "non-English content",

				auto: "notice",
				templates: [
					{ name: "notice", template: "uw-notenglish" }
				]
			}
		]
	},
	"Conduct": {
		title: "Conduct",
		icon: "fas fa-user-shield",
		description: "Warnings for different types of conduct issues.",

		warnings: [
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Personal attacks",
				name: "[[WP:NPA|personal attacks]]",
				icon: "fas fa-bomb",
				description: "Personal attacks towards another user.",

				summary: "[[WP:NPA|personal attacks]]",

				auto: {
					"0": "1",
					"1": "2",
					"2": "3",
					"3": "4",
					"4": "report",
					"4im": "report"
				},
				templates: [
					{ name: "1", template: "uw-npa1" },
					{ name: "2", template: "uw-npa2" },
					{ name: "3", template: "uw-npa3" },
					{ name: "4", template: "uw-npa4" },
					{ name: "4im", template: "uw-npa4im" }
				]
			},

			{
				reportable: true,

				queueType: [ "edit" ],

				title: "TPO",
				name: "[[WP:TALK#Things not to do|removing or editing]] others' posts",
				icon: "fas fa-hand-paper",
				description: "Removing or editing others' posts.",

				summary: "[[WP:TALK#Things not to do|removing or editing]] others' posts",

				auto: {
					"0": "1",
					"1": "2",
					"2": "3",
					"3": "4",
					"4": "report",
					"4im": "report"
				},
				templates: [
					{ name: "1", template: "uw-tpv1" },
					{ name: "2", template: "uw-tpv2" },
					{ name: "3", template: "uw-tpv3" },
					{ name: "4", template: "uw-tpv4" },
					{ name: "4im", template: "uw-tpv4im" }
				]
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Owning",
				name: "assuming [[WP:OWN|ownership of articles]]",
				icon: "fas fa-user-shield",
				description: "Assuming ownership of articles.",

				summary: "assuming [[WP:OWN|ownership of articles]]",

				auto: {
					"0": "1",
					"1": "2",
					"2": "3",
					"3": "4",
					"4": "report",
					"4im": "report"
				},
				templates: [
					{ name: "1", template: "uw-own1" },
					{ name: "2", template: "uw-own2" },
					{ name: "3", template: "uw-own3" },
					{ name: "4", template: "uw-own4" }
				],
			},
			{
				reportable: false,

				queueType: [ "edit" ],

				title: "Edit warring",
				name: "[[WP:EW|edit warring]]",
				icon: "fas fa-jet-fighter",
				description: "Engaging in edit warring.",

				summary: "[[WP:EW|edit warring]]",

				auto: "warning",
				templates: [
					{ name: "warning", template: "uw-3rr", color: "#ff4500" }
				]
			}
		]
	},
	"Promotional": {
		title: "Promotional",
		icon: "fas fa-bullhorn",
		description: "Warnings for promotional content.",

		warnings: [
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Advertising",
				name: "[[WP:ADS|advertising or promotion]]",
				icon: "fas fa-ad",
				description: "Adding advertising or promotional content.",

				summary: "[[WP:ADS|advertising or promotion]]",

				auto: {
					"0": "1",
					"1": "2",
					"2": "3",
					"3": "4",
					"4": "report",
					"4im": "report"
				},
				templates: [
					{ name: "1", template: "uw-advert1" },
					{ name: "2", template: "uw-advert2" },
					{ name: "3", template: "uw-advert3" },
					{ name: "4", template: "uw-advert4" }
				]
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Spam links",
				name: "adding [[WP:ELNO|inappropriate links]]",
				icon: "fas fa-link",
				description: "Adding spam or promotional links.",

				summary: "adding [[WP:ELNO|inappropriate links]]",

				auto: {
					"0": "1",
					"1": "2",
					"2": "3",
					"3": "4",
					"4": "report",
					"4im": "report"
				},
				templates: [
					{ name: "1", template: "uw-spam1" },
					{ name: "2", template: "uw-spam2" },
					{ name: "3", template: "uw-spam3" },
					{ name: "4", template: "uw-spam4" },
					{ name: "4im", template: "uw-spam4im" }
				]
			},

			{
				reportable: false,

				queueType: [ "edit" ],

				title: "COI Edit",
				name: "editing with a [[WP:COI|conflict of interest]]",
				icon: "fas fa-user-tie",
				description: "Editing with a conflict of interest.",

				summary: "editing with a [[WP:COI|conflict of interest]]",

				auto: "notice",
				templates: [
					{ name: "notice", template: "uw-coi" },
				]
			}
		]
	}
};