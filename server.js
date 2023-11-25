const express = require("express");
const OktaJwtVerifier = require('@okta/jwt-verifier');
const { join } = require("path");

const app = express();

// Serve assets from the /public folder
app.use(express.static(join(__dirname, "public")));

const oktaJwtVerifier = new OktaJwtVerifier({
  issuer: 'https://dev-02388022.okta.com/oauth2/default'
});
const audience = 'api://default';

const authenticationRequired = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/Bearer (.+)/);
  if (!match) {
    return res.status(401).send();
  }

  try {
    const accessToken = match[1];
    if (!accessToken) {
      return res.status(401, 'Not authorized').send();
    }
    req.jwt = await oktaJwtVerifier.verifyAccessToken(accessToken, audience);
    next();
  } catch (err) {
    return res.status(401).send(err.message);
  }
};

// Create an endpoint that uses the above middleware to
// protect this route from unauthorized requests
app.get("/api/external", authenticationRequired, (req, res) => {
  res.json({
    msg: "Your access token was successfully validated!",
    claims: req.jwt?.claims
  });
});

// Serve the index page to everything else
app.get("/*", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

// Error handler
app.use(function(err, req, res, next) {
  if (err.name === "UnauthorizedError") {
    return res.status(401).send({ msg: "Invalid token" });
  }

  next(err, req, res);
});

// Listen on port 9000
app.listen(9000, () => console.log("Application running on port 9000"));