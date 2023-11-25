let authClient = null;

const configureClient = () => {
  var baseOktaURL = 'https://dev-02388022.okta.com/oauth2/default';
  var appClientID = '0oadgesaodnMo8lxl5d7';

  // Bootstrap the AuthJS Client
  authClient = new OktaAuth({
    // Required Fields for OIDC client
    url: baseOktaURL,
    clientId: appClientID,
    redirectUri: 'http://localhost:9000/', //or the redirect URI for your app
    issuer: baseOktaURL, // oidc
    scopes: ['openid', 'profile', 'email'],
    //pkce: true //The PKCE OAuth flow will be used by default. Cfr: https://github.com/okta/okta-auth-js/#pkce-oauth-20-flow
    //postLogoutRedirectUri
  });
};

window.onload = async () => {
  configureClient();

  if (authClient.isLoginRedirect()) {
    // Parse token from redirect url
    console.log('Parse token from redirect url');
    let data = await authClient.token.parseFromUrl();
    console.log(JSON.stringify(data, null, 4));

    //updateUI();

    //window.history.replaceState({}, document.title, "/");

    /*
        console.log(JSON.stringify(data, null, 4));
        const { idToken, accessToken } = data.tokens;
        // Display the Token
        const str1 = document.createElement('p');
        str1.innerHTML = `<b>${idToken.claims.email}</b> (email)<br /><b>${idToken.claims.sub}</b> (sub)<br /><br />Token Response:<br /><code style="word-wrap: break-word;">${JSON.stringify(idToken)}</code><br /><br/>Parsed from JWT<br />Client ID: <b>${authClient.options.clientId}</b><br />Issuer: <b>${authClient.options.issuer}</b>`;
        document.getElementById('content-jwt').appendChild(str1);
        console.log("Access token = " + accessToken.claims.aud); //Così lo posso accedere ma non ha info di aud sulla api
        */
    authClient.tokenManager.setTokens(data.tokens);
  }

  updateUI();
};

const updateUI = async () => {
  const isAuthenticated = await authClient.isAuthenticated();

  console.log(`isAuthenticated = ${isAuthenticated}`);

  document.getElementById('btn-logout').disabled = !isAuthenticated;
  document.getElementById('btn-login').disabled = isAuthenticated;
  document.getElementById('btn-call-api').disabled = !isAuthenticated;
  document.getElementById('btn-call-api-external').disabled = !isAuthenticated;

  if (isAuthenticated) {
    document.getElementById('gated-content').classList.remove('hidden');

    document.getElementById('ipt-access-token').innerHTML =
      authClient.getAccessToken();

    document.getElementById('ipt-user-profile').textContent = JSON.stringify(
      await authClient.getUser(),
      null,
      4
    );
  } else {
    document.getElementById('gated-content').classList.add('hidden');
  }
};

const login = async () => {
  await authClient.token.getWithRedirect({
    responseType: ['id_token'],
  });
};

const logout = () => {
  authClient.signOut({
    clearTokensBeforeRedirect: true,
  });
};

const callApi = async () => {
  try {
    // Get the access token from the Auth0 client
    const token = authClient.getAccessToken();

    console.log(`accessToken = ${token}`);

    // Make the call to the API, setting the token
    // in the Authorization header
    const response = await fetch('/api/external', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Fetch the JSON result
    const responseData = await response.json();

    // Display the result in the output element
    const responseElement = document.getElementById('api-call-result');

    responseElement.innerText = JSON.stringify(responseData, {}, 2);
  } catch (e) {
    // Display errors in the console
    console.error(e);
  }
};

const callExternallyHostedApi = async () => {
  try {
    // Get the access token from the Auth0 client
    const token = authClient.getAccessToken();

    console.log(`accessToken = ${token}`);

    // Make the call to the API, setting the token
    // in the Authorization header
    const response = await fetch('http://127.0.0.1:9001/api/whoami', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Fetch the JSON result
    const responseData = await response.json();

    // Display the result in the output element
    const responseElement = document.getElementById('api-call-result');

    responseElement.innerText = JSON.stringify(responseData, {}, 2);
  } catch (e) {
    // Display errors in the console
    console.error(e);
  }
};
