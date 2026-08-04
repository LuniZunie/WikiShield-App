// DO NOT CHANGE THIS FILE

import { Version } from "../versions.js";

Version.v0 = class V0 extends Version {
    static number = 0;
    static get default() {
        return {
            version: 0,
            changelog: "0",

            options: {
                maxQueueSize: 50,
                maxEditCount: 50,
                minimumORESScore: 0,

                enableSoundAlerts: true,
                soundAlertORESScore: 0.95,

                enableUsernameHighlighting: true,
                enableWelcomeLatin: false,
                enableAutoWelcome: false,
                enableEditAnalysis: false,
                enableUsernameAnalysis: false,

                enableAutoReporting: true,
                selectedAutoReportReasons: {
                    "Vandalism": true,
                    "Subtle vandalism": true,
                    "Image vandalism": true,
                    "Sandbox": true,

                    "Unsourced": true,
                    "Unsourced (BLP)": true,
                    "Unsourced genre": true,
                    "POV": false,
                    "Commentary": true,
                    "AI-generated": true,
                    "AI-generated (talk)": true,
                    "MOS violation": false,
                    "Censoring": false,

                    "Disruption": true,
                    "Deleting": true,
                    "Errors": true,
                    "Editing tests": true,
                    "Chatting": false,
                    "Jokes": true,
                    "Owning": false,

                    "Advertising": true,
                    "Spam links": true,

                    "Personal attacks": true,
                    "TPO": true,
                    "AfD removal": true,
                },

                zen: {
                    enabled: false,
                    sounds: true,

                    watchlist: false,
                    notifications: true,
                    editCount: false,
                    toasts: false,
                },

                enableCloudStorage: true,

                masterVolume: 0.5,
                volumes: {
                    click: 0.5,
                    notification: 0.5,
                    watchlist: 0.5,
                    alert: 0.5,
                    whoosh: 0.5,
                    warn: 0.5,
                    rollback: 0.5,
                    report: 0.5,
                    thank: 0.5,
                    protection: 0.5,
                    block: 0.5,
                    sparkle: 0.5,
                    success: 0.5,
                    error: 0.5
                },
                soundMappings: {
                    click: 'click',
                    notification: 'notify',
                    watchlist: 'ping',
                    alert: 'alert',
                    whoosh: 'whoosh',
                    warn: 'warn',
                    rollback: 'rollback',
                    report: 'report',
                    thank: 'thank',
                    protection: 'protection',
                    block: 'block',
                    sparkle: 'sparkle',
                    success: 'success',
                    error: 'error'
                },
                watchlistExpiry: "1 week",
                whitelistExpiry: {
                    users: "indefinite",
                    pages: "indefinite",
                    tags: "indefinite",
                },
                highlightedExpiry: {
                    users: "1 week",
                    pages: "1 week",
                    tags: "1 week",
                },
                wiki: "en",
                namespacesShown: [ 0 ],
                showTemps: true,
                showUsers: true,
                sortQueueItems: true,
                enableOllamaAI: false,
                ollamaServerUrl: "http://localhost:11434",
                ollamaModel: "",
                controlScripts: [
                    {
                        keys: ["arrowright"],
                        actions: [
                            {
                                name: "nextEdit",
                                params: { }
                            }
                        ]
                    },
                    {
                        keys: [" "],
                        actions: [
                            {
                                name: "nextEdit",
                                params: { }
                            }
                        ]
                    },
                    {
                        keys: ["q"],
                        actions: [
                            {
                                name: "nextEdit",
                                params: { }
                            },
                            {
                                name: "rollback",
                                params: { }
                            },
                            {
                                name: "warn",
                                params: {
                                    warningType: "Vandalism",
                                    level: "auto"
                                }
                            },
                            {
                                name: "if",
                                condition: "atFinalWarning",
                                actions: [
                                    {
                                        name: "if",
                                        condition: "operatorNonAdmin",
                                        actions: [
                                            {
                                                name: "reportToAIV",
                                                params: {
                                                    reportMessage: "Vandalism past final warning"
                                                }
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                name: "highlightUser",
                                params: { }
                            }
                        ]
                    },
                    {
                        keys: ["arrowleft"],
                        actions: [
                            {
                                name: "prevEdit",
                                params: { }
                            }
                        ]
                    },
                    {
                        keys: ["h"],
                        actions: [
                            {
                                name: "openHistory",
                                params: { }
                            }
                        ]
                    },
                    {
                        keys: ["c"],
                        actions: [
                            {
                                name: "openUserContribs",
                                params: { }
                            }
                        ]
                    },
                    {
                        keys: ["t"],
                        actions: [
                            {
                                name: "thankUser",
                                params: { }
                            }
                        ]
                    },
                    {
                        keys: ["w"],
                        actions: [
                            {
                                name: "welcome",
                                params: {
                                    template: "Mentor"
                                }
                            }
                        ]
                    }
                ],
                selectedPalette: 0,
                theme: "theme-light"
            },
            statistics: {
                reviewed: 0,
                reverts: 0,
                reverts: 0,
                reports: 0,
                warnings: 0,
                welcomes: 0,
                whitelisted: 0,
                highlighted: 0,
                blocks: 0,
                sessionStart: Date.now()
            },
            whitelist: {
                users: [ ],
                pages: [ ],
                tags: [ ]
            },
            highlighted: {
                users: [ ],
                pages: [ ],
                tags: [ ]
            },
            queueWidth: "15vw",
            detailsWidth: "15vw"
        };
    }

    /*
        You might be wondering, where are the upgrade and validate functions?
        1. This is the first version, so there is no previous version to upgrade from.
        2. I didn't feel like validating the first version, if you somehow go back in time and mess up your data, that's on you.
    */
};