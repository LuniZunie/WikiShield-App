electronAPI.onSetTranslation((event, obj) => {
    console.log("Received translation:", obj);

    document.querySelector("#loader").style.display = "none";
    document.querySelector("#content").style.display = "block";

    document.querySelector("#header-subtitle").innerHTML = `${obj.language || ""} &#8594; ${obj.target || ""}`;

    document.querySelector("#language-name").textContent = obj.language || "";
    document.querySelector("#target-name").textContent = obj.target || "";

    document.querySelector("#translated-text").textContent = obj.after || "";
    document.querySelector("#original-text").textContent = obj.before || "";
});

document.querySelector("#close").addEventListener("click", () => electronAPI.close());