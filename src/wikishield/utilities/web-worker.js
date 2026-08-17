class WebWorker {
    static isSupported() {
        return window.Worker !== undefined;
    }

    constructor(code, options = { }) {
        if (WebWorker.isSupported())
            return new Worker(URL.createObjectURL(new Blob([ code ], { type: "text/javascript" })), options);
        else
            throw new Error("Web Workers are not supported in this environment.");
    }
}

export { WebWorker };