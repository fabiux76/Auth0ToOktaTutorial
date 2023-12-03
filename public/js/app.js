let authClient = null;

var baseOktaURL = 'https://dev-02388022.okta.com/oauth2/default';
var appClientID = '0oadfyos6nUHduhb85d7';
var appState = {};


const config = {
  // Required Fields for OIDC client
  url: baseOktaURL,
  clientId: appClientID,
  redirectUri: 'http://localhost:3000/login/callback', //or the redirect URI for your app
  issuer: baseOktaURL, // oidc
  scopes: ['openid', 'profile', 'email'],
  //pkce: true //The PKCE OAuth flow will be used by default. Cfr: https://github.com/okta/okta-auth-js/#pkce-oauth-20-flow
  //postLogoutRedirectUri
  useInteractionCodeFlow: true,
  authMethod: 'form', //'widget' | 'redirect' | 'form'
};

const configureClient = () => {
  // Bootstrap the AuthJS Client
  authClient = new OktaAuth(config);
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
    document.getElementById('static-signin-form').style.display = 'none';
  }
};

const login = async () => {
  if (config.authMethod == 'form') {
    document.getElementById('static-signin-form').style.display = 'block';
    return;
  }
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

function submitStaticSigninForm() {
  const username = document.querySelector(
    '#static-signin-form input[name=username]'
  ).value;
  const password = document.querySelector(
    '#static-signin-form input[name=password]'
  ).value;

  return authClient.idx
    .authenticate({ username, password })
    .then(handleTransaction)
    .catch(showError);
}

function bindClick(method, boundArgs) {
  return function (e) {
    e.preventDefault();
    const runtimeArgs = Array.prototype.slice.call(arguments, 1);
    try {
      method.apply(null, runtimeArgs.concat(boundArgs));
    } catch (err) {
      showError(err);
    }
    return false;
  };
}

window._submitStaticSigninForm = bindClick(submitStaticSigninForm);

function handleTransaction(transaction) {
  // IDX
  if (transaction.messages) {
    showError(transaction.messages);
  }

  switch (transaction.status) {
    case 'PENDING':
      if (transaction.nextStep.name === 'identify') {
        showError("Handle identify");
      }
      hideSigninForm();
      updateAppState({ transaction });
      showMfa();
    case 'FAILURE':
      showError(transaction.error);
      break;
    case 'SUCCESS':
      hideSigninForm();
      endAuthFlow(transaction.tokens);
      break;
    default:
      throw new Error(
        'TODO: add handling for ' + transaction.status + ' status'
      );
  }
}

function hideSigninForm() {
  document.getElementById('static-signin-form').style.display = 'none';
}

function endAuthFlow(tokens) {
  // parseFromUrl clears location.search. There may also be a leftover "error" param from the auth flow.
  // Replace state with the canonical app uri so the page can be reloaded cleanly.
  history.replaceState(null, '', config.appUri);

  // Store tokens. This will update the auth state and we will re-render
  authClient.tokenManager.setTokens(tokens);
  updateUI();
}

function showMfa() {
  document.getElementById('mfa').style.display = 'block';

  const transaction = appState.transaction;
  if (transaction.status === 'PENDING') {
    const nextStep = transaction.nextStep;
    switch (nextStep.name) {      
      case 'enroll-authenticator':
      case 'challenge-authenticator':
        showMfaChallenge();
        break;
      default:
        throw new Error(`TODO: showMfa: handle nextStep: ${nextStep.name}`);
    }
  }
}

function showMfaChallenge() {
  document.getElementById('mfa-challenge').style.display = 'block';
  document.querySelector('#mfa .header').innerText = 'MFA challenge';
  showPrevMfa();

  const authenticator = appState.transaction.nextStep.authenticator;

  if (authenticator.type == 'app') {
    return showChallengePhone();
  }
}

function showChallengePhone() {
  document.getElementById('mfa-challenge-phone').style.display = 'block';
  document.querySelector('#mfa .header').innerText = 'Okta Verify Code';
  showSubmitMfa();
}

function showSubmitMfa() {
  document.getElementById('mfa-submit').style.display = 'inline';
}

function submitMfa() {
  const nextStep = appState.transaction.nextStep;
  if (nextStep.name === 'challenge-authenticator' || nextStep.name === 'enroll-authenticator') {
    return submitChallengeAuthenticator();
  }
  throw new Error(`TODO: submitMfa: handle submit for nextStep: ${nextStep.name}`);
}
function submitChallengeAuthenticator() {
  const authenticator = appState.transaction.nextStep.authenticator;
  
  // Phone/SMS and app
  if (authenticator.type === 'phone' || authenticator.type === 'app') {
    return submitChallengePhone();
  }

  throw new Error(`TODO: handle submit challenge-authenticator for authenticator type ${authenticator.type}`);
}

window._submitMfa = bindClick(submitMfa);

function showPrevMfa() {
  document.getElementById('mfa-prev').style.display = 'inline';
  hideCancelMfa();
}

function hidePrevMfa() {
  document.getElementById('mfa-prev').style.display = 'none';
}

function showCancelMfa() {
  document.getElementById('mfa-cancel').style.display = 'inline';
  hidePrevMfa();
}
function hideCancelMfa() {
  document.getElementById('mfa-cancel').style.display = 'none';
}

function submitChallengePhone() {
  hideMfa();
  const passCode = document.querySelector('#mfa-challenge-phone input[name=passcode]').value;

  // IDX
  authClient.idx.authenticate({ verificationCode: passCode })
    .then(handleTransaction)
    .catch(showError);
}

function showError(error) {
  console.log(error);
}

function updateAppState(props) {
  Object.assign(appState, props);
}

function hideSubmitMfa() {
  document.getElementById('mfa-submit').style.display = 'none';
}

function hideMfa() {
  document.getElementById('mfa').style.display = 'none';
  document.querySelector('#mfa .header').innerHTML = '';
  hideSubmitMfa();
  hideMfaChallenge();
}

function hideMfaChallenge() {
  document.getElementById('mfa-challenge').style.display = 'none';
}

function stringify(obj) {
  // Convert false/undefined/null into "null"
  if (!obj) {
    return 'null';
  }
  return JSON.stringify(obj, null, 2);
}
