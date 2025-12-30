const elemMap = new Map();

window.electronAPI.loadAccounts().then(accounts => {
    const $container = document.querySelector('#accounts-container');

    for (const account of accounts) {
        const $card = createAccountCard(account);
        $container.appendChild($card);
        elemMap.set(account.username, $card);
    }
});

function createAccountCard(account) {
    // Main card
    const $card = document.createElement('div');
    $card.classList.add('account-card');
    if (!account.valid) {
        $card.classList.add('logged-out');
    }
    if (account.active) {
        $card.classList.add('active');
    }

    // Card header
    const $header = document.createElement('div');
    $header.classList.add('card-header');
    $card.appendChild($header);

    // Avatar
    const $avatar = document.createElement('div');
    $avatar.classList.add('account-avatar');
    $avatar.textContent = account.username.substring(0, 2);
    $header.appendChild($avatar);

    // Account details
    const $details = document.createElement('div');
    $details.classList.add('account-details');
    $header.appendChild($details);

    // Username
    const $username = document.createElement('h3');
    $username.classList.add('account-username');
    $username.textContent = account.username;
    $details.appendChild($username);

    // Status badge
    const $badge = document.createElement('span');
    $badge.classList.add('status-badge');
    $badge.textContent = account.active ? 'Active' : 'Inactive';
    $details.appendChild($badge);

    // Error message (if invalid credentials)
    if (!account.valid) {
        const $error = document.createElement('div');
        $error.classList.add('account-error');
        $error.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Invalid credentials. Please log in again.</span>';
        $card.appendChild($error);
    }

    // Actions
    const $actions = document.createElement('div');
    $actions.classList.add('card-actions');
    $card.appendChild($actions);

    // Set Active button
    const $setActiveBtn = document.createElement('button');
    $setActiveBtn.classList.add('btn', 'btn-primary');
    $setActiveBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>Set Active</span>';
    if (account.active) {
        $setActiveBtn.disabled = true;
    }
    $setActiveBtn.addEventListener('click', () => {
        for (const [, $el] of elemMap) {
            $el.classList.remove('active');
            const btn = $el.querySelector('.btn-primary');
            if (btn) btn.disabled = false;
            const badge = $el.querySelector('.status-badge');
            if (badge) badge.textContent = 'Inactive';
        }

        window.electronAPI.setActiveAccount(account.username);
        $card.classList.add('active');
        $setActiveBtn.disabled = true;
        $badge.textContent = 'Active';
    });
    $actions.appendChild($setActiveBtn);

    // Delete button
    const $deleteBtn = document.createElement('button');
    $deleteBtn.classList.add('btn', 'btn-danger');
    $deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i><span>Delete</span>';
    $deleteBtn.addEventListener('click', () => {
        const wasActive = account.active;
        const $container = document.querySelector('#accounts-container');

        window.electronAPI.deleteAccount(account.username);
        $container.removeChild($card);
        elemMap.delete(account.username);

        if (wasActive && elemMap.size > 0) {
            const [username, $el] = [...elemMap.entries()][0];
            window.electronAPI.setActiveAccount(username);
            $el.classList.add('active');

            const btn = $el.querySelector('.btn-primary');
            if (btn) btn.disabled = true;
            const badge = $el.querySelector('.status-badge');
            if (badge) badge.textContent = 'Active';
        }
    });
    $actions.appendChild($deleteBtn);

    return $card;
}