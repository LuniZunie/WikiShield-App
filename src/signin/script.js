const elemMap = new Map();
let rememberAccounts = false;

electron.getAccounts().then(([ rememberMe, accounts ]) => {
    rememberAccounts = rememberMe;

    const $remember = document.querySelector("#remember-accounts");
    $remember.checked = rememberMe;
    $remember.addEventListener("change", event => {
        rememberAccounts = event.target.checked;
        electron.setRememberAccounts(rememberAccounts);
    });

    const $container = document.querySelector("#accounts-container");

    for (const account of accounts) {
        const $card = createAccountCard(account);
        $container.appendChild($card);
        elemMap.set(account.username, $card);
    }
});

function createAccountCard(account) {
    const $card = document.createElement("div");
    $card.classList.add("account-card");
    if (!account.valid)
        $card.classList.add("logged-out");

    const $left = document.createElement("div");
    $left.classList.add("account-card-left");
    $card.appendChild($left);

    const $avatar = document.createElement("div");
    $avatar.classList.add("account-avatar");
    $avatar.textContent = account.username.split(" ").slice(0, 1).map(s => s.charAt(0)).join("");
    $left.appendChild($avatar);

    const $info = document.createElement("div");
    $info.classList.add("account-info");
    $left.appendChild($info);

    const $username = document.createElement("h3");
    $username.classList.add("account-username");
    $username.textContent = account.username;
    $info.appendChild($username);

    const $status = document.createElement("p");
    $status.classList.add("account-status");
    $status.textContent = account.valid ? "Signed in" : "Signed out";
    if (!account.valid)
        $status.classList.add("inactive");
    $info.appendChild($status);

    if (!account.valid) {
        const $error = document.createElement("div");
        $error.classList.add("account-error-badge");
        $error.innerHTML = "<i class='fas fa-exclamation-circle'></i><span>Re-authenticate</span>";
        $left.appendChild($error);
    }

    const $right = document.createElement("div");
    $right.classList.add("account-card-right");
    $card.appendChild($right);

    const $signin = document.createElement("button");
    $signin.classList.add("card-action", "signin");
    $signin.title = "Sign in";
    $signin.innerHTML = "<i class='fas fa-sign-in-alt'></i>";

    $signin.addEventListener("click", () => {
        for (const [, $el] of elemMap) {
            $el.classList.remove("active");

            const $btn = $el.querySelector(".signin");
            if ($btn)
                $btn.disabled = false;
        }

        electron.signin(account.username);
        $card.classList.add("active");
        $signin.disabled = true;
    });
    $right.appendChild($signin);

    const $delete = document.createElement("button");
    $delete.classList.add("card-action", "delete");
    $delete.title = "Delete account";
    $delete.innerHTML = "<i class='fas fa-trash-alt'></i>";
    $delete.addEventListener("click", () => {
        const $container = document.querySelector("#accounts-container");

        electron.deleteAccount(account.username);
        $container.removeChild($card);
        elemMap.delete(account.username);
    });
    $right.appendChild($delete);

    return $card;
}

document.querySelector("#add-account").addEventListener("click", () => electron.authorize());
document.querySelector("#close").addEventListener("click", () => electron.close());

electron.onAuthorizationFailed((event, message) => document.querySelector("#status-message").textContent = message);
electron.onFocusWindow(() => document.querySelector("#close").classList.remove("blurred"));
electron.onBlurWindow(() => document.querySelector("#close").classList.add("blurred"));

electron.ready();