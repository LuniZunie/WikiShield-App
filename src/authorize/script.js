const $authorize = document.getElementById("authorize");
$authorize.addEventListener("click", () => {
    electron.handleAuthorization();
    $authorize.disabled = true;

    const $text = $authorize.querySelector("span");
    $text.classList.add("animate-loading-dots");
    $text.textContent = "Authorizing";
});

const $cancel = document.getElementById("cancel");
$cancel.addEventListener("click", () => electron.close());