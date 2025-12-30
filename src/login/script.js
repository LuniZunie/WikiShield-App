// Load saved accounts for autocomplete
window.electronAPI.loadAccounts().then(accounts => {
    const $usernameList = document.querySelector('#saved-usernames');
    const $passwordList = document.querySelector('#saved-passwords');

    for (const account of accounts) {
        const usernameOption = document.createElement('option');
        usernameOption.value = account.username;
        $usernameList.appendChild(usernameOption);

        const passwordOption = document.createElement('option');
        passwordOption.label = account.username;
        passwordOption.value = account.password;
        $passwordList.appendChild(passwordOption);
    }
});

// Toggle password visibility
document.querySelector('#toggle-password').addEventListener('click', function() {
    const $passwordInput = document.querySelector('#password');
    const $icon = this.querySelector('i');

    if ($passwordInput.type === 'password') {
        $passwordInput.type = 'text';
        $icon.classList.remove('fa-eye');
        $icon.classList.add('fa-eye-slash');
    } else {
        $passwordInput.type = 'password';
        $icon.classList.remove('fa-eye-slash');
        $icon.classList.add('fa-eye');
    }
});

// Handle form submission
const $errorMessage = document.querySelector('#error-message');
const $errorText = $errorMessage.querySelector('.error-text');

document.querySelector('#login-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.querySelector('#username').value;
    const password = document.querySelector('#password').value;
    const $button = document.querySelector('#login-button');
    const $buttonText = $button.querySelector('.btn-text');
    const $buttonIcon = $button.querySelector('i');

    // Disable button and show loading state
    $button.disabled = true;
    $buttonText.textContent = 'Signing in';
    $buttonIcon.className = 'fas fa-spinner fa-spin';
    $errorMessage.classList.add('hidden');

    try {
        // Get login token
        const tokenResponse = await fetch('https://en.wikipedia.org/w/api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                action: 'query',
                meta: 'tokens',
                type: 'login',
                format: 'json'
            }).toString()
        });

        const tokenData = await tokenResponse.json();
        const token = tokenData.query.tokens.logintoken;

        // Attempt login
        const loginResponse = await fetch('https://en.wikipedia.org/w/api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                action: 'login',
                lgname: username,
                lgpassword: password,
                lgtoken: token,
                format: 'json'
            }).toString()
        });

        const loginData = await loginResponse.json();

        if (loginData.login?.result === 'Success') {
            // Success - save account
            $buttonText.textContent = 'Success';
            $buttonIcon.className = 'fas fa-check-circle';
            await window.electronAPI.saveAccount({ username, password });
        } else {
            // Login failed
            throw new Error(loginData.login?.reason || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Login error:', error);

        // Show error message
        $errorText.textContent = `Login failed: ${error.message}`;
        $errorMessage.classList.remove('hidden');

        // Reset button
        $button.disabled = false;
        $buttonText.textContent = 'Sign In';
        $buttonIcon.className = 'fas fa-arrow-right';
    }
});